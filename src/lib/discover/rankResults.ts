/**
 * Diversity ranker — enforces source/brand caps on the visible window.
 *
 * Rules (from upgrade spec Part 2E):
 *   - no source domain > 35% of visible
 *   - no brand        > 30% of visible
 *
 * Pure function. Order-preserving — items are evaluated in input order so
 * the upstream score ranking is honored. Items that would breach a cap are
 * skipped and re-tried after the window fills, so we never under-fill the
 * grid when the pool is brand/source heavy.
 */

interface DiversityCandidate {
  brand?: string | null;
  sourceDomain?: string | null;
  storeName?: string | null;
  platform?: string | null;
}

const SOURCE_CAP = 0.35;
const BRAND_CAP = 0.3;

function sourceKeyOf(item: DiversityCandidate): string {
  return (item.sourceDomain || item.storeName || item.platform || "unknown").toLowerCase();
}
function brandKeyOf(item: DiversityCandidate): string {
  return (item.brand || "unknown").toLowerCase();
}

export function enforceDiversity<T extends DiversityCandidate>(
  items: T[],
  windowSize = 24,
): T[] {
  if (items.length <= 1) return items.slice();

  const sourceCounts: Record<string, number> = {};
  const brandCounts: Record<string, number> = {};
  const out: T[] = [];
  const deferred: T[] = [];

  const wouldExceed = (count: number, total: number, cap: number) =>
    total > 0 && (count + 1) / (total + 1) > cap;

  // Pass 1 — strict caps.
  for (const item of items) {
    if (out.length >= windowSize) break;
    const src = sourceKeyOf(item);
    const brand = brandKeyOf(item);
    const srcCount = sourceCounts[src] || 0;
    const brandCount = brandCounts[brand] || 0;

    if (wouldExceed(srcCount, out.length, SOURCE_CAP) || wouldExceed(brandCount, out.length, BRAND_CAP)) {
      deferred.push(item);
      continue;
    }

    out.push(item);
    sourceCounts[src] = srcCount + 1;
    brandCounts[brand] = brandCount + 1;
  }

  // Pass 2 — fill remaining slots with deferred items even if they breach caps.
  // Better to show duplicates than to under-fill the grid.
  for (const item of deferred) {
    if (out.length >= windowSize) break;
    out.push(item);
  }

  // Pass 3 — append anything past the window untouched (load-more buffer).
  for (let i = items.length - 1, kept = new Set(out); i >= 0; i--) {
    void kept; // placeholder — items array is already in 'out'+'deferred'+rest order
  }
  // Append items not yet emitted (preserves load-more pool).
  const emitted = new Set(out);
  for (const item of items) {
    if (out.length >= items.length) break;
    if (!emitted.has(item)) out.push(item);
  }

  return out;
}
