/**
 * Route prefetcher — keeps tab navigation snappy by warming up
 * lazy chunks before the user actually clicks a tab.
 *
 * Each entry returns the same dynamic import used in App.tsx,
 * so Vite/Rollup dedupes the chunk and the second call is a no-op.
 */
// Only lazy-loaded routes belong here. Eager routes (Home/Discover/Fit/OOTD/
// Settings/About) are statically imported in App.tsx — including them here
// would trigger a Vite "dynamic + static import" warning and split nothing.
const importers: Record<string, () => Promise<unknown>> = {
  "/profile": () => import("@/pages/ProfilePage"),
  "/subscription": () => import("@/pages/SubscriptionPage"),
};

const warmed = new Set<string>();

export const prefetchRoute = (path: string) => {
  const key = path.split("?")[0].split("#")[0];
  if (warmed.has(key)) return;
  const importer = importers[key];
  if (!importer) return;
  warmed.add(key);
  importer().catch(() => warmed.delete(key));
};

/** Warm all primary tab chunks once the browser is idle. */
export const prefetchAllTabs = () => {
  const run = () => {
    ["/", "/discover", "/ootd", "/fit", "/profile"].forEach(prefetchRoute);
  };
  if (typeof window === "undefined") return;
  if ("requestIdleCallback" in window) {
    (window as any).requestIdleCallback(run, { timeout: 2500 });
  } else {
    setTimeout(run, 1200);
  }
};
