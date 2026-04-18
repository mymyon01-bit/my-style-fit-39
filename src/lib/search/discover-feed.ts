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

export function composeDiscoverGrid(
  items: DiscoverRenderableProduct[],
  opts: { windowSize?: number; minFreshRatio?: number } = {},
): DiscoverRenderableProduct[] {
  if (items.length <= 1) return items;

  const windowSize = Math.min(opts.windowSize ?? 24, items.length);
  const minFreshRatio = opts.minFreshRatio ?? 0.4;
  const maxPerSource = Math.max(2, Math.floor(windowSize * 0.35));
  const ranked = sortByScore(items);

  const freshUnseen = ranked.filter((item) => item.isUnseen && item.isFresh);
  const cachedUnseen = ranked.filter((item) => item.isUnseen && !item.isFresh);
  const fallback = ranked.filter((item) => !item.isUnseen);

  const selectedIds = new Set<string>();
  const sourceCounts = new Map<string, number>();

  const targetFresh = Math.min(
    freshUnseen.length,
    Math.max(Math.round(windowSize * minFreshRatio), Math.min(4, freshUnseen.length)),
  );
  const targetCached = Math.min(
    cachedUnseen.length,
    Math.max(Math.round(windowSize * 0.25), Math.min(4, cachedUnseen.length)),
  );

  const head = [
    ...takeGreedyBySource(freshUnseen, targetFresh, selectedIds, sourceCounts, maxPerSource),
    ...takeGreedyBySource(cachedUnseen, targetCached, selectedIds, sourceCounts, maxPerSource),
  ];

  const remainingHeadCount = Math.max(0, windowSize - head.length);
  const remainingPool = ranked.filter((item) => !selectedIds.has(item.id));
  const tailHead = takeGreedyBySource(remainingPool, remainingHeadCount, selectedIds, sourceCounts, maxPerSource);
  const composedHead = [...head, ...tailHead].slice(0, windowSize);

  const firstRow = composedHead.slice(0, 4);
  const staleFirstRow = firstRow.filter((item) => !item.isUnseen || !item.isFresh).length;
  if (staleFirstRow === firstRow.length) {
    const freshCandidate = ranked.find((item) => item.isUnseen && item.isFresh && !firstRow.some((entry) => entry.id === item.id));
    if (freshCandidate) {
      const swapIndex = composedHead.findIndex((item) => !item.isUnseen || !item.isFresh);
      if (swapIndex >= 0) composedHead[swapIndex] = freshCandidate;
    }
  }

  const remainder = [
    ...freshUnseen,
    ...cachedUnseen,
    ...fallback,
  ].filter((item) => !composedHead.some((entry) => entry.id === item.id));

  return [...composedHead, ...remainder];
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
