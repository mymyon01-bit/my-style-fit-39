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
  scoreRowAgainstTokens,
  tokenizeQuery,
} from "./discover-tokenizer";
import { SEARCH_POOL_LIMIT } from "./constants";
import type { DiscoverProduct } from "./discover-types";

export interface FastSelectorOptions {
  query: string;
  windowSize?: number;
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

  // Pass 1 — full token set
  let rows = await fetchPool(tq.searchTerms, poolSize);
  let stage: "tokens" | "longest-token" | "recent" = "tokens";

  // Pass 2 — degrade to longest single token if pool too thin
  let usedFallback = false;
  if (rows.length < windowSize && tq.searchTerms.length > 1) {
    const longest = [...tq.searchTerms].sort((a, b) => b.length - a.length)[0];
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

  // Score + jittered ranking with HARD category penalty when locked.
  // Spec: locked-category mismatch → -100 (effectively filtered).
  const maxFresh = rows.reduce((m, r) => Math.max(m, freshnessSeconds(r)), 1);
  const ranked = rows
    .map((row) => {
      let score = scoreRowAgainstTokens(row, tq.searchTerms);
      // Hard category lock — penalize non-matching rows so they sink.
      if (lock) {
        const cat = (row.category || "").toLowerCase();
        const name = (row.name || "").toLowerCase();
        const matches = cat.includes(lock) || name.includes(lock);
        if (matches) score += 6;
        else score -= 100;
      }
      const freshNorm = freshnessSeconds(row) / maxFresh;
      const jitter = Math.random() * 0.15;
      return { row, rank: score + jitter + freshNorm * 0.05 };
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
