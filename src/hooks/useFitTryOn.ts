// ─── useFitTryOn ────────────────────────────────────────────────────────────
// Direct AI fitting pipeline. Replaces the old canvas-composite intermediate
// preview. There are exactly three user-visible states:
//
//   1. loading   — generating final AI fit image (with progress / spinner)
//   2. ready     — final AI image, served from a persistent storage URL
//   3. failed    — error + retry CTA. Last good image (if any) is preserved.
//
// We never render a half-composited "floating garment" image as the main
// result. The fit-tryon-router edge function persists every successful
// generation to the `fit-composites` storage bucket and returns a stable URL
// — so the same result renders identically in preview, new windows, and on
// any device.

import { useCallback, useEffect, useRef, useState } from "react";
import { useReplicateTryOn } from "./useReplicateTryOn";
import { evaluateFitQuality, type QualityVerdict } from "@/lib/fit/fitQualityControl";
import { abortAllStaleForRender, registerAbort } from "@/lib/fit/fitPriorityQueue";

export type FitTryOnStage = "idle" | "generating" | "polling" | "validating" | "ready" | "failed";

export interface FitTryOnState {
  stage: FitTryOnStage;
  imageUrl: string | null;          // current best image (last good or new)
  lastGoodImageUrl: string | null;  // sticky — preserved across retries
  error: string | null;
  provider: string | null;
  requestId: string | null;
  retryAfterMs: number | null;
  isUsingStableRenderMode: boolean;
  /** V3.7 — quality control verdict for the current image. */
  qualityVerdict: QualityVerdict | null;
  /** V3.7 — true when QC failed twice and we are showing an unstable preview. */
  qualityUnstable: boolean;
}

export interface UseFitTryOnArgs {
  enabled: boolean;
  productKey: string;
  productImageUrl: string | null | undefined;
  productName: string;
  productCategory?: string | null;
  selectedSize: string;
  userImageUrl: string | null | undefined;
  fitDescriptor?: string;
  regions?: Array<{ region: string; fit: string }>;
  bodyProfileSummary?: {
    heightCm?: number | null;
    weightKg?: number | null;
    build?: string | null;
    gender?: string | null;
    bodyType?: string | null;
    shoulderCm?: number | null;
    chestCm?: number | null;
    waistCm?: number | null;
    hipCm?: number | null;
    armLengthCm?: number | null;
    inseamCm?: number | null;
    userBodyImageUrl?: string | null;
  };
  /** Pre-computed baseline verdict (gender+weight → expected size). */
  baselineVerdict?: {
    baseline?: string;
    offset?: number;
    verdict?: string;
    consequence?: string;
    fallbackMode?: boolean;
  };
  reloadToken?: number;
  /** V3.9 — gendered sizing directive (cross-gender warnings, target gender). */
  genderDirective?: string;
  genderedSizing?: {
    targetGender?: string;
    isCrossGender?: boolean;
    sizeSystem?: string;
    confidence?: string;
  };
}

// Faster perceived speed: poll every 1s instead of 2.5s, and fire the first
// status check immediately (no 2.5s blind wait) so quick generations surface
// the moment they're ready. Pipeline / model / timeouts unchanged.
const POLL_INTERVAL_MS = 1_000;
const POLL_MAX_ATTEMPTS = 100;      // same ~100s worst case window
const HARD_TIMEOUT_MS = 110_000;    // never let it hang forever

export function useFitTryOn(args: UseFitTryOnArgs): FitTryOnState & {
  retry: () => void;
} {
  const { createTryOn, pollTryOnStatus } = useReplicateTryOn();

  const [state, setState] = useState<FitTryOnState>({
    stage: "idle",
    imageUrl: null,
    lastGoodImageUrl: null,
    error: null,
    provider: null,
    requestId: null,
    retryAfterMs: null,
    isUsingStableRenderMode: false,
    qualityVerdict: null,
    qualityUnstable: false,
  });

  const runIdRef = useRef(0);
  const pollTimerRef = useRef<number | null>(null);
  const hardTimerRef = useRef<number | null>(null);
  const qcAttemptRef = useRef(0);
  const [manualReload, setManualReload] = useState(0);

  const stopTimers = useCallback(() => {
    if (pollTimerRef.current) {
      window.clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    if (hardTimerRef.current) {
      window.clearTimeout(hardTimerRef.current);
      hardTimerRef.current = null;
    }
  }, []);

  // Stable identity for the current generation request. Changing inputs starts
  // a fresh generation. `manualReload` lets the UI force-retry.
  // NOTE: `userImageUrl` is OPTIONAL in studio mode — the AI fit only needs
  // body proportions (height/weight) + the product image. Public visitors and
  // logged-in users without a body scan can still get a final AI fitting.
  const requestKey =
    args.enabled &&
    args.productImageUrl &&
    args.selectedSize
      ? `${args.productKey}::${args.selectedSize}::${args.userImageUrl ?? "no-photo"}::${args.reloadToken ?? 0}::${manualReload}`
      : null;

  // Reset QC retry counter when the underlying product/size/body changes
  // (a true new request — not an internal auto-rerender via manualReload).
  const baseKey = `${args.productKey}::${args.selectedSize}::${args.userImageUrl ?? "no-photo"}::${args.reloadToken ?? 0}`;
  const lastBaseKeyRef = useRef<string | null>(null);
  if (lastBaseKeyRef.current !== baseKey) {
    lastBaseKeyRef.current = baseKey;
    qcAttemptRef.current = 0;
  }

  useEffect(() => {
    stopTimers();
    // V4.0 — latest visible request wins. Cancels any in-flight prewarm AND
    // any older render so size flips (S→M→L) don't pile up duplicate work.
    abortAllStaleForRender();
    const renderCtrl = registerAbort("render");

    if (!requestKey || !args.productImageUrl) {
      setState((prev) => ({
        ...prev,
        stage: "idle",
        error: null,
        // Keep lastGoodImageUrl so reopening the same product still shows it.
        imageUrl: prev.lastGoodImageUrl,
        isUsingStableRenderMode: false,
      }));
      return;
    }

    const runId = ++runIdRef.current;
    let cancelled = false;

    const log = (event: string, payload: Record<string, unknown> = {}) => {
      console.log("[FIT_TRYON]", {
        event,
        requestKey,
        runId,
        ua: typeof navigator !== "undefined" ? navigator.userAgent : null,
        ...payload,
      });
    };

    const isStale = () => cancelled || runIdRef.current !== runId;

    setState((prev) => ({
      stage: "generating",
      imageUrl: prev.lastGoodImageUrl, // keep the last good frame visible
      lastGoodImageUrl: prev.lastGoodImageUrl,
      error: null,
      provider: null,
      requestId: null,
      retryAfterMs: null,
      isUsingStableRenderMode: false,
      qualityVerdict: null,
      qualityUnstable: false,
    }));

    const acceptOrRetry = async (
      persistentUrl: string,
      provider: string | null,
      requestId: string | null,
    ) => {
      if (isStale()) return;
      // V3.7 — quality control gate: validate body consistency + visual integrity.
      setState((prev) => ({
        ...prev,
        stage: "validating",
        imageUrl: persistentUrl,
        provider,
        requestId,
      }));
      let verdict: QualityVerdict | null = null;
      try {
        verdict = await evaluateFitQuality(args.userImageUrl ?? null, persistentUrl);
      } catch {
        verdict = null;
      }
      if (isStale()) return;
      log("qc_done", {
        body: verdict?.bodyConsistencyScore,
        visual: verdict?.visualIntegrityScore,
        reason: verdict?.reason,
      });
      const failed = !!verdict?.shouldRerender;
      if (failed && qcAttemptRef.current === 0) {
        qcAttemptRef.current = 1;
        log("qc_auto_rerender", { reason: verdict?.reason });
        // Force a fresh generation with the stronger body-lock prompt by
        // bumping manualReload — router bypasses cache when forceRegenerate
        // is on (handled in the create body below).
        setManualReload((n) => n + 1);
        return;
      }
      const unstable = failed && qcAttemptRef.current >= 1;
      setState({
        stage: "ready",
        imageUrl: persistentUrl,
        lastGoodImageUrl: persistentUrl,
        error: null,
        provider,
        requestId,
        retryAfterMs: null,
        isUsingStableRenderMode: false,
        qualityVerdict: verdict,
        qualityUnstable: unstable,
      });
    };

    hardTimerRef.current = window.setTimeout(() => {
      if (isStale()) return;
      stopTimers();
      log("hard_timeout");
      setState((prev) => ({
        ...prev,
        stage: "failed",
        error: "Generation took too long. Please retry.",
          isUsingStableRenderMode: false,
      }));
    }, HARD_TIMEOUT_MS);

    const startPolling = (ids: { requestId?: string | null; predictionId?: string | null }) => {
      let attempts = 0;
      const tick = async () => {
        attempts++;
        if (isStale()) {
          stopTimers();
          return;
        }
        try {
          const { data, error } = await pollTryOnStatus({
            requestId: ids.requestId ?? undefined,
            predictionId: ids.predictionId ?? undefined,
            selectedSize: args.selectedSize,
          });
          if (isStale()) return;
          // Transient edge-runtime hiccups (cold boot / 503 / network) — keep
          // polling instead of failing. The async job on the server is still
          // running and the next tick will pick up the result.
          if (error) {
            const msg = String((error as any)?.message ?? error ?? "");
            const transient =
              msg.includes("SUPABASE_EDGE_RUNTIME_ERROR") ||
              msg.includes("temporarily unavailable") ||
              msg.includes("Failed to fetch") ||
              msg.includes("503") ||
              msg.includes("502") ||
              msg.includes("504");
            if (transient && attempts < POLL_MAX_ATTEMPTS) {
              log("poll_transient_skip", { message: msg });
              return;
            }
            throw error;
          }

          if (data?.ok && data.imageUrl) {
            stopTimers();
            const persistentUrl = data.imageUrl;
            log("ready", { provider: data.provider, urlPrefix: persistentUrl.slice(0, 80) });
            await acceptOrRetry(persistentUrl, data.provider ?? null, data.requestId ?? null);
            return;
          }

          if (data && !data.ok && data.code === "rate_limited") {
            stopTimers();
            log("rate_limited", { retryAfterMs: data.retryAfterMs });
            setState((prev) => ({
              ...prev,
              stage: "failed",
              error: data.error || "Provider busy. Please retry.",
              provider: data.provider ?? null,
              retryAfterMs: data.retryAfterMs ?? null,
              isUsingStableRenderMode: false,
            }));
            return;
          }

          if (data && !data.ok && data.code !== "pending") {
            stopTimers();
            log("poll_failed", { code: data.code, error: data.error });
            const cleanedError = data.error?.startsWith("unstable_fit_render:")
              ? "We couldn't render a clean mannequin preview. Please try again."
              : data.error || "Generation failed.";
            setState((prev) => ({
              ...prev,
              stage: "failed",
              error: cleanedError,
              provider: data.provider ?? null,
              isUsingStableRenderMode: false,
            }));
            return;
          }

          if (attempts >= POLL_MAX_ATTEMPTS) {
            stopTimers();
            log("poll_exhausted");
            setState((prev) => ({
              ...prev,
              stage: "failed",
              error: "Generation took too long. Please retry.",
              isUsingStableRenderMode: false,
            }));
          }
        } catch (e: any) {
          if (isStale()) return;
          stopTimers();
          log("poll_error", { message: e?.message });
          setState((prev) => ({
            ...prev,
            stage: "failed",
            error: e?.message || "Generation failed.",
            isUsingStableRenderMode: false,
          }));
        }
      };
      // Fire first check immediately so fast generations don't wait a full
      // interval before being detected, then poll every POLL_INTERVAL_MS.
      void tick();
      pollTimerRef.current = window.setInterval(tick, POLL_INTERVAL_MS);
    };

    (async () => {
      try {
        log("create_start", {
          productKey: args.productKey,
          size: args.selectedSize,
          hasUserImage: !!args.userImageUrl,
          hasProductImage: !!args.productImageUrl,
        });
        const isQcRetry = qcAttemptRef.current >= 1;
        const { data, error } = await createTryOn({
          userImageUrl: args.userImageUrl ?? undefined,
          productImageUrl: args.productImageUrl ?? undefined,
          productKey: args.productKey,
          productName: args.productName,
          productCategory: args.productCategory ?? undefined,
          selectedSize: args.selectedSize,
          fitDescriptor: args.fitDescriptor,
          regions: args.regions,
          bodyProfileSummary: args.bodyProfileSummary,
          baselineVerdict: args.baselineVerdict,
          mode: "studio",
          // V3.7 — when the previous render failed quality control we ask the
          // router to bypass cache and use the stronger body-lock prompt.
          forceRegenerate: isQcRetry || undefined,
          safeMode: isQcRetry || undefined,
          // V3.9 — gendered sizing context.
          genderDirective: args.genderDirective,
          genderedSizing: args.genderedSizing,
        });
        if (isStale()) return;
        if (error) throw error;

        if (data?.ok && data.imageUrl) {
          stopTimers();
          const persistentUrl = data.imageUrl;
          log("create_ready", { provider: data.provider, urlPrefix: persistentUrl.slice(0, 80) });
          await acceptOrRetry(persistentUrl, data.provider ?? null, data.requestId ?? null);
          return;
        }

        if (data && !data.ok && data.code === "rate_limited") {
          stopTimers();
          const retryAfterMs = Math.min(Math.max(data.retryAfterMs ?? 6000, 4000), 12000);
          log("create_rate_limited_auto_retry", { retryAfterMs });
          // Auto-retry once after the provider's suggested cooldown so the
          // user doesn't see a spurious failure when two windows / two clicks
          // hit the provider at the same time.
          setState((prev) => ({
            ...prev,
            stage: "polling",
            provider: data.provider ?? null,
              retryAfterMs,
              isUsingStableRenderMode: false,
          }));
          window.setTimeout(() => {
            if (isStale()) return;
            setManualReload((n) => n + 1);
          }, retryAfterMs);
          return;
        }

        if (data && !data.ok && data.code === "pending") {
          log("create_pending", { requestId: data.requestId, predictionId: data.predictionId });
          setState((prev) => ({
            ...prev,
            stage: "polling",
            provider: data.provider ?? null,
            requestId: data.requestId ?? null,
            isUsingStableRenderMode: false,
          }));
          startPolling({
            requestId: data.requestId ?? null,
            predictionId: data.predictionId ?? null,
          });
          return;
        }

        if (data && !data.ok) {
          stopTimers();
          log("create_failed", { code: data.code, error: data.error });
          setState((prev) => ({
            ...prev,
            stage: "failed",
            error: data.error || "Generation failed.",
            provider: data.provider ?? null,
              isUsingStableRenderMode: false,
          }));
          return;
        }

        throw new Error("No data returned from try-on service");
      } catch (e: any) {
        if (isStale()) return;
        stopTimers();
        log("create_error", { message: e?.message });
        const cleanedError = typeof e?.message === "string" && e.message.startsWith("unstable_fit_render:")
          ? "We couldn't render a clean mannequin preview. Please try again."
          : e?.message || "Generation failed.";
        setState((prev) => ({
          ...prev,
          stage: "failed",
          error: cleanedError,
          isUsingStableRenderMode: false,
        }));
      }
    })();

    return () => {
      cancelled = true;
      stopTimers();
      try { renderCtrl.abort(); } catch { /* ignore */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);

  const retry = useCallback(() => {
    qcAttemptRef.current = 0;
    setManualReload((n) => n + 1);
  }, []);

  return { ...state, retry };
}
