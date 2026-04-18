import { classifyQuery } from "./query-intent-service";
import { expandQueries } from "./query-expansion-service";
import { discoverProducts } from "./product-discovery-service";
import { validateProduct } from "./product-validation-service";
import { ingestQuery } from "./product-ingestion-service";
import { appendToSession, type SearchSession } from "./search-session";
import { findCluster, upsertCluster } from "./query-cluster-service";
import { recordEvent } from "@/lib/diagnostics";

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
  // 2x supply: target 20 → 40, max cycles 3 → 5, batch size 12 → 18.
  const target = opts.target ?? 40;
  const maxCycles = opts.maxCycles ?? 5;
  const type = classifyQuery(session.query);
  const sessionStart = performance.now();
  let totalCandidates = 0;
  let totalValidated = 0;
  let clusterHit = false;

  // ── CYCLE 0 — CLUSTER LOOKUP (DB-first, instant) ────────────────────────
  // Seed the session immediately from a cached cluster so the user never
  // sees a blank screen. The fresh external search continues in the
  // background and the cluster is upserted at the end.
  try {
    const cluster = await findCluster(session.query);
    if (cluster) {
      let seeded = 0;
      for (const p of cluster.products) {
        if (!validateProduct(p)) continue;
        if (appendToSession(session, p)) seeded++;
      }
      if (seeded > 0) {
        session.status = "partial";
        opts.onProgress?.(session);
        console.info("[search-runner] cluster seed", {
          query: session.query,
          seeded,
          clusterKey: cluster.cluster.cluster_key,
        });
      }
    }
  } catch (e) {
    console.warn("[search-runner] cluster lookup failed", e);
  }

  const family = await expandQueries(session.query, type);

  // 5-cycle plan covering up to 20 expanded queries — 2x the prior reach.
  // Earlier cycles use cached/DB; later cycles trigger fresh ingestion.
  const plan: { queries: string[]; fresh: boolean }[] = [
    { queries: [session.query, ...family.slice(0, 4)], fresh: false },
    { queries: family.slice(4, 9), fresh: false },
    { queries: family.slice(9, 13), fresh: true },
    { queries: family.slice(13, 17), fresh: true },
    { queries: family.slice(17, 20), fresh: true },
  ].slice(0, maxCycles);

  let prevCount = session.results.length;
  let emptyCycles = 0;

  for (let i = 0; i < plan.length; i++) {
    session.cycle = i + 1;
    const { queries, fresh } = plan[i];

    // Cycle 2 onward: trigger background ingestion (non-blocking on result)
    if (fresh) {
      void ingestQuery(session.query);
    }

    // Run all queries in this cycle in parallel — wider candidate window.
    const batches = await Promise.all(
      queries.filter(Boolean).map((q) =>
        discoverProducts(q, {
          excludeIds: Array.from(session.seenIds).slice(-80),
          limit: 18,
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

  // Persist / refresh the cluster in the background — improves next search.
  void upsertCluster({
    query: session.query,
    category: type,
    tags: family.slice(0, 8),
    products: session.results,
  });

  return session;
}
