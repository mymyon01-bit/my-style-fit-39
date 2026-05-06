// ─── fitPriorityQueue — V4.0 latest-wins request queue ───────────────────
// Tiny abort registry so the FIT pipeline can guarantee that "the most
// recent visible request is the one that completes". Older requests are
// aborted the moment a newer one is queued under the same lane.
//
// Lanes:
//   - "render"   — the user-visible try-on generation
//   - "prewarm"  — background prep (always lower priority; aborted by render)
//
// API is intentionally minimal: register(lane, ctrl), abortLane(lane),
// abortAllStale() before a new render.

export type FitLane = "render" | "prewarm";

const lanes: Record<FitLane, AbortController[]> = {
  render: [],
  prewarm: [],
};

export function registerAbort(lane: FitLane): AbortController {
  const ctrl = new AbortController();
  lanes[lane].push(ctrl);
  // Auto-cleanup when this controller is consumed.
  ctrl.signal.addEventListener("abort", () => {
    const list = lanes[lane];
    const i = list.indexOf(ctrl);
    if (i >= 0) list.splice(i, 1);
  });
  return ctrl;
}

export function abortLane(lane: FitLane): void {
  const list = lanes[lane].splice(0);
  for (const c of list) {
    try { c.abort(); } catch { /* ignore */ }
  }
}

/** Called by render path to clear any in-flight prewarm + older renders. */
export function abortAllStaleForRender(): void {
  abortLane("prewarm");
  abortLane("render");
}
