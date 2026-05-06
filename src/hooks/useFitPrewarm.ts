// ─── useFitPrewarm — V4.0 background fit preparation hook ────────────────
// Mounted by ProductDetailSheet. Watches user dwell + interactions and fires
// prewarm() in the background so that when the user finally taps TRY ON
// the deterministic parts of the FIT pipeline are already cached.
//
// Triggers (debounced; first match wins per product+body):
//   • sheet open
//   • dwell > 1.5s
//   • bumpInteraction() (image zoom, size touch, save, etc.)
//
// Cancels itself on unmount, on body change, and when a render request
// preempts via the priority queue.

import { useCallback, useEffect, useRef, useState } from "react";
import { prewarmFit, type PrewarmInput, type PrewarmResult } from "@/lib/fit/fitPrewarm";

export interface UseFitPrewarmArgs {
  enabled: boolean;
  /** Stable identity for the body+product pair. When this changes, prewarm reruns. */
  prewarmInput: PrewarmInput | null;
  /** Dwell window before prewarm fires when there is no explicit interaction. */
  dwellMs?: number;
}

export interface UseFitPrewarmResult {
  prewarmed: PrewarmResult | null;
  isPrewarming: boolean;
  /** Call from the UI when the user interacts (zoom/save/size touch). */
  bumpInteraction: () => void;
}

export function useFitPrewarm(args: UseFitPrewarmArgs): UseFitPrewarmResult {
  const dwellMs = args.dwellMs ?? 1500;
  const [state, setState] = useState<{ prewarmed: PrewarmResult | null; isPrewarming: boolean }>({
    prewarmed: null,
    isPrewarming: false,
  });
  const timerRef = useRef<number | null>(null);
  const ranKeyRef = useRef<string | null>(null);

  const key =
    args.enabled && args.prewarmInput
      ? `${args.prewarmInput.bodySignature}|${args.prewarmInput.productKey}|${args.prewarmInput.selectedSize ?? "_"}`
      : null;

  const fire = useCallback(async () => {
    if (!args.prewarmInput) return;
    const localKey = `${args.prewarmInput.bodySignature}|${args.prewarmInput.productKey}|${args.prewarmInput.selectedSize ?? "_"}`;
    if (ranKeyRef.current === localKey) return;
    ranKeyRef.current = localKey;
    setState((s) => ({ ...s, isPrewarming: true }));
    try {
      const result = await prewarmFit(args.prewarmInput);
      // Only commit if the key is still current.
      if (ranKeyRef.current === localKey) {
        setState({ prewarmed: result, isPrewarming: false });
      }
    } catch {
      setState({ prewarmed: null, isPrewarming: false });
    }
  }, [args.prewarmInput]);

  useEffect(() => {
    if (!key) return;
    // Reset memoization when the body+product key changes.
    ranKeyRef.current = null;
    setState({ prewarmed: null, isPrewarming: false });
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => { void fire(); }, dwellMs);
    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [key, dwellMs, fire]);

  const bumpInteraction = useCallback(() => {
    if (!args.enabled) return;
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    void fire();
  }, [args.enabled, fire]);

  return { ...state, bumpInteraction };
}
