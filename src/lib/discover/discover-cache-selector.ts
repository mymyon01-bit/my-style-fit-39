/**
 * Discover cache selector
 * -----------------------
 * Fast DB-first selector for the top recommendation grid.
 *
 * Pipeline:
 *   1. tokenizeQuery (shared with useDbTopGrid) — strips stopwords,
 *      mixes KR→EN aliases, dedupes
 *   2. fetch pool with token OR-clause
 *   3. score: name+3 / category+3 / brand+2 / search_query+1
 *      + freshness bonus + jitter for variation
 *   4. degrade-token fallback: longest single token if pool < windowSize
 *   5. last-resort fallback: recent active items (grid never collapses)
 *   6. soft category lock (drop if ≥ min(window/2, 6) match)
 */
import { supabase } from "@/integrations/supabase/client";
import { detectPrimaryCategory, productMatchesCategory } from "@/lib/search/category-lock";
import { logGridRender } from "./discover-diagnostics";
import { normalizeDiscoverProducts } from "./discover-product-normalizer";
import {
  buildOrClause,
  freshnessSeconds,
  tokenizeQuery,
} from "./discover-tokenizer";
import { expandSearchAliases } from "./searchAliases";
import { SEARCH_POOL_LIMIT, SEARCH_SCORE_WEIGHTS } from "./constants";
import type { ParsedIntent } from "./discover-intent-parser";
import type { DiscoverProduct } from "./discover-types";

export interface FastSelectorOptions {
  query: string;
  windowSize?: number;
  /** Optional parsed intent — when present, scoring uses style/scenario boosts. */
  intent?: ParsedIntent | null;
  /** Optional set of product ids the user has already seen — small unseen bonus. */
  seenIds?: Set<string>;
}

export interface FastSelectorResult {
  products: DiscoverProduct[];
  poolSize: number;
  usedFallback: boolean;
}

interface CacheRow {
  id: string;
  name?: string | null;
  brand?: string | null;
  category?: string | null;
  search_query?: string | null;
  created_at?: string | null;
  trend_score?: number | null;
  [key: string]: unknown;
}

async function fetchPool(orTerms: string[], poolSize: number): Promise<CacheRow[]> {
  let request = supabase
    .from("product_cache")
    .select("*")
    .eq("is_active", true)
    .not("image_url", "is", null)
    .order("created_at", { ascending: false })
    .limit(poolSize);
  const clause = buildOrClause(orTerms);
  if (clause) request = request.or(clause);
  const { data, error } = await request;
  if (error) {
    console.warn("[discover-cache-selector] pool fetch failed", error);
    return [];
  }
  return (data || []) as CacheRow[];
}

export async function selectFastTopGrid(opts: FastSelectorOptions): Promise<FastSelectorResult> {
  const windowSize = opts.windowSize ?? 12;
  // SEARCH pool — large candidate set for ranking. UI slice happens later.
  const poolSize = SEARCH_POOL_LIMIT;

  const tq = tokenizeQuery(opts.query);
  const lockSource = tq.isKorean && tq.krFamily ? tq.krFamily : tq.raw;
  const lock = lockSource ? detectPrimaryCategory(lockSource) : null;

  // SEMANTIC EXPANSION: merge KR/vibe-aware aliases into the OR clause so
  // Korean & vibe queries actually fetch English-cached products.
  const orTerms = Array.from(new Set([
    ...tq.searchTerms,
    ...expandSearchAliases(opts.query),
  ]));

  // Pass 1 — full token + alias set
  let rows = await fetchPool(orTerms, poolSize);
  let stage: "tokens" | "longest-token" | "recent" = "tokens";

  // Pass 2 — degrade to longest single token if pool too thin
  let usedFallback = false;
  if (rows.length < windowSize && orTerms.length > 1) {
    const longest = [...orTerms].sort((a, b) => b.length - a.length)[0];
    const more = await fetchPool([longest], poolSize);
    const seen = new Set(rows.map((r) => r.id));
    for (const r of more) if (!seen.has(r.id)) rows.push(r);
    usedFallback = true;
    stage = "longest-token";
  }

  // Pass 3 — last-resort: recent unfiltered
  if (rows.length === 0) {
    rows = await fetchPool([], poolSize);
    usedFallback = true;
    stage = "recent";
  }

  // Spec-weighted scoring: category +30, name +20, category-token +15,
  // brand +12, search_query +10, style/scenario +8, freshness +5, unseen +5.
  const W = SEARCH_SCORE_WEIGHTS;
  const intent = opts.intent ?? null;
  const intentSemanticTerms = intent
    ? Array.from(new Set([
        ...intent.styleTags.map((s) => s.toLowerCase()),
        ...intent.moodTags.map((s) => s.toLowerCase()),
        ...(intent.occasion ? [intent.occasion.toLowerCase()] : []),
        ...(intent.weather ? [intent.weather.toLowerCase()] : []),
      ]))
    : [];
  const seenIds = opts.seenIds || new Set<string>();
  const maxFresh = rows.reduce((m, r) => Math.max(m, freshnessSeconds(r)), 1);

  const ranked = rows
    .map((row) => {
      const name = (row.name || "").toLowerCase();
      const brand = (row.brand || "").toLowerCase();
      const category = (row.category || "").toLowerCase();
      const sq = (row.search_query || "").toLowerCase();
      let score = 0;
      // Token-level matches (spec weights)
      for (const t of orTerms) {
        if (name.includes(t)) score += W.tokenInName;
        if (category.includes(t)) score += W.tokenInCategory;
        if (brand.includes(t)) score += W.tokenInBrand;
        if (sq.includes(t)) score += W.tokenInSearchQuery;
      }
      // Hard category lock — strong boost on match, hard sink on miss.
      if (lock) {
        const matches = category.includes(lock) || name.includes(lock);
        if (matches) score += W.categoryExact;
        else score -= 100;
      }
      // Intent-driven style/scenario/mood boosts.
      for (const t of intentSemanticTerms) {
        if (name.includes(t) || category.includes(t) || sq.includes(t)) {
          score += W.styleOrScenario;
        }
      }
      // Freshness bonus (normalized).
      const freshNorm = freshnessSeconds(row) / maxFresh;
      score += freshNorm * W.freshness;
      // Unseen bonus.
      if (!seenIds.has(row.id)) score += W.unseen;
      // Tiny jitter so ties shuffle and the first row rotates.
      const jitter = Math.random() * 0.5;
      return { row, rank: score + jitter };
    })
    .filter((x) => x.rank > -50) // drop hard-penalized rows
    .sort((a, b) => b.rank - a.rank)
    .map((x) => x.row);

  let products = normalizeDiscoverProducts(ranked, { originalQuery: tq.raw });

  // Soft category lock as final guardrail (uses richer productMatchesCategory).
  if (lock) {
    const matched = products.filter((p) =>
      productMatchesCategory(
        { id: p.id, title: p.title, category: p.category } as never,
        lock,
      ),
    );
    if (matched.length >= Math.min(windowSize / 2, 6)) products = matched;
  }

  // Diagnostics — verify pool is reaching SEARCH_POOL_LIMIT, not 200.
  console.log("[discover-search] selectFastTopGrid", {
    query: tq.raw,
    candidateCount: rows.length,
    afterRanking: ranked.length,
    visibleCount: products.length,
    stage,
  });

  if (tq.raw) {
    logGridRender({
      query: tq.raw,
      normalized: tq.raw,
      tokens: tq.tokens,
      expandedTokens: tq.searchTerms,
      lockedCategory: lock,
      dbResultCount: products.length,
      fallbackStage: stage,
      topProductIds: products.map((p) => p.id),
      layer: "db",
    });
  }

  return { products, poolSize: rows.length, usedFallback };
}
