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
import { normalizeDiscoverProducts } from "./discover-product-normalizer";
import {
  buildOrClause,
  freshnessSeconds,
  scoreRowAgainstTokens,
  tokenizeQuery,
} from "./discover-tokenizer";
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
  const poolSize = Math.max(48, windowSize * 6);

  const tq = tokenizeQuery(opts.query);
  const lockSource = tq.isKorean && tq.krFamily ? tq.krFamily : tq.raw;
  const lock = lockSource ? detectPrimaryCategory(lockSource) : null;

  // Pass 1 — full token set
  let rows = await fetchPool(tq.searchTerms, poolSize);

  // Pass 2 — degrade to longest single token if pool too thin
  let usedFallback = false;
  if (rows.length < windowSize && tq.searchTerms.length > 1) {
    const longest = [...tq.searchTerms].sort((a, b) => b.length - a.length)[0];
    const more = await fetchPool([longest], poolSize);
    const seen = new Set(rows.map((r) => r.id));
    for (const r of more) if (!seen.has(r.id)) rows.push(r);
    usedFallback = true;
  }

  // Pass 3 — last-resort: recent unfiltered
  if (rows.length === 0) {
    rows = await fetchPool([], poolSize);
    usedFallback = true;
  }

  // Score + jittered ranking — ORDER BY score DESC, RANDOM()*0.2, freshness DESC
  const maxFresh = rows.reduce((m, r) => Math.max(m, freshnessSeconds(r)), 1);
  const ranked = rows
    .map((row) => {
      const score = scoreRowAgainstTokens(row, tq.searchTerms);
      const freshNorm = freshnessSeconds(row) / maxFresh;
      const jitter = Math.random() * 0.2;
      return { row, rank: score + jitter + freshNorm * 0.05 };
    })
    .sort((a, b) => b.rank - a.rank)
    .map((x) => x.row);

  let products = normalizeDiscoverProducts(ranked, { originalQuery: tq.raw });

  // Soft category lock
  if (lock) {
    const matched = products.filter((p) =>
      productMatchesCategory(
        { id: p.id, title: p.title, category: p.category } as never,
        lock,
      ),
    );
    if (matched.length >= Math.min(windowSize / 2, 6)) products = matched;
  }

  return { products, poolSize: rows.length, usedFallback };
}
