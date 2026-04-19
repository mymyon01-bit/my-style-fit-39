/**
 * Discover cache selector
 * -----------------------
 * Fast DB-first selector for the top recommendation grid.
 *
 * Strategy (token-based, no full-phrase matching):
 *   1. Tokenize query (lowercase + whitespace split, drop tokens < 2 chars)
 *   2. KR queries get EN aliases mixed in
 *   3. Match ANY token across name/brand/category/search_query (.or ilike)
 *   4. Score in JS:    name +3, category +2, brand +2, search_query +1
 *   5. Order by score DESC, then a small random jitter (×0.2), then freshness
 *      → fixes the "same 8 cards every time" repetition bug
 *   6. Degrade-token fallback: if pool < 12, retry with the longest single token
 *   7. Final fallback: recent active items (so the grid never collapses)
 */
import { supabase } from "@/integrations/supabase/client";
import { detectPrimaryCategory, productMatchesCategory } from "@/lib/search/category-lock";
import { normalizeDiscoverProducts } from "./discover-product-normalizer";
import { resolveKrAliases } from "./krAliasMap";
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

function tokenize(raw: string): string[] {
  return raw
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.replace(/[(),]/g, " ").trim())
    .filter((t) => t.length >= 2);
}

function buildOrParts(terms: string[]): string {
  const parts: string[] = [];
  for (const t of terms) {
    parts.push(`name.ilike.%${t}%`);
    parts.push(`brand.ilike.%${t}%`);
    parts.push(`search_query.ilike.%${t}%`);
    parts.push(`category.ilike.%${t}%`);
  }
  return parts.join(",");
}

/** Token-based scoring: name +3, category +2, brand +2, search_query +1. */
function scoreRow(row: CacheRow, terms: string[]): number {
  if (terms.length === 0) return 0;
  const name = (row.name || "").toLowerCase();
  const brand = (row.brand || "").toLowerCase();
  const category = (row.category || "").toLowerCase();
  const sq = (row.search_query || "").toLowerCase();
  let score = 0;
  for (const t of terms) {
    if (name.includes(t)) score += 3;
    if (category.includes(t)) score += 2;
    if (brand.includes(t)) score += 2;
    if (sq.includes(t)) score += 1;
  }
  return score;
}

function freshnessSeconds(row: CacheRow): number {
  if (!row.created_at) return 0;
  const t = new Date(row.created_at).getTime();
  if (Number.isNaN(t)) return 0;
  return t / 1000;
}

async function fetchPool(orTerms: string[], poolSize: number): Promise<CacheRow[]> {
  let request = supabase
    .from("product_cache")
    .select("*")
    .eq("is_active", true)
    .not("image_url", "is", null)
    .order("created_at", { ascending: false })
    .limit(poolSize);
  if (orTerms.length > 0) {
    request = request.or(buildOrParts(orTerms));
  }
  const { data, error } = await request;
  if (error) {
    console.warn("[discover-cache-selector] pool fetch failed", error);
    return [];
  }
  return (data || []) as CacheRow[];
}

export async function selectFastTopGrid(opts: FastSelectorOptions): Promise<FastSelectorResult> {
  const query = (opts.query || "").trim();
  const windowSize = opts.windowSize ?? 12;
  const poolSize = Math.max(48, windowSize * 6);
  const kr = resolveKrAliases(query);
  const lockSource = kr.isKorean && kr.family ? kr.family : query;
  const lock = lockSource ? detectPrimaryCategory(lockSource) : null;

  const tokens = tokenize(query);
  const orTerms = kr.isKorean && kr.aliases.length > 0
    ? Array.from(new Set([...tokens, ...kr.aliases]))
    : tokens;

  // Pass 1 — full token set
  let rows = await fetchPool(orTerms, poolSize);

  // Pass 2 — degrade to longest single token if pool is too thin
  let usedFallback = false;
  if (rows.length < windowSize && orTerms.length > 1) {
    const longest = [...orTerms].sort((a, b) => b.length - a.length)[0];
    const more = await fetchPool([longest], poolSize);
    const seen = new Set(rows.map((r) => r.id));
    for (const r of more) {
      if (!seen.has(r.id)) rows.push(r);
    }
    usedFallback = true;
  }

  // Pass 3 — final safety net: recent unfiltered
  if (rows.length === 0) {
    rows = await fetchPool([], poolSize);
    usedFallback = true;
  }

  // Score + ranked order with random jitter so successive searches vary.
  // ORDER BY score DESC, RANDOM()*0.2, freshness DESC
  const maxFresh = rows.reduce((m, r) => Math.max(m, freshnessSeconds(r)), 1);
  const ranked = rows
    .map((row) => {
      const score = scoreRow(row, orTerms);
      const freshNorm = freshnessSeconds(row) / maxFresh; // 0..1
      const jitter = Math.random() * 0.2;
      return { row, rank: score + jitter + freshNorm * 0.05 };
    })
    .sort((a, b) => b.rank - a.rank)
    .map((x) => x.row);

  let products = normalizeDiscoverProducts(ranked, { originalQuery: query });

  // Soft category lock — keep at least min(windowSize/2, 6) results so
  // the grid never collapses from over-eager filtering.
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
