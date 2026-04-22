// ─── useCanvasTryOn — DETERMINISTIC FIT STATE MACHINE ──────────────────────
// Preview priority:
//   AI result → composite canvas → fallback canvas → local placeholder → loading
//
// The UI must never gate image rendering on a single terminal stage. Any valid
// preview source should render immediately, with AI swapping in later.

import { useEffect, useMemo, useRef, useState } from "react";
import { useBodyKeypoints } from "@/hooks/useBodyKeypoints";
import { buildBodyProfile } from "@/lib/fit/buildBodyProfile";
import { buildGarmentFitMap } from "@/lib/fit/buildGarmentFitMap";
import { solveFit, type SolverResult } from "@/lib/fit/fitSolver";
import { getGarmentCutout } from "@/lib/fit/garmentCutoutCache";
import { composeFitImage } from "@/lib/fit/canvasFitCompositor";
import { useReplicateTryOn } from "@/hooks/useReplicateTryOn";

export type CanvasTryOnStage =
  | "idle"
  | "preparing"
  | "compositing"
  | "polling_ai"
  | "fallback_ready"
  | "ai_ready"
  | "error";

export interface CanvasTryOnState {
  stage: CanvasTryOnStage;
  imageUrl: string | null;
  previewSrc: string | null;
  shouldRenderPreview: boolean;
  aiImageUrl: string | null;
  compositeImageUrl: string | null;
  fallbackImageUrl: string | null;
  localPlaceholderUrl: string | null;
  source: "canvas" | "ai" | "placeholder" | null;
  poseDegraded: boolean;
  poseSource: "mediapipe" | "synthetic";
  solver: SolverResult | null;
  /** Per-region fit chips for the UI. */
  fitChips: Array<{ region: string; fit: string; tone: "tight" | "regular" | "loose" }>;
  error: string | null;
  requestId: string | null;
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
  reloadToken?: number;
  enableAiSwap?: boolean;
}

const HARD_TIMEOUT_MS = 2_500;
// 50s — must exceed router SERVER_TIMEOUT_MS (35s) plus network round-trip.
const AI_SWAP_WINDOW_MS = 50_000;
const AI_STATUS_POLL_MS = 2_500;
const AI_STATUS_MAX_POLLS = 24;

const toneOf = (region: string, fit: string): "tight" | "regular" | "loose" => {
  if (/(tight|snug|pulled|trim|short)/i.test(fit)) return "tight";
  if (/(loose|oversized|relaxed|roomy|dropped|long)/i.test(fit)) return "loose";
  return "regular";
};

const escapeSvgText = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;");

const summarizeUrl = (value: string | null | undefined) => {
  if (!value) return null;
  if (value.startsWith("data:")) return `${value.slice(0, 36)}…`;
  if (value.startsWith("blob:")) return `${value.slice(0, 36)}…`;
  return value.length > 120 ? `${value.slice(0, 120)}…` : value;
};

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

function derivePreviewState(state: CanvasTryOnState): CanvasTryOnState {
  const previewSrc =
    state.aiImageUrl ||
    state.compositeImageUrl ||
    state.fallbackImageUrl ||
    state.localPlaceholderUrl ||
    null;

  const source = state.aiImageUrl
    ? "ai"
    : state.compositeImageUrl || state.fallbackImageUrl
    ? "canvas"
    : state.localPlaceholderUrl
    ? "placeholder"
    : null;

  return {
    ...state,
    previewSrc,
    shouldRenderPreview: Boolean(previewSrc),
    imageUrl: previewSrc,
    source,
  };
}

function logFitPreview(event: string, state: CanvasTryOnState) {
  console.log("[FIT_PREVIEW]", {
    event,
    requestId: state.requestId,
    stage: state.stage,
    aiImageUrl: summarizeUrl(state.aiImageUrl),
    compositeImageUrl: summarizeUrl(state.compositeImageUrl),
    fallbackImageUrl: summarizeUrl(state.fallbackImageUrl),
    localPlaceholderUrl: summarizeUrl(state.localPlaceholderUrl),
    previewSrc: summarizeUrl(state.previewSrc),
    shouldRenderPreview: state.shouldRenderPreview,
    source: state.source,
  });
}

function buildInstantPlaceholder(args: {
  activeSize: string;
  frame: ReturnType<typeof useBodyKeypoints>["frame"];
  poseDegraded: boolean;
}) {
  const { activeSize, frame, poseDegraded } = args;
  const shoulderMidX = (frame.leftShoulderX + frame.rightShoulderX) / 2;
  const garmentTopY = frame.shoulderLineY - 18;
  const garmentHemY = frame.hemLineY + 52;
  const garmentLeftX = frame.torsoLeftX - 28;
  const garmentRightX = frame.torsoRightX + 28;
  const garmentWaistLeftX = frame.waistLeftX - 18;
  const garmentWaistRightX = frame.waistRightX + 18;
  const title = poseDegraded ? "Approximate preview" : "Preview ready";
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${frame.canvasWidth} ${frame.canvasHeight}">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="hsl(30 18% 96%)" />
          <stop offset="100%" stop-color="hsl(34 16% 91%)" />
        </linearGradient>
        <linearGradient id="garment" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="hsl(262 34% 56%)" />
          <stop offset="100%" stop-color="hsl(252 28% 42%)" />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#bg)" />
      <ellipse cx="${shoulderMidX}" cy="${frame.shoulderLineY - 128}" rx="68" ry="88" fill="hsla(34 18% 76% / 0.9)" />
      <path d="M ${frame.leftShoulderX} ${frame.shoulderLineY}
               L ${frame.armLeftBox.x} ${frame.armLeftBox.y + frame.armLeftBox.h}
               L ${frame.armLeftBox.x + frame.armLeftBox.w} ${frame.armLeftBox.y + frame.armLeftBox.h}
               L ${frame.waistLeftX} ${frame.hipLineY + 182}
               L ${frame.waistRightX} ${frame.hipLineY + 182}
               L ${frame.armRightBox.x + frame.armRightBox.w} ${frame.armRightBox.y + frame.armRightBox.h}
               L ${frame.armRightBox.x} ${frame.armRightBox.y + frame.armRightBox.h}
               L ${frame.rightShoulderX} ${frame.shoulderLineY} Z"
            fill="hsla(32 12% 68% / 0.68)" />
      <path d="M ${garmentLeftX} ${garmentTopY}
               Q ${shoulderMidX} ${garmentTopY - 18} ${garmentRightX} ${garmentTopY}
               L ${garmentRightX - 12} ${frame.chestLineY + 26}
               L ${garmentWaistRightX} ${frame.waistLineY + 28}
               L ${garmentRightX - 34} ${garmentHemY}
               Q ${shoulderMidX} ${garmentHemY + 24} ${garmentLeftX + 34} ${garmentHemY}
               L ${garmentWaistLeftX} ${frame.waistLineY + 28}
               L ${garmentLeftX + 12} ${frame.chestLineY + 26} Z"
            fill="url(#garment)" opacity="0.92" />
      <path d="M ${garmentLeftX + 44} ${frame.chestLineY + 40} Q ${shoulderMidX} ${frame.waistLineY} ${garmentRightX - 44} ${frame.chestLineY + 40}"
            stroke="hsla(0 0% 100% / 0.18)" stroke-width="10" fill="none" stroke-linecap="round" />
      <rect x="34" y="36" width="220" height="70" rx="35" fill="hsla(0 0% 100% / 0.62)" />
      <text x="62" y="64" font-size="18" font-family="Arial, sans-serif" font-weight="700" letter-spacing="3" fill="hsl(252 18% 28%)">SIZE ${escapeSvgText(activeSize.toUpperCase())}</text>
      <text x="62" y="89" font-size="16" font-family="Arial, sans-serif" fill="hsla(252 18% 28% / 0.72)">${escapeSvgText(title)}</text>
    </svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

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

  const { createTryOn, pollTryOnStatus } = useReplicateTryOn();

  const [state, setState] = useState<CanvasTryOnState>(() =>
    derivePreviewState({
      stage: "idle",
      imageUrl: null,
      previewSrc: null,
      shouldRenderPreview: false,
      aiImageUrl: null,
      compositeImageUrl: null,
      fallbackImageUrl: null,
      localPlaceholderUrl: null,
      source: null,
      poseDegraded,
      poseSource,
      solver,
      fitChips,
      error: null,
      requestId: null,
    })
  );

  // ── Deterministic request identity ──────────────────────────────────────
  // BOTH effects (composite + AI swap) compute the same requestId from the
  // same args. Previously the AI effect captured `activeRequestRef.current`
  // at fire-time, which could be stale or differ from the composite effect's
  // id, causing all later state commits to be silently dropped by the
  // `prev.requestId !== requestId` guard — the "works once only" bug.
  const requestId = useMemo(
    () =>
      args.enabled && args.productImageUrl && args.selectedSize
        ? `${args.productKey}::${args.selectedSize}::${args.reloadToken ?? 0}::${args.userImageUrl ?? "no-body"}`
        : null,
    [args.enabled, args.productKey, args.selectedSize, args.productImageUrl, args.userImageUrl, args.reloadToken]
  );

  const runIdRef = useRef(0);
  const aiLockedRef = useRef<string | null>(null); // requestId for which AI succeeded
  const activeRequestRef = useRef<string | null>(null);
  const aiInFlightRef = useRef<string | null>(null); // requestId currently being AI-requested

  useEffect(() => {
    if (!args.enabled || !args.productImageUrl || !args.selectedSize || !requestId) {
      setState((prev) =>
        derivePreviewState({
          ...prev,
          stage: "idle",
          aiImageUrl: null,
          compositeImageUrl: null,
          fallbackImageUrl: null,
          localPlaceholderUrl: null,
          error: null,
          requestId: null,
          poseDegraded,
          poseSource,
          solver,
          fitChips,
        })
      );
      return;
    }

    const runId = ++runIdRef.current;
    const previousRequestId = activeRequestRef.current;
    activeRequestRef.current = requestId;
    // Only reset the AI lock if requestId actually changed (new product/size/body).
    // This prevents losing a valid AI image when solver/frame recompute.
    if (previousRequestId !== requestId) {
      aiLockedRef.current = null;
    }
    let cancelled = false;

    const commitState = (event: string, partial: Partial<CanvasTryOnState>) => {
      if (cancelled || activeRequestRef.current !== requestId) return;
      setState((prev) => {
        const merged = derivePreviewState({
          ...prev,
          ...partial,
          poseDegraded,
          poseSource,
          solver,
          fitChips,
          requestId,
        } as CanvasTryOnState);

        const next = !merged.previewSrc && prev.requestId === requestId && prev.previewSrc
          ? derivePreviewState({
              ...merged,
              aiImageUrl: merged.aiImageUrl ?? prev.aiImageUrl,
              compositeImageUrl: merged.compositeImageUrl ?? prev.compositeImageUrl,
              fallbackImageUrl: merged.fallbackImageUrl ?? prev.fallbackImageUrl,
              localPlaceholderUrl: merged.localPlaceholderUrl ?? prev.localPlaceholderUrl,
            })
          : merged;

        logFitPreview(event, next);
        return next;
      });
    };

    const immediatePlaceholder = buildInstantPlaceholder({
      activeSize: args.selectedSize,
      frame,
      poseDegraded,
    });

    commitState("selection_change", {
      stage: "preparing",
      aiImageUrl: null,
      compositeImageUrl: null,
      fallbackImageUrl: null,
      localPlaceholderUrl: immediatePlaceholder,
      error: null,
    });

    const renderFallback = async () => {
      commitState("fallback_compositing_start", { stage: "compositing" });
      try {
        const composite = await composeFitImage({
          bodyImageUrl: args.userImageUrl ?? null,
          garmentImageUrl: args.productImageUrl,
          pose,
          frame,
          solver,
          productCategory: args.productCategory ?? null,
        });
        if (cancelled || activeRequestRef.current !== requestId || aiLockedRef.current) return;
        commitState("fallback_ready", {
          stage: "fallback_ready",
          fallbackImageUrl: composite.dataUrl,
          error: null,
        });
      } catch (err) {
        if (cancelled || activeRequestRef.current !== requestId || aiLockedRef.current) return;
        commitState("fallback_failed_keep_garment", {
          stage: "fallback_ready",
          fallbackImageUrl: args.productImageUrl,
          error: err instanceof Error ? err.message : "composite_failed",
        });
      }
    };

    const hardTimer = window.setTimeout(() => {
      if (cancelled || activeRequestRef.current !== requestId || aiLockedRef.current) return;
      console.warn("[useCanvasTryOn] HARD_TIMEOUT — forcing fallback render", { requestId });
      void renderFallback();
    }, HARD_TIMEOUT_MS);

    void renderFallback();

    (async () => {
      try {
        commitState("cutout_pipeline_start", { stage: "compositing" });
        const cutoutUrl = await getGarmentCutout(args.productImageUrl, args.productName);
        const composite = await composeFitImage({
          bodyImageUrl: args.userImageUrl ?? null,
          garmentImageUrl: cutoutUrl,
          pose,
          frame,
          solver,
          productCategory: args.productCategory ?? null,
        });

        if (cancelled || activeRequestRef.current !== requestId || aiLockedRef.current) return;
        commitState("composite_ready", {
          stage: "fallback_ready",
          compositeImageUrl: composite.dataUrl,
          error: null,
        });
      } catch (err) {
        if (cancelled || activeRequestRef.current !== requestId || aiLockedRef.current) return;
        console.warn("[useCanvasTryOn] cutout/composite pipeline error — keeping available preview", err);
        setState((prev) => {
          if (prev.requestId !== requestId) return prev;
          const next = derivePreviewState({
            ...prev,
            stage: prev.previewSrc ? "fallback_ready" : "error",
            error: err instanceof Error ? err.message : "composite_pipeline_failed",
          });
          logFitPreview("composite_failed_keep_best_available", next);
          return next;
        });
      } finally {
        window.clearTimeout(hardTimer);
      }
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(hardTimer);
    };
    // Composite effect keys ONLY on requestId + product name. Volatile
    // recomputed objects (pose/frame/solver/fitChips) are captured at
    // fire-time via closure. Including them in deps caused the effect to
    // re-fire on every body recompute, which ran `selection_change` and
    // wiped `aiImageUrl: null` — the root of the "works once" bug.
  }, [requestId, args.productName]);

  // Keep pose/solver/fitChips visible in state without re-running the
  // composite pipeline. Pure passthrough — does not touch image URLs.
  useEffect(() => {
    setState((prev) => derivePreviewState({ ...prev, poseDegraded, poseSource, solver, fitChips }));
  }, [poseDegraded, poseSource, solver, fitChips]);

  // Capture latest solver/regions in a ref so we can read them inside the AI
  // effect WITHOUT putting `solver` in the deps. Solver is recomputed on
  // every body/fit recalc (new object reference) and re-firing the AI effect
  // on every recompute is what caused duplicate AI calls + the
  // "works once only" race where stale requestId state writes were dropped.
  const solverRef = useRef(solver);
  useEffect(() => {
    solverRef.current = solver;
  }, [solver]);

  useEffect(() => {
    if (!args.enableAiSwap) return;
    if (!args.enabled || !args.productImageUrl || !args.selectedSize) return;
    if (!args.userImageUrl) return;
    if (!requestId) return;

    // Skip if AI already succeeded for this exact requestId, OR if there is
    // already an in-flight request for the same id (defensive against
    // double-mount in StrictMode / accidental re-renders).
    if (aiLockedRef.current === requestId) return;
    if (aiInFlightRef.current === requestId) return;
    aiInFlightRef.current = requestId;

    let cancelled = false;
    const startedAt = Date.now();
    const currentSolver = solverRef.current;

    setState((prev) => {
      if (prev.requestId !== requestId) return prev;
      const next = derivePreviewState({
        ...prev,
        stage: prev.previewSrc ? "polling_ai" : "preparing",
      });
      logFitPreview("ai_polling_start", next);
      return next;
    });

    const regions = [
      { region: "Chest", fit: currentSolver.regions.chest.fit },
      { region: "Waist", fit: currentSolver.regions.waist.fit },
      { region: "Shoulder", fit: currentSolver.regions.shoulder.fit },
      { region: "Length", fit: currentSolver.regions.length.fit },
      { region: "Sleeve", fit: currentSolver.regions.sleeve.fit },
    ];

    (async () => {
      try {
        console.log("[FIT_PREVIEW]", {
          event: "ai_request_start",
          requestId,
          productKey: args.productKey,
          size: args.selectedSize,
          hasUserImage: !!args.userImageUrl,
        });
        const { data, error } = await createTryOn({
          userImageUrl: args.userImageUrl,
          productImageUrl: args.productImageUrl,
          productKey: args.productKey,
          productCategory: args.productCategory ?? undefined,
          selectedSize: args.selectedSize,
          fitDescriptor: currentSolver.fitType,
          regions,
          mode: "high",
        });
        const successData = data?.ok ? data : null;
        const asyncData = data && !data.ok && (data.code === "pending" || data.code === "rate_limited") ? data : null;
        const failureData = data && !data.ok && !asyncData ? data : null;
        const elapsed = Date.now() - startedAt;
        console.log("[FIT_PREVIEW]", {
          event: "ai_response",
          requestId,
          elapsedMs: elapsed,
          hasError: !!error,
          ok: data?.ok,
          imageUrl: summarizeUrl(successData?.imageUrl ?? null),
          provider: data?.provider,
        });
        if (cancelled || activeRequestRef.current !== requestId) return;
        if (!error && successData?.imageUrl) {
          aiLockedRef.current = requestId;
          setState((prev) => {
            if (prev.requestId !== requestId) return prev;
            const next = derivePreviewState({
              ...prev,
              stage: "ai_ready",
              aiImageUrl: successData.imageUrl,
              error: null,
            });
            logFitPreview("ai_ready", next);
            return next;
          });
          return;
        }
        if (!error && asyncData) {
          const pollRequestId = asyncData.requestId ?? null;
          const predictionId = asyncData.predictionId ?? null;
          const initialDelay = typeof asyncData.retryAfterMs === "number" && asyncData.retryAfterMs > 0 ? Math.min(asyncData.retryAfterMs, 15_000) : AI_STATUS_POLL_MS;

          for (let attempt = 0; attempt < AI_STATUS_MAX_POLLS; attempt++) {
            if (cancelled || activeRequestRef.current !== requestId) return;
            await wait(attempt === 0 ? initialDelay : AI_STATUS_POLL_MS);
            if (cancelled || activeRequestRef.current !== requestId) return;

            const { data: statusData, error: statusError } = await pollTryOnStatus({
              requestId: pollRequestId,
              predictionId,
              selectedSize: args.selectedSize,
            });

            const statusSuccess = statusData?.ok ? statusData : null;
            const statusAsync = statusData && !statusData.ok && (statusData.code === "pending" || statusData.code === "rate_limited") ? statusData : null;
            console.log("[FIT_PREVIEW]", {
              event: "ai_status_response",
              requestId,
              attempt,
              hasError: !!statusError,
              code: statusAsync?.code,
              status: statusData?.status,
              imageUrl: summarizeUrl(statusSuccess?.imageUrl ?? null),
            });

            if (cancelled || activeRequestRef.current !== requestId) return;

            if (!statusError && statusSuccess?.imageUrl) {
              aiLockedRef.current = requestId;
              setState((prev) => {
                if (prev.requestId !== requestId) return prev;
                const next = derivePreviewState({
                  ...prev,
                  stage: "ai_ready",
                  aiImageUrl: statusSuccess.imageUrl,
                  error: null,
                });
                logFitPreview("ai_ready_after_poll", next);
                return next;
              });
              return;
            }

            const statusCode = statusAsync?.code;
            if (statusError || (statusCode && !["pending", "rate_limited"].includes(statusCode))) {
              break;
            }
          }
        }
        setState((prev) => {
          if (prev.requestId !== requestId) return prev;
          const next = derivePreviewState({
            ...prev,
            stage: prev.previewSrc ? "fallback_ready" : "error",
            error: prev.previewSrc ? prev.error : error?.message ?? failureData?.error ?? asyncData?.error ?? "ai_unavailable",
          });
          logFitPreview("ai_unavailable_keep_best_preview", next);
          return next;
        });
      } catch (err) {
        if (cancelled || activeRequestRef.current !== requestId) return;
        setState((prev) => {
          if (prev.requestId !== requestId) return prev;
          const next = derivePreviewState({
            ...prev,
            stage: prev.previewSrc ? "fallback_ready" : "error",
            error: prev.previewSrc ? prev.error : err instanceof Error ? err.message : "ai_unavailable",
          });
          logFitPreview("ai_error_keep_best_preview", next);
          return next;
        });
      } finally {
        if (aiInFlightRef.current === requestId) {
          aiInFlightRef.current = null;
        }
      }
    })();

    const swapTimer = window.setTimeout(() => {
      if (cancelled || aiLockedRef.current === requestId || activeRequestRef.current !== requestId) return;
      setState((prev) => {
        if (prev.requestId !== requestId) return prev;
        const next = derivePreviewState({
          ...prev,
          stage: prev.previewSrc ? "fallback_ready" : "error",
        });
        logFitPreview("ai_swap_window_expired_keep_best_preview", next);
        return next;
      });
    }, AI_SWAP_WINDOW_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(swapTimer);
      if (aiInFlightRef.current === requestId) {
        aiInFlightRef.current = null;
      }
    };
    // IMPORTANT: deps are intentionally minimal. `solver`, `fitChips`, `frame`,
    // pose, etc. are NOT here — they're captured via solverRef and recompute
    // on every body change, which would re-fire the AI effect and either
    // duplicate the request or invalidate the requestId mid-poll.
  }, [requestId, args.enableAiSwap, createTryOn, pollTryOnStatus]);


  return state;
}
