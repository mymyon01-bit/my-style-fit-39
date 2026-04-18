import { productMatchesCategory } from "./category-lock";
import { freshnessWeight } from "./freshness";
import type { ResultOrigin, SearchSession } from "./search-session";
import { wasRecentlyShown } from "./search-session";
import { sourceOf } from "./sources";
import type { Product } from "./types";

const FIRST_ROW_MEMORY_KEY = "wardrobe_discover_first_row_v1";

export interface DiscoverRenderableProduct extends Product {
  origin: ResultOrigin;
  queryFamily: string;
  freshnessScore: number;
  sourceDomain: string;
  sourceKey: string;
  isLocalSeen: boolean;
  isDbSeen: boolean;
  isUnseen: boolean;
  isFresh: boolean;
  finalScore: number;
}

export interface DiscoverGridDiagnostics {
  totalEligible: number;
  totalFreshFetched: number;
  totalRenderedFresh: number;
  totalRejectedBySeen: number;
  totalRejectedByDbSeen: number;
  totalRejectedByCategory: number;
  totalRejectedByDedupe: number;
  totalInsertedToDb: number;
  firstRowChangedCount: number;
  renderedProductIds: string[];
}

function productKey(product: Pick<Product, "id" | "externalUrl" | "imageUrl">): string {
  return (product.externalUrl || product.id || product.imageUrl || "").toLowerCase();
}

function sourceDomainOf(url?: string | null): string {
  if (!url) return "unknown";
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "unknown";
  }
}

function originWeight(origin: ResultOrigin): number {
  if (origin === "live_ingestion_batch") return 1.18;
  if (origin === "product_cache") return 0.96;
  return 0.82;
}

function computeBaseScore(product: Product, index: number, total: number): number {
  const trend = typeof product.trendScore === "number" ? Math.max(product.trendScore, 0) : 0;
  const position = total > 0 ? (total - index) / total : 0.5;
  return 1 + trend / 20 + position;
}

export function buildDiscoverRenderables(
  session: SearchSession,
  dbSeen: Set<string>,
): DiscoverRenderableProduct[] {
  return session.results.map((product, index) => {
    const key = productKey(product);
    const localSeen = key ? wasRecentlyShown(key) : false;
    const dbSeenHit = key ? dbSeen.has(key) : false;
    const freshnessScore = freshnessWeight(product);
    const origin = session.resultOrigins.get(product.id) ?? "product_cache";
    const categoryScore = session.categoryLock
      ? productMatchesCategory(product, session.categoryLock)
        ? 1.35
        : 0.7
      : 1;
    const unseenWeight = !localSeen && !dbSeenHit ? 1.25 : localSeen ? 0.58 : 0.68;
    const finalScore =
      computeBaseScore(product, index, session.results.length) *
      categoryScore *
      freshnessScore *
      unseenWeight *
      originWeight(origin);

    return {
      ...product,
      origin,
      queryFamily: session.resultQueryFamilies.get(product.id) ?? session.query,
      freshnessScore,
      sourceDomain: sourceDomainOf(product.externalUrl),
      sourceKey: sourceOf(product),
      isLocalSeen: localSeen,
      isDbSeen: dbSeenHit,
      isUnseen: !localSeen && !dbSeenHit,
      isFresh: origin === "live_ingestion_batch" || freshnessScore >= 0.92,
      finalScore,
    };
  });
}

function sortByScore(items: DiscoverRenderableProduct[]): DiscoverRenderableProduct[] {
  return [...items].sort((a, b) => b.finalScore - a.finalScore);
}

function takeGreedyBySource(
  items: DiscoverRenderableProduct[],
  count: number,
  seenIds: Set<string>,
  sourceCounts: Map<string, number>,
  maxPerSource: number,
): DiscoverRenderableProduct[] {
  const selected: DiscoverRenderableProduct[] = [];
  for (const item of items) {
    if (selected.length >= count) break;
    if (seenIds.has(item.id)) continue;
    const current = sourceCounts.get(item.sourceKey) ?? 0;
    if (current >= maxPerSource) continue;
    selected.push(item);
    seenIds.add(item.id);
    sourceCounts.set(item.sourceKey, current + 1);
  }
  if (selected.length >= count) return selected;
  for (const item of items) {
    if (selected.length >= count) break;
    if (seenIds.has(item.id)) continue;
    selected.push(item);
    seenIds.add(item.id);
    sourceCounts.set(item.sourceKey, (sourceCounts.get(item.sourceKey) ?? 0) + 1);
  }
  return selected;
}

/**
 * Mandatory mix:
 *   - 40–60% fresh new products (isUnseen && isFresh)
 *   - 20–30% cached but unseen products (isUnseen && !isFresh)
 *   - 10–20% older fallback products (!isUnseen)
 *
 * Plus enforced rules:
 *   - first visible row (4 items) may contain ≤ 2 repeated/seen items
 *   - no source > 35% of window
 *   - no brand > 30% of window for generic searches
 */
export function composeDiscoverGrid(
  items: DiscoverRenderableProduct[],
  opts: { windowSize?: number; minFreshRatio?: number } = {},
): DiscoverRenderableProduct[] {
  if (items.length <= 1) return items;

  const windowSize = Math.min(opts.windowSize ?? 24, items.length);
  const minFreshRatio = opts.minFreshRatio ?? 0.4;
  const maxPerSource = Math.max(2, Math.floor(windowSize * 0.35));
  const maxPerBrand = Math.max(2, Math.floor(windowSize * 0.30));
  const maxRepeatedFirstRow = 2;
  const firstRowSize = 4;

  const ranked = sortByScore(items);
  const freshUnseen = ranked.filter((item) => item.isUnseen && item.isFresh);
  const cachedUnseen = ranked.filter((item) => item.isUnseen && !item.isFresh);
  const fallback = ranked.filter((item) => !item.isUnseen);

  // Mandatory mix targets (clamped by what's actually available)
  const targetFresh = Math.min(
    freshUnseen.length,
    Math.max(Math.round(windowSize * Math.max(minFreshRatio, 0.4)), Math.min(4, freshUnseen.length)),
  );
  const targetCached = Math.min(
    cachedUnseen.length,
    Math.max(Math.round(windowSize * 0.25), Math.min(3, cachedUnseen.length)),
  );
  const targetFallback = Math.max(
    0,
    Math.min(fallback.length, Math.round(windowSize * 0.15)),
  );

  const selectedIds = new Set<string>();
  const sourceCounts = new Map<string, number>();
  const brandCounts = new Map<string, number>();
  const composed: DiscoverRenderableProduct[] = [];
  let repeatedInFirstRow = 0;

  const tryAdd = (item: DiscoverRenderableProduct, opts: { allowRepeatedInFirstRow?: boolean } = {}): boolean => {
    if (selectedIds.has(item.id)) return false;
    if (composed.length >= windowSize) return false;
    const sk = item.sourceKey || "other";
    const bk = (item.brand || "").toLowerCase() || "_nobrand";
    if ((sourceCounts.get(sk) ?? 0) >= maxPerSource) return false;
    if (item.brand && (brandCounts.get(bk) ?? 0) >= maxPerBrand) return false;

    const isRepeated = !item.isUnseen;
    if (composed.length < firstRowSize && isRepeated) {
      if (!opts.allowRepeatedInFirstRow && repeatedInFirstRow >= maxRepeatedFirstRow) return false;
      repeatedInFirstRow++;
    }
    composed.push(item);
    selectedIds.add(item.id);
    sourceCounts.set(sk, (sourceCounts.get(sk) ?? 0) + 1);
    brandCounts.set(bk, (brandCounts.get(bk) ?? 0) + 1);
    return true;
  };

  // Pass 1: place fresh-unseen first (front-load the visible section)
  let placedFresh = 0;
  for (const item of freshUnseen) {
    if (placedFresh >= targetFresh) break;
    if (tryAdd(item)) placedFresh++;
  }
  // Pass 2: cached-unseen
  let placedCached = 0;
  for (const item of cachedUnseen) {
    if (placedCached >= targetCached) break;
    if (tryAdd(item)) placedCached++;
  }
  // Pass 3: fallback (older repeats), strictly capped
  let placedFallback = 0;
  for (const item of fallback) {
    if (placedFallback >= targetFallback) break;
    if (tryAdd(item)) placedFallback++;
  }
  // Pass 4: fill the rest from any pool, still respecting caps
  for (const item of ranked) {
    if (composed.length >= windowSize) break;
    tryAdd(item);
  }
  // Pass 5: relax first-row repeat cap if grid still short
  if (composed.length < windowSize) {
    for (const item of ranked) {
      if (composed.length >= windowSize) break;
      tryAdd(item, { allowRepeatedInFirstRow: true });
    }
  }
  // Pass 6: ignore caps entirely as a last resort
  if (composed.length < windowSize) {
    for (const item of ranked) {
      if (composed.length >= windowSize) break;
      if (selectedIds.has(item.id)) continue;
      composed.push(item);
      selectedIds.add(item.id);
    }
  }

  // Append the rest of the pool below the visible window so infinite scroll
  // still has material to show.
  const remainder = ranked.filter((item) => !selectedIds.has(item.id));
  return [...composed, ...remainder];
}

export function trackFirstRowChange(ids: string[]): number {
  try {
    const current = ids.filter(Boolean).slice(0, 4);
    const raw = sessionStorage.getItem(FIRST_ROW_MEMORY_KEY);
    const previous = raw ? (JSON.parse(raw) as string[]) : [];
    sessionStorage.setItem(FIRST_ROW_MEMORY_KEY, JSON.stringify(current));
    if (previous.length === 0) return current.length;
    let changed = 0;
    for (let i = 0; i < Math.max(previous.length, current.length); i += 1) {
      if (previous[i] !== current[i]) changed += 1;
    }
    return changed;
  } catch {
    return ids.slice(0, 4).length;
  }
}

export function buildDiscoverGridDiagnostics(
  session: SearchSession,
  renderables: DiscoverRenderableProduct[],
  visible: DiscoverRenderableProduct[],
): DiscoverGridDiagnostics {
  const totalRejectedBySeen = renderables.filter((item) => item.isLocalSeen).length;
  const totalRejectedByDbSeen = renderables.filter((item) => item.isDbSeen).length;
  const firstRowChangedCount = trackFirstRowChange(visible.slice(0, 4).map((item) => item.id));
  return {
    totalEligible: renderables.length,
    totalFreshFetched: renderables.filter((item) => item.origin === "live_ingestion_batch").length,
    totalRenderedFresh: visible.filter((item) => item.isUnseen && item.isFresh).length,
    totalRejectedBySeen,
    totalRejectedByDbSeen,
    totalRejectedByCategory: session.rejectedByCategory,
    totalRejectedByDedupe: session.rejectedByDedupe,
    totalInsertedToDb: session.ingestedCount,
    firstRowChangedCount,
    renderedProductIds: visible.map((item) => item.id),
  };
}
