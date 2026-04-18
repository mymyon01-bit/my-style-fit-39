import { classifyQuery } from "./query-intent-service";
import { expandQueries } from "./query-expansion-service";
import { discoverProducts } from "./product-discovery-service";
import { validateProduct } from "./product-validation-service";
import { ingestQuery } from "./product-ingestion-service";
import { appendToSession, type SearchSession } from "./search-session";
import { findCluster, upsertCluster } from "./query-cluster-service";

export interface RunSearchOptions {
  /** Called whenever new products are appended to the session. */
  onProgress?: (session: SearchSession) => void;
  /** Stop once results.length >= target. */
  target?: number;
  /** Hard cycle cap (default 3). */
  maxCycles?: number;
}

/**
 * Drives a 3-cycle search:
 *   cycle 1: discover from current DB + cached external
 *   cycle 2: trigger fresh ingestion + re-pull
 *   cycle 3: broaden via more query family variants
 *
 * Append-only: never resets session.results. Stops early when target hit.
 */
export async function runSearch(
  session: SearchSession,
  opts: RunSearchOptions = {},
): Promise<SearchSession> {
  const target = opts.target ?? 20;
  const maxCycles = opts.maxCycles ?? 3;
  const type = classifyQuery(session.query);
  const family = await expandQueries(session.query, type);

  // Cycle plan: split family into batches, expand fresh ingestion in cycle 2
  const plan: { queries: string[]; fresh: boolean }[] = [
    { queries: [session.query, ...family.slice(0, 3)], fresh: false },
    { queries: family.slice(3, 8), fresh: true },
    { queries: family.slice(8, 15), fresh: true },
  ].slice(0, maxCycles);

  let prevCount = 0;
  let emptyCycles = 0;

  for (let i = 0; i < plan.length; i++) {
    session.cycle = i + 1;
    const { queries, fresh } = plan[i];

    // Cycle 2 onward: trigger background ingestion (non-blocking on result)
    if (fresh) {
      void ingestQuery(session.query);
    }

    // Run all queries in this cycle in parallel
    const batches = await Promise.all(
      queries.filter(Boolean).map((q) =>
        discoverProducts(q, {
          excludeIds: Array.from(session.seenIds).slice(-50),
          limit: 12,
          freshSearch: fresh,
        }),
      ),
    );

    let addedThisCycle = 0;
    for (const batch of batches) {
      for (const product of batch) {
        if (!validateProduct(product)) continue;
        if (appendToSession(session, product)) addedThisCycle++;
      }
    }

    console.info("[search-runner] cycle", {
      cycle: session.cycle,
      addedThisCycle,
      total: session.results.length,
      type,
    });

    session.status = session.results.length >= target ? "complete" : "partial";
    opts.onProgress?.(session);

    if (session.results.length >= target) break;
    if (session.results.length === prevCount) {
      emptyCycles++;
      if (emptyCycles >= 2) break;
    } else {
      emptyCycles = 0;
    }
    prevCount = session.results.length;
  }

  session.status = "complete";
  opts.onProgress?.(session);
  return session;
}
