import { classifyQuery } from "./query-intent-service";
import { expandQueries } from "./query-expansion-service";
import { discoverProducts } from "./product-discovery-service";
import { validateProduct } from "./product-validation-service";
import { ingestQuery } from "./product-ingestion-service";
import { appendToSession, markProductsAsSeen, mixUnseenFirst, type SearchSession } from "./search-session";
import { findCluster, upsertCluster } from "./query-cluster-service";
import { categoryFirstSort } from "./category-lock";
import { isCohortStale, rankByFreshness, rotateNewIntoWindow } from "./freshness";
import { ensureTopRowDiversity, rotateStyleClusters, shuffleMidBand } from "./diversity";
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
  // Diversity-tuned defaults. Stage 1 paints instantly from DB; stages 2-4
  // KEEP appending fresh external results so the feed always feels alive.
  const target = opts.target ?? 60;
  const maxCycles = opts.maxCycles ?? 4;
  // Hard wall-clock budget for the WHOLE pipeline (covers all stages).
  // Stage 1 must paint within ~1.5s; full expansion runs up to 25s.
  const HARD_BUDGET_MS = 25_000;
  const type = classifyQuery(session.query);
  const sessionStart = performance.now();
  let totalCandidates = 0;
  let totalValidated = 0;
  let clusterHit = false;
  /** IDs that were already cached before this session — used for partial rotation. */
  const oldIds = new Set<string>();
  let cohortWasStale = false;
  console.info("[search-runner] start", {
    query: session.query,
    queryType: type,
    categoryLock: session.categoryLock,
  });

  // ── STAGE 1 — DB FIRST (instant paint) ──────────────────────────────────
  // Cluster lookup + raw product_cache fallback. Never blocks on external.
  try {
    const cluster = await findCluster(session.query);
    if (cluster) {
      let seeded = 0;
      for (const p of cluster.products) {
        if (!validateProduct(p)) continue;
        if (appendToSession(session, p)) {
          seeded++;
          oldIds.add(p.id);
        }
      }
      if (seeded > 0) {
        clusterHit = true;
        session.status = "partial";
        opts.onProgress?.(session);
        // If the seed cohort is mostly stale, eagerly trigger a background
        // refresh so future cycles inject fresh products.
        cohortWasStale = isCohortStale(session.results, 0.6);
        if (cohortWasStale) {
          void ingestQuery(session.query);
          console.info("[search-runner] cohort stale, refresh triggered", {
            query: session.query,
          });
        }
        console.info("[search-runner] stage1 cluster seed", {
          query: session.query,
          seeded,
          clusterKey: cluster.cluster.cluster_key,
          cohortStale: cohortWasStale,
        });
      }
    }
  } catch (e) {
    console.warn("[search-runner] cluster lookup failed", e);
  }

  // ── STAGE 2 — FORCED EXPANSION (12-16 query family) ─────────────────────
  const family = await expandQueries(session.query, type);
  console.info("[search-runner] stage2 family", { size: family.length });

  // 4-cycle plan covering up to 16 expanded queries. Every cycle ALWAYS
  // runs — we never break early just because the first page is full. The
  // user must feel the feed continuing to grow.
  const plan: { queries: string[]; fresh: boolean }[] = [
    { queries: [session.query, ...family.slice(0, 3)], fresh: false },
    { queries: family.slice(3, 7), fresh: false },
    { queries: family.slice(7, 11), fresh: true },
    { queries: family.slice(11, 16), fresh: true },
  ].slice(0, maxCycles);

  let consecutiveEmpty = 0;

  for (let i = 0; i < plan.length; i++) {
    if (performance.now() - sessionStart > HARD_BUDGET_MS) {
      console.info("[search-runner] hard budget hit, stopping", {
        elapsed: Math.round(performance.now() - sessionStart),
        results: session.results.length,
      });
      break;
    }

    session.cycle = i + 1;
    const { queries, fresh } = plan[i];

    // Stage 3+: trigger background ingestion of new URLs (non-blocking)
    if (fresh) {
      void ingestQuery(session.query);
    }

    // STAGE 3 — AGGRESSIVE FETCHING. Larger per-call limit → bigger pool.
    const batches = await Promise.all(
      queries.filter(Boolean).map((q) =>
        discoverProducts(q, {
          excludeIds: Array.from(session.seenIds).slice(-120),
          limit: 18,
          freshSearch: fresh,
        }),
      ),
    );

    let addedThisCycle = 0;
    for (const batch of batches) {
      for (const product of batch) {
        totalCandidates++;
        // STAGE 4 — RELAXED validation (validateProduct already light).
        if (!validateProduct(product)) continue;
        totalValidated++;
        // STAGE 5/6 — appendToSession dedupes + appends (never replaces).
        if (appendToSession(session, product)) addedThisCycle++;
      }
    }

    console.info("[search-runner] cycle", {
      cycle: session.cycle,
      addedThisCycle,
      total: session.results.length,
      type,
      elapsed: Math.round(performance.now() - sessionStart),
    });

    session.status = session.results.length >= target ? "complete" : "partial";
    opts.onProgress?.(session);

    // Only stop on TWO consecutive truly-empty cycles (real exhaustion).
    if (addedThisCycle === 0) {
      consecutiveEmpty++;
      if (consecutiveEmpty >= 2) {
        console.info("[search-runner] exhausted (2 empty cycles)");
        break;
      }
    } else {
      consecutiveEmpty = 0;
    }

    // Hit target? Still safe to stop — user has plenty.
    if (session.results.length >= target) break;
  }

  // ── STAGE 7 — FRESHNESS DECAY + ROTATION + REPEAT CONTROL ───────────────
  if (session.categoryLock) {
    session.results = categoryFirstSort(session.results, session.categoryLock);
  }
  // Soft-decay ranking: newer products win, stale ones drop (never disappear).
  session.results = rankByFreshness(session.results);
  // Partial rotation: at least 40% of the first window must be items newly
  // discovered in THIS session (not the cluster seed). Prevents the cached
  // grid from being served back unchanged.
  const newIds = new Set<string>();
  for (const p of session.results) if (!oldIds.has(p.id)) newIds.add(p.id);
  session.results = rotateNewIntoWindow(session.results, newIds, {
    windowSize: 24,
    minNewRatio: 0.4,
  });
  // 70/30 unseen→seen mix in the first window + anti-clustering by brand.
  session.results = mixUnseenFirst(session.results, {
    unseenRatio: 0.7,
    firstWindow: 24,
  });
  // Style round-robin: interleave style buckets so no single cluster dominates.
  session.results = rotateStyleClusters(session.results, 24);
  // Mid-band jitter (per-call seed): same query feels fresh each run, top
  // relevance stays locked.
  session.results = shuffleMidBand(session.results, {
    headLock: 4,
    midSize: 20,
    seed: Date.now(),
  });
  // Hard guarantee on the visible top row: ≥3 brands, ≥2 style variations.
  session.results = ensureTopRowDiversity(session.results, {
    rowSize: 4,
    minBrands: 3,
    minStyles: 2,
  });
  // Persist the seen set for future searches so the user keeps seeing fresh.
  markProductsAsSeen(session.results.slice(0, 60));
  session.status = "complete";
  opts.onProgress?.(session);

  console.info("[search-runner] done", {
    query: session.query,
    categoryLock: session.categoryLock,
    rejectedByCategory: session.rejectedByCategory,
    rejectedByBrandCap: session.rejectedByBrandCap,
    final: session.results.length,
    cycles: session.cycle,
    elapsed: Math.round(performance.now() - sessionStart),
  });

  // Persist / refresh the cluster in the background — improves next search.
  void upsertCluster({
    query: session.query,
    category: type,
    tags: family.slice(0, 8),
    products: session.results,
  });

  recordEvent({
    event_name: "search_session",
    status: session.results.length === 0 ? "error" : session.results.length < 8 ? "partial" : "success",
    duration_ms: performance.now() - sessionStart,
    metadata: {
      query_type: type,
      category_lock: session.categoryLock,
      query_len: session.query.length,
      family_size: family.length,
      cycles: session.cycle,
      candidates: totalCandidates,
      validated: totalValidated,
      results: session.results.length,
      rejected_by_category: session.rejectedByCategory,
      rejected_by_brand_cap: session.rejectedByBrandCap,
      rejected_by_dedupe: session.rejectedByDedupe,
      cluster_hit: clusterHit,
      cohort_stale: cohortWasStale,
      new_in_session: newIds.size,
    },
  });

  return session;
}
