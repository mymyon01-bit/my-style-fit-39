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

export type FitTryOnStage = "idle" | "generating" | "polling" | "ready" | "failed";

export interface FitTryOnState {
  stage: FitTryOnStage;
  imageUrl: string | null;          // current best image (last good or new)
  lastGoodImageUrl: string | null;  // sticky — preserved across retries
  error: string | null;
  provider: string | null;
  requestId: string | null;
  retryAfterMs: number | null;
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
  };
  reloadToken?: number;
}

const POLL_INTERVAL_MS = 2_500;
const POLL_MAX_ATTEMPTS = 40;       // ~100s worst case
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
  });

  const runIdRef = useRef(0);
  const pollTimerRef = useRef<number | null>(null);
  const hardTimerRef = useRef<number | null>(null);
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
  const requestKey =
    args.enabled &&
    args.productImageUrl &&
    args.userImageUrl &&
    args.selectedSize
      ? `${args.productKey}::${args.selectedSize}::${args.userImageUrl}::${args.reloadToken ?? 0}::${manualReload}`
      : null;

  useEffect(() => {
    stopTimers();

    if (!requestKey || !args.productImageUrl || !args.userImageUrl) {
      setState((prev) => ({
        ...prev,
        stage: "idle",
        error: null,
        // Keep lastGoodImageUrl so reopening the same product still shows it.
        imageUrl: prev.lastGoodImageUrl,
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
    }));

    hardTimerRef.current = window.setTimeout(() => {
      if (isStale()) return;
      stopTimers();
      log("hard_timeout");
      setState((prev) => ({
        ...prev,
        stage: "failed",
        error: "Generation took too long. Please retry.",
      }));
    }, HARD_TIMEOUT_MS);

    const startPolling = (ids: { requestId?: string | null; predictionId?: string | null }) => {
      let attempts = 0;
      pollTimerRef.current = window.setInterval(async () => {
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
          if (error) throw error;

          if (data?.ok && data.imageUrl) {
            stopTimers();
            const persistentUrl = data.imageUrl;
            log("ready", { provider: data.provider, urlPrefix: persistentUrl.slice(0, 80) });
            setState({
              stage: "ready",
              imageUrl: persistentUrl,
              lastGoodImageUrl: persistentUrl,
              error: null,
              provider: data.provider ?? null,
              requestId: data.requestId ?? null,
              retryAfterMs: null,
            });
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
            }));
            return;
          }

          if (data && !data.ok && data.code !== "pending") {
            stopTimers();
            log("poll_failed", { code: data.code, error: data.error });
            setState((prev) => ({
              ...prev,
              stage: "failed",
              error: data.error || "Generation failed.",
              provider: data.provider ?? null,
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
          }));
        }
      }, POLL_INTERVAL_MS);
    };

    (async () => {
      try {
        log("create_start", {
          productKey: args.productKey,
          size: args.selectedSize,
          hasUserImage: !!args.userImageUrl,
          hasProductImage: !!args.productImageUrl,
        });
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
          mode: "studio",
        });
        if (isStale()) return;
        if (error) throw error;

        if (data?.ok && data.imageUrl) {
          stopTimers();
          const persistentUrl = data.imageUrl;
          log("create_ready", { provider: data.provider, urlPrefix: persistentUrl.slice(0, 80) });
          setState({
            stage: "ready",
            imageUrl: persistentUrl,
            lastGoodImageUrl: persistentUrl,
            error: null,
            provider: data.provider ?? null,
            requestId: data.requestId ?? null,
            retryAfterMs: null,
          });
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
          }));
          return;
        }

        throw new Error("No data returned from try-on service");
      } catch (e: any) {
        if (isStale()) return;
        stopTimers();
        log("create_error", { message: e?.message });
        setState((prev) => ({
          ...prev,
          stage: "failed",
          error: e?.message || "Generation failed.",
        }));
      }
    })();

    return () => {
      cancelled = true;
      stopTimers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);

  const retry = useCallback(() => setManualReload((n) => n + 1), []);

  return { ...state, retry };
}
