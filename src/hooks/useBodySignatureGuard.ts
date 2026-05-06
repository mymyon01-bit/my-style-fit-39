// ─── useBodySignatureGuard — V4.0 cache invalidation on body change ─────
// Watches the current body DNA signature and, whenever it changes, drops
// every fitCache entry that belonged to a previous signature. This is the
// central enforcement of:
//   "If the body changes, the entire fit pipeline must recognize it as
//    a NEW BODY."

import { useEffect, useRef } from "react";
import { invalidateForBodySignature } from "@/lib/fit/fitCache";
import { abortAllStaleForRender } from "@/lib/fit/fitPriorityQueue";

export function useBodySignatureGuard(currentSignature: string | null | undefined): void {
  const prev = useRef<string | null>(null);
  useEffect(() => {
    if (!currentSignature) return;
    if (prev.current && prev.current !== currentSignature) {
      // Body changed → drop everything keyed to the old body and abort any
      // in-flight render/prewarm so the next render starts from scratch.
      const dropped = invalidateForBodySignature(currentSignature);
      abortAllStaleForRender();
      if (dropped > 0) {
        console.info("[BodySignatureGuard] body changed", {
          from: prev.current,
          to: currentSignature,
          droppedCacheEntries: dropped,
        });
      }
    }
    prev.current = currentSignature;
  }, [currentSignature]);
}
