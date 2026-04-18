/**
 * Freshness, soft-decay ranking, and partial rotation.
 *
 * Why this exists:
 *   product_cache keeps re-serving the same items until external scrapers
 *   bring in fresh ones. Without a freshness signal, the same items always
 *   win the implicit ordering and the feed feels static.
 *
 * Strategy:
 *   - TTL: 24h fresh, 72h soft, beyond = stale.
 *   - Soft decay: final = base * freshnessWeight (never zero — old items still
 *     surface, just below fresh ones).
 *   - Partial rotation: the first visible window reserves ~40% of slots for
 *     items first seen in the current session (newly discovered).
 *   - Stale-cohort signal: callers can ask "is this batch mostly stale?" to
 *     trigger background ingestion.
 */
import type { Product } from "./types";

const HOUR_MS = 60 * 60 * 1000;
export const FRESH_TTL_MS = 24 * HOUR_MS;   // 0–24h: full weight
export const SOFT_TTL_MS = 72 * HOUR_MS;    // 24–72h: linear decay
const STALE_FLOOR = 0.35;                   // >72h: floor weight (never zero)

/** Returns a 0.35–1.0 weight based on how recently the product entered the cache. */
export function freshnessWeight(p: Product, now: number = Date.now()): number {
  const ts = p.createdAt ? Date.parse(p.createdAt) : NaN;
  if (!Number.isFinite(ts)) return 0.85; // unknown age → mid-fresh
  const age = now - ts;
  if (age <= 0) return 1;
  if (age <= FRESH_TTL_MS) return 1;
  if (age >= SOFT_TTL_MS) return STALE_FLOOR;
  // Linear decay between 24h and 72h: 1.0 → STALE_FLOOR
  const t = (age - FRESH_TTL_MS) / (SOFT_TTL_MS - FRESH_TTL_MS);
  return 1 - t * (1 - STALE_FLOOR);
}

/** True if the product is past the soft TTL ceiling. */
export function isStale(p: Product, now: number = Date.now()): boolean {
  const ts = p.createdAt ? Date.parse(p.createdAt) : NaN;
  if (!Number.isFinite(ts)) return false;
  return now - ts > SOFT_TTL_MS;
}

/**
 * Rank products by base signal × freshness weight.
 * `baseScoreFor` defaults to trendScore + a tiny tie-breaker so it stays stable.
 */
export function rankByFreshness<T extends Product>(
  items: T[],
  baseScoreFor?: (p: T) => number,
): T[] {
  const now = Date.now();
  const scored = items.map((p, i) => {
    const base = baseScoreFor
      ? baseScoreFor(p)
      : (typeof p.trendScore === "number" ? p.trendScore : 1) + i * 1e-6;
    return { p, score: base * freshnessWeight(p, now) };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.p);
}

/**
 * Partial rotation: guarantee that at least `minNewRatio` of the first
 * `windowSize` slots come from `newIds` (items first seen in the current
 * session). Newly-ingested items effectively "displace" stale repeats so the
 * grid never looks identical to the previous query.
 */
export function rotateNewIntoWindow<T extends Product>(
  items: T[],
  newIds: Set<string>,
  opts: { windowSize?: number; minNewRatio?: number } = {},
): T[] {
  if (items.length <= 1) return items;
  const windowSize = Math.min(opts.windowSize ?? 24, items.length);
  const minNewRatio = opts.minNewRatio ?? 0.4;
  const targetNew = Math.round(windowSize * minNewRatio);

  const window = items.slice(0, windowSize);
  const tail = items.slice(windowSize);
  const newInWindow = window.filter((p) => newIds.has(p.id)).length;
  if (newInWindow >= targetNew) return items;

  // Find new items in the tail and promote them into the window, displacing
  // the oldest/lowest-rank items at the back of the window.
  const need = targetNew - newInWindow;
  const promotions: T[] = [];
  const tailKept: T[] = [];
  let promoted = 0;
  for (const p of tail) {
    if (promoted < need && newIds.has(p.id)) {
      promotions.push(p);
      promoted++;
    } else {
      tailKept.push(p);
    }
  }
  if (promotions.length === 0) return items;

  // Drop the last `promotions.length` non-new items from the window into tailKept.
  const windowOldFirst = [...window];
  const displaced: T[] = [];
  for (let i = windowOldFirst.length - 1; i >= 0 && displaced.length < promotions.length; i--) {
    if (!newIds.has(windowOldFirst[i].id)) {
      displaced.unshift(windowOldFirst[i]);
      windowOldFirst.splice(i, 1);
    }
  }
  return [...windowOldFirst, ...promotions, ...displaced, ...tailKept];
}

/** True when most of the batch is past the soft TTL — caller should trigger refresh. */
export function isCohortStale(items: Product[], threshold = 0.6): boolean {
  if (items.length === 0) return false;
  const now = Date.now();
  let stale = 0;
  for (const p of items) if (isStale(p, now)) stale++;
  return stale / items.length >= threshold;
}
