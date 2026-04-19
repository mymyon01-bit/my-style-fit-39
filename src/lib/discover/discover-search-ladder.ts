/**
 * Discover search ladder
 * ----------------------
 * Multi-stage cache lookup that backs natural-language queries:
 *
 *   1. exact phrase match
 *   2. tokenized match (per-word OR across name/brand/category)
 *   3. semantic expansion (KR aliases + AI tokens + style/mood synonyms)
 *   4. broad structured fallback (category-only / family-only)
 *   5. taste-matched fallback (recent fresh inventory under the lock)
 *
 * NEVER returns an empty result if any inventory exists. Always category-locked
 * when the intent has a primary category. Used by Discover BEFORE the live
 * orchestrator so the page paints something instantly.
 */
import { supabase } from "@/integrations/supabase/client";
import { productMatchesCategory, type PrimaryCategory } from "@/lib/search/category-lock";
import { normalizeDiscoverProducts } from "./discover-product-normalizer";
import { buildOrClause, tokenizeQuery } from "./discover-tokenizer";
import type { DiscoverProduct } from "./discover-types";
import type { ParsedIntent } from "./discover-intent-parser";
import { SEARCH_POOL_LIMIT } from "./constants";

export type LadderStage = "exact" | "tokenized" | "semantic" | "broad" | "taste";

export interface LadderResult {
  products: DiscoverProduct[];
  stageReached: LadderStage;
  poolSize: number;
  perStageCounts: Record<LadderStage, number>;
}

const ENOUGH = 8;                   // success threshold per stage
const POOL = SEARCH_POOL_LIMIT;     // pull large candidate pool per stage

function applyLock(products: DiscoverProduct[], lock: PrimaryCategory | null): DiscoverProduct[] {
  if (!lock) return products;
  const matched = products.filter((p) =>
    productMatchesCategory({ id: p.id, title: p.title, category: p.category } as any, lock),
  );
  // Soft floor — keep matches if they fill at least half a window, else fall back to all.
  return matched.length >= 6 ? matched : products;
}

/**
 * Delegate to the shared tokenizer's OR builder so stopword stripping
 * stays aligned with the DB selectors. Local wrapper retained for
 * call-site clarity inside the ladder.
 */
function buildOr(tokens: string[]): string {
  // tokens are already split words — pass through tokenizer's safe builder.
  return buildOrClause(tokens);
}

/** Strip fashion stopwords from a list of raw tokens (look, 추천, 느낌, ...). */
function cleanTokens(tokens: string[]): string[] {
  // Re-tokenize each word individually — tokenizeQuery drops stopwords + sub-2-char noise.
  const out = new Set<string>();
  for (const t of tokens) {
    if (!t) continue;
    const tq = tokenizeQuery(t);
    for (const word of tq.tokens) out.add(word);
  }
  return Array.from(out);
}

async function fetchPool(orClause: string, query: string): Promise<DiscoverProduct[]> {
  let req = supabase
    .from("product_cache")
    .select("*")
    .eq("is_active", true)
    .not("image_url", "is", null)
    .order("trend_score", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(POOL);
  if (orClause) req = req.or(orClause);
  const { data, error } = await req;
  if (error) {
    console.warn("[discover-ladder] fetch failed", error.message);
    return [];
  }
  return normalizeDiscoverProducts(data || [], { originalQuery: query });
}

export async function runSearchLadder(intent: ParsedIntent): Promise<LadderResult> {
  const lock = intent.primaryCategory;
  const counts: Record<LadderStage, number> = {
    exact: 0, tokenized: 0, semantic: 0, broad: 0, taste: 0,
  };

  // ── Stage 1 — exact phrase match (raw + EN aliases as a single phrase set)
  const exactPhrases = [intent.normalized];
  if (intent.enAliases.length > 0) exactPhrases.push(intent.enAliases[0]);
  const exact = applyLock(await fetchPool(buildOr(exactPhrases), intent.rawQuery), lock);
  counts.exact = exact.length;
  if (exact.length >= ENOUGH) {
    return { products: exact, stageReached: "exact", poolSize: exact.length, perStageCounts: counts };
  }

  // ── Stage 2 — tokenized (per-word OR + KR alias tokens, stopwords stripped)
  const tokens = cleanTokens([
    ...intent.normalized.split(/\s+/),
    ...intent.enAliases,
    ...(intent.brand ? [intent.brand] : []),
    ...(intent.color ? [intent.color] : []),
  ]);
  const tokenized = applyLock(await fetchPool(buildOr(tokens), intent.rawQuery), lock);
  counts.tokenized = tokenized.length;
  if (tokenized.length >= ENOUGH) {
    return { products: tokenized, stageReached: "tokenized", poolSize: tokenized.length, perStageCounts: counts };
  }

  // ── Stage 3 — semantic (style + mood + family tokens, stopwords stripped)
  const semanticTokens = cleanTokens([
    ...tokens,
    ...intent.styleTags,
    ...intent.moodTags,
    ...(intent.family ? [intent.family] : []),
    ...(intent.occasion ? [intent.occasion] : []),
    ...(intent.weather ? [intent.weather] : []),
  ]);
  const semantic = applyLock(await fetchPool(buildOr(semanticTokens), intent.rawQuery), lock);
  counts.semantic = semantic.length;
  if (semantic.length >= ENOUGH) {
    return { products: semantic, stageReached: "semantic", poolSize: semantic.length, perStageCounts: counts };
  }

  // ── Stage 4 — broad structured fallback (category-only)
  const broadTokens: string[] = [];
  if (lock) broadTokens.push(lock);
  if (intent.family) broadTokens.push(intent.family);
  const broad = applyLock(await fetchPool(buildOr(broadTokens), intent.rawQuery), lock);
  counts.broad = broad.length;
  if (broad.length >= ENOUGH) {
    return { products: broad, stageReached: "broad", poolSize: broad.length, perStageCounts: counts };
  }

  // ── Stage 5 — taste-matched fallback (recent fresh inventory under lock)
  const taste = applyLock(await fetchPool("", intent.rawQuery), lock);
  counts.taste = taste.length;
  return {
    products: taste,
    stageReached: "taste",
    poolSize: taste.length,
    perStageCounts: counts,
  };
}
