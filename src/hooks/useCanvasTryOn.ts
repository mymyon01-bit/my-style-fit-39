// ─── useCanvasTryOn — DETERMINISTIC FIT STATE MACHINE ──────────────────────
// Pipeline:
//   IDLE → POSE → CUTOUT → COMPOSITE → READY
//        \___ on any failure ___ READY (silhouette + raw garment)
//
// After the canvas READY state lands (always within ~2s), an OPTIONAL AI
// refiner fires in the background. If it returns within 8s → we swap the
// imageUrl. If not, the canvas image stays — the user is never stuck.
//
// Inputs are intentionally narrow so we can call this hook from one place
// and not worry about the legacy try-on plumbing.

import { useEffect, useMemo, useRef, useState } from "react";
import { useBodyKeypoints } from "@/hooks/useBodyKeypoints";
import { buildBodyProfile } from "@/lib/fit/buildBodyProfile";
import { buildGarmentFitMap } from "@/lib/fit/buildGarmentFitMap";
import { solveFit, type SolverResult } from "@/lib/fit/fitSolver";
import { getGarmentCutout } from "@/lib/fit/garmentCutoutCache";
import { composeFitImage } from "@/lib/fit/canvasFitCompositor";
import { supabase } from "@/integrations/supabase/client";

export type CanvasTryOnStage =
  | "idle"
  | "pose"
  | "cutout"
  | "composite"
  | "ready"
  | "refining";

export interface CanvasTryOnState {
  stage: CanvasTryOnStage;
  imageUrl: string | null;
  source: "canvas" | "ai" | null;
  poseDegraded: boolean;
  poseSource: "mediapipe" | "synthetic";
  solver: SolverResult | null;
  /** Per-region fit chips for the UI. */
  fitChips: Array<{ region: string; fit: string; tone: "tight" | "regular" | "loose" }>;
  error: string | null;
}

interface Args {
  enabled: boolean;
  productKey: string;
  productImageUrl: string;
  productName: string;
  productCategory?: string | null;
  productFitType?: string | null;
  selectedSize: string;
  userImageUrl?: string | null;
  body: {
    heightCm?: number | null;
    weightKg?: number | null;
    shoulderWidthCm?: number | null;
    chestCm?: number | null;
    waistCm?: number | null;
    hipCm?: number | null;
    inseamCm?: number | null;
    gender?: string | null;
  };
  /** Bump to force re-composite (e.g. user pressed reload). */
  reloadToken?: number;
  /** When true, also fire an AI refiner in the background. */
  enableAiSwap?: boolean;
}

// Force the canvas fallback to commit within 8s no matter what — the UI must
// never stay on "BUILDING PREVIEW" after this point.
const HARD_TIMEOUT_MS = 8_000;
// AI swap window: keep polling for the AI try-on result for up to 45s after
// the canvas fallback renders. Fallback shows immediately so the UI never
// hangs, and the moment the AI result arrives we swap it in as the hero.
const AI_SWAP_WINDOW_MS = 45_000;

const toneOf = (region: string, fit: string): "tight" | "regular" | "loose" => {
  if (/(tight|snug|pulled|trim|short)/i.test(fit)) return "tight";
  if (/(loose|oversized|relaxed|roomy|dropped|long)/i.test(fit)) return "loose";
  return "regular";
};

export function useCanvasTryOn(args: Args): CanvasTryOnState {
  const bodyProfile = useMemo(
    () =>
      buildBodyProfile({
        heightCm: args.body.heightCm ?? null,
        weightKg: args.body.weightKg ?? null,
        shoulderCm: args.body.shoulderWidthCm ?? null,
        chestCm: args.body.chestCm ?? null,
        waistCm: args.body.waistCm ?? null,
        hipCm: args.body.hipCm ?? null,
        inseamCm: args.body.inseamCm ?? null,
      }),
    [
      args.body.heightCm,
      args.body.weightKg,
      args.body.shoulderWidthCm,
      args.body.chestCm,
      args.body.waistCm,
      args.body.hipCm,
      args.body.inseamCm,
    ]
  );

  const { pose, frame, source: poseSource, degraded: poseDegraded } = useBodyKeypoints({
    userImageUrl: args.userImageUrl ?? null,
    body: bodyProfile,
  });

  const fitMap = useMemo(
    () =>
      buildGarmentFitMap({
        category: args.productCategory ?? null,
        selectedSize: args.selectedSize,
        fitType: args.productFitType ?? null,
        body: bodyProfile,
      }),
    [args.productCategory, args.selectedSize, args.productFitType, bodyProfile]
  );

  const solver = useMemo(
    () =>
      solveFit({
        body: bodyProfile,
        fit: fitMap,
        category: fitMap.category,
        selectedSize: args.selectedSize,
      }),
    [bodyProfile, fitMap, args.selectedSize]
  );

  const fitChips = useMemo(() => {
    const isBottom = fitMap.category === "bottom";
    const all = [
      { region: "Chest", fit: solver.regions.chest.fit },
      { region: "Waist", fit: solver.regions.waist.fit },
      ...(isBottom ? [] : [{ region: "Shoulder", fit: solver.regions.shoulder.fit }]),
      { region: "Length", fit: solver.regions.length.fit },
      ...(isBottom ? [] : [{ region: "Sleeve", fit: solver.regions.sleeve.fit }]),
    ];
    return all.map((r) => ({ ...r, tone: toneOf(r.region, r.fit) }));
  }, [solver, fitMap.category]);

  const [state, setState] = useState<CanvasTryOnState>({
    stage: "idle",
    imageUrl: null,
    source: null,
    poseDegraded,
    poseSource,
    solver,
    fitChips,
    error: null,
  });

  const runIdRef = useRef(0);

  // ── PRIMARY canvas pipeline ─────────────────────────────────────────────
  useEffect(() => {
    if (!args.enabled || !args.productImageUrl || !args.selectedSize) return;
    const runId = ++runIdRef.current;
    let cancelled = false;

    const hardTimer = window.setTimeout(() => {
      if (cancelled || runIdRef.current !== runId) return;
      // Force-finish: at the very least surface raw garment + silhouette.
      console.warn("[useCanvasTryOn] HARD_TIMEOUT — forcing fallback render");
      void renderFallback();
    }, HARD_TIMEOUT_MS);

    const renderFallback = async () => {
      try {
        const composite = await composeFitImage({
          bodyImageUrl: args.userImageUrl ?? null,
          garmentImageUrl: args.productImageUrl,
          pose,
          frame,
          solver,
          productCategory: args.productCategory ?? null,
        });
        if (cancelled || runIdRef.current !== runId) return;
        setState({
          stage: "ready",
          imageUrl: composite.dataUrl,
          source: "canvas",
          poseDegraded,
          poseSource,
          solver,
          fitChips,
          error: null,
        });
      } catch (err) {
        if (cancelled || runIdRef.current !== runId) return;
        setState((s) => ({
          ...s,
          stage: "ready",
          imageUrl: args.productImageUrl, // last-ditch
          source: "canvas",
          error: err instanceof Error ? err.message : "composite_failed",
          solver,
          fitChips,
          poseDegraded,
          poseSource,
        }));
      }
    };

    (async () => {
      try {
        setState((s) => ({
          ...s,
          stage: "pose",
          poseDegraded,
          poseSource,
          solver,
          fitChips,
        }));

        // ── CUTOUT ────────────────────────────────────────────────────────
        setState((s) => ({ ...s, stage: "cutout" }));
        const cutoutUrl = await getGarmentCutout(args.productImageUrl, args.productName);

        // ── COMPOSITE ─────────────────────────────────────────────────────
        setState((s) => ({ ...s, stage: "composite" }));
        const composite = await composeFitImage({
          bodyImageUrl: args.userImageUrl ?? null,
          garmentImageUrl: cutoutUrl,
          pose,
          frame,
          solver,
          productCategory: args.productCategory ?? null,
        });

        if (cancelled || runIdRef.current !== runId) return;
        setState({
          stage: "ready",
          imageUrl: composite.dataUrl,
          source: "canvas",
          poseDegraded,
          poseSource,
          solver,
          fitChips,
          error: null,
        });
      } catch (err) {
        if (cancelled || runIdRef.current !== runId) return;
        console.warn("[useCanvasTryOn] pipeline error → fallback", err);
        await renderFallback();
      } finally {
        window.clearTimeout(hardTimer);
      }
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(hardTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    args.enabled,
    args.productKey,
    args.selectedSize,
    args.productImageUrl,
    args.userImageUrl,
    args.reloadToken,
    pose.leftShoulder.x,
    pose.rightShoulder.x,
    pose.leftHip.y,
    bodyProfile.shoulderRatio,
    bodyProfile.chestRatio,
  ]);

  // ── PRIMARY AI try-on (photo path) — runs IN PARALLEL with the canvas ───
  // When the user has a body photo, this is the HERO output. We kick it off
  // immediately on mount/size-change and swap as soon as it lands, even if
  // the canvas has already rendered. Window is generous (25s) so realistic
  // IDM-VTON cold starts still win the swap.
  useEffect(() => {
    if (!args.enableAiSwap) return;
    if (!args.enabled || !args.productImageUrl || !args.selectedSize) return;
    if (!args.userImageUrl) return; // no photo → AI path skipped, canvas stays
    if (state.source === "ai") return; // already have AI result for this size

    let cancelled = false;
    const startedAt = Date.now();
    // Mark as refining so the UI shows the "ENHANCING" pill the moment the
    // canvas is up. If the canvas isn't ready yet, the skeleton already covers.
    setState((s) =>
      s.stage === "ready" ? { ...s, stage: "refining" } : s
    );

    const regions = [
      { region: "Chest", fit: solver.regions.chest.fit },
      { region: "Waist", fit: solver.regions.waist.fit },
      { region: "Shoulder", fit: solver.regions.shoulder.fit },
      { region: "Length", fit: solver.regions.length.fit },
      { region: "Sleeve", fit: solver.regions.sleeve.fit },
    ];

    (async () => {
      try {
        console.log("[FIT_AI] start", {
          productKey: args.productKey,
          size: args.selectedSize,
          hasUserImage: !!args.userImageUrl,
        });
        const { data, error } = await supabase.functions.invoke("fit-tryon-router", {
          body: {
            userImageUrl: args.userImageUrl,
            productImageUrl: args.productImageUrl,
            productKey: args.productKey,
            productCategory: args.productCategory ?? undefined,
            selectedSize: args.selectedSize,
            fitDescriptor: solver.fitType,
            regions,
            mode: "high",
          },
        });
        const elapsed = Date.now() - startedAt;
        console.log("[FIT_AI] response", {
          elapsedMs: elapsed,
          hasError: !!error,
          ok: data?.ok,
          imageUrl: data?.imageUrl ? `${String(data.imageUrl).slice(0, 80)}…` : null,
          provider: data?.provider,
        });
        if (cancelled) return;
        if (!error && data?.ok && data?.imageUrl) {
          console.log("[FIT_AI] SWAP → AI result applied");
          // CRITICAL: force-swap regardless of current stage. The AI hero
          // always wins over the canvas fallback once it lands.
          setState((s) => ({
            ...s,
            stage: "ready",
            imageUrl: data.imageUrl,
            source: "ai",
            error: null,
          }));
          return;
        }
        // Failed or non-ok — keep whatever the canvas produced.
        console.warn("[FIT_AI] no AI image, keeping canvas fallback", { error, data });
        setState((s) => (s.stage === "refining" ? { ...s, stage: "ready" } : s));
      } catch (err) {
        if (cancelled) return;
        console.warn("[FIT_AI] invoke threw, keeping canvas fallback", err);
        setState((s) => (s.stage === "refining" ? { ...s, stage: "ready" } : s));
      }
    })();

    const swapTimer = window.setTimeout(() => {
      if (cancelled) return;
      setState((s) => (s.stage === "refining" ? { ...s, stage: "ready" } : s));
    }, AI_SWAP_WINDOW_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(swapTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    args.enableAiSwap,
    args.enabled,
    args.productKey,
    args.selectedSize,
    args.userImageUrl,
    args.reloadToken,
  ]);

  return state;
}
