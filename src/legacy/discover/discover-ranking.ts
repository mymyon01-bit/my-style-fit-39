/**
 * Discover ranking
 * ----------------
 * Pure ranking layer. Inputs: normalized + annotated DiscoverProducts.
 * Output: sorted list with `finalScore` written back, plus a composed
 * visible window that enforces source/brand caps and the "no more than 2
 * repeated items in the first visible section" rule.
 *
 * Source-of-truth scoring formula:
 *
 *   finalScore = baseScore
 *              * categoryScore   (1.35 in-lock / 0.7 out / 1.0 no-lock)
 *              * freshnessScore  (already normalized 0..1.x)
 *              * unseenWeight    (1.25 unseen / 0.65 dbSeen / 0.55 localSeen)
 *              * sourceVariety   (penalize repeated source streaks)
 */
import type { PrimaryCategory } from "@/lib/search/category-lock";
import { productMatchesCategory } from "@/lib/search/category-lock";
import type {
  AnnotatedDiscoverProduct,
  DiscoverProduct,
  DiscoverProductAnnotations,
} from "./discover-types";

export interface RankInput {
  product: DiscoverProduct;
  annotation: Pick<DiscoverProductAnnotations, "isLocalSeen" | "isDbSeen" | "isUnseen">;
  /** position in the source ordering (newer/recent-first); used as a soft prior. */
  positionIndex: number;
  totalCount: number;
}

export interface RankContext {
  categoryLock: PrimaryCategory | null;
  /** Source caps as fractions of windowSize (e.g. {source: 0.3, brand: 0.25}). */
  sourceCapRatio?: number;
  brandCapRatio?: number;
  /** Hard limit of repeated/seen items in the first visible section. */
  maxRepeatedInFirstWindow?: number;
}

export interface RankedSet {
  ranked: AnnotatedDiscoverProduct[];
  composed: AnnotatedDiscoverProduct[];
  diagnostics: {
    totalEligible: number;
    visibleCount: number;
    repeatedInFirstWindow: number;
    sourceDistribution: Record<string, number>;
  };
}

function legacyMatchAdapter(p: DiscoverProduct, lock: PrimaryCategory | null): boolean {
  if (!lock) return true;
  // Reuse the legacy matcher by adapting the field names it expects.
  return productMatchesCategory(
    {
      id: p.id,
      title: p.title,
      category: p.category,
    } as any,
    lock,
  );
}

function computeBase(input: RankInput): number {
  const position = input.totalCount > 0 ? (input.totalCount - input.positionIndex) / input.totalCount : 0.5;
  return 1 + position;
}

export function scoreOne(input: RankInput, ctx: RankContext): number {
  const { product, annotation } = input;
  const base = computeBase(input);
  const categoryScore = ctx.categoryLock
    ? legacyMatchAdapter(product, ctx.categoryLock) ? 1.35 : 0.7
    : 1;
  const fresh = Math.max(0.4, product.freshnessScore || 0.5);
  const unseen = annotation.isUnseen ? 1.25 : annotation.isDbSeen ? 0.65 : 0.55;
  return base * categoryScore * fresh * unseen;
}

export function rankProducts(
  inputs: RankInput[],
  ctx: RankContext,
): AnnotatedDiscoverProduct[] {
  const annotated: AnnotatedDiscoverProduct[] = inputs.map((input) => {
    const finalScore = scoreOne(input, ctx);
    const isFresh = input.product.freshnessScore >= 0.85;
    return {
      ...input.product,
      isLocalSeen: input.annotation.isLocalSeen,
      isDbSeen: input.annotation.isDbSeen,
      isUnseen: input.annotation.isUnseen,
      isFresh,
      finalScore,
    };
  });
  return annotated.sort((a, b) => b.finalScore - a.finalScore);
}

/** Compose the visible window with diversity caps + first-window repeat cap. */
export function composeVisibleWindow(
  ranked: AnnotatedDiscoverProduct[],
  windowSize: number,
  ctx: RankContext,
): RankedSet {
  if (ranked.length === 0) {
    return {
      ranked,
      composed: [],
      diagnostics: { totalEligible: 0, visibleCount: 0, repeatedInFirstWindow: 0, sourceDistribution: {} },
    };
  }
  const sourceCap = Math.max(2, Math.floor(windowSize * (ctx.sourceCapRatio ?? 0.3)));
  const brandCap = Math.max(2, Math.floor(windowSize * (ctx.brandCapRatio ?? 0.25)));
  const maxRepeated = ctx.maxRepeatedInFirstWindow ?? 2;
  const firstSectionSize = Math.min(windowSize, 8);

  const sourceCount = new Map<string, number>();
  const brandCount = new Map<string, number>();
  const composed: AnnotatedDiscoverProduct[] = [];
  let repeatedInFirst = 0;

  const tryPick = (p: AnnotatedDiscoverProduct, allowRepeated: boolean): boolean => {
    const sk = p.source || "other";
    const bk = (p.brand || "").toLowerCase() || "_nobrand";
    if ((sourceCount.get(sk) ?? 0) >= sourceCap) return false;
    if (p.brand && (brandCount.get(bk) ?? 0) >= brandCap) return false;

    const isRepeated = !p.isUnseen;
    if (composed.length < firstSectionSize && isRepeated) {
      if (!allowRepeated && repeatedInFirst >= maxRepeated) return false;
      if (allowRepeated || repeatedInFirst < maxRepeated) {
        if (composed.length < firstSectionSize) repeatedInFirst++;
      }
    }

    sourceCount.set(sk, (sourceCount.get(sk) ?? 0) + 1);
    brandCount.set(bk, (brandCount.get(bk) ?? 0) + 1);
    composed.push(p);
    return true;
  };

  // Pass 1: respect all caps + first-window repeat cap.
  for (const p of ranked) {
    if (composed.length >= windowSize) break;
    tryPick(p, false);
  }
  // Pass 2: relax repeat cap if we couldn't fill the window.
  if (composed.length < windowSize) {
    const placedIds = new Set(composed.map((p) => p.id));
    for (const p of ranked) {
      if (composed.length >= windowSize) break;
      if (placedIds.has(p.id)) continue;
      tryPick(p, true);
    }
  }
  // Pass 3: ignore caps entirely as a last resort.
  if (composed.length < windowSize) {
    const placedIds = new Set(composed.map((p) => p.id));
    for (const p of ranked) {
      if (composed.length >= windowSize) break;
      if (placedIds.has(p.id)) continue;
      composed.push(p);
    }
  }

  const distribution: Record<string, number> = {};
  for (const [k, v] of sourceCount) distribution[k] = v;

  return {
    ranked,
    composed,
    diagnostics: {
      totalEligible: ranked.length,
      visibleCount: composed.length,
      repeatedInFirstWindow: repeatedInFirst,
      sourceDistribution: distribution,
    },
  };
}
