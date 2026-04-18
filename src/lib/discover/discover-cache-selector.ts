/**
 * Discover cache selector
 * -----------------------
 * Fast DB-first selector for the top recommendation grid.
 *
 * Rules:
 *   - SELECT from product_cache, recent + active + has image
 *   - Filter to category family if a lock applies
 *   - Pull a LARGE pool (windowSize × 6) so dedupe + caps still fill the grid
 *   - Soft text-match fallback: if the lexical match returns nothing, fall
 *     back to recent unfiltered (so the grid never collapses)
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

export async function selectFastTopGrid(opts: FastSelectorOptions): Promise<FastSelectorResult> {
  const query = (opts.query || "").trim();
  const windowSize = opts.windowSize ?? 12;
  const poolSize = Math.max(48, windowSize * 6);
  const kr = resolveKrAliases(query);
  // For KR queries, derive lock from the EN family hint so e.g. 가방 → bags lock.
  const lockSource = kr.isKorean && kr.family ? kr.family : query;
  const lock = lockSource ? detectPrimaryCategory(lockSource) : null;

  let request = supabase
    .from("product_cache")
    .select("*")
    .eq("is_active", true)
    .not("image_url", "is", null)
    .order("trend_score", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(poolSize);

  if (query) {
    // Tokenize on whitespace so multi-word queries like "Gucci loafers" hit
    // either token across name/brand/search_query/category.
    const tokens = query
      .split(/\s+/)
      .map((t) => t.replace(/[(),]/g, " ").trim())
      .filter((t) => t.length >= 2);

    // For KR queries, OR the EN aliases in addition to (or in place of) the raw KR token.
    const orTerms = kr.isKorean && kr.aliases.length > 0
      ? Array.from(new Set([...tokens, ...kr.aliases]))
      : tokens.length > 0 ? tokens : [query];

    const orParts: string[] = [];
    for (const t of orTerms) {
      orParts.push(`name.ilike.%${t}%`);
      orParts.push(`brand.ilike.%${t}%`);
      orParts.push(`search_query.ilike.%${t}%`);
      orParts.push(`category.ilike.%${t}%`);
    }
    if (orParts.length > 0) request = request.or(orParts.join(","));
  }

  const { data, error } = await request;
  if (error) {
    console.warn("[discover-cache-selector] primary query failed", error);
    return { products: [], poolSize: 0, usedFallback: false };
  }

  let products = normalizeDiscoverProducts(data || [], { originalQuery: query });

  // Apply soft category lock — keep at least min(windowSize/2, 6) results so
  // the grid never collapses from over-eager filtering.
  if (lock) {
    const matched = products.filter((p) =>
      productMatchesCategory(
        { id: p.id, title: p.title, category: p.category } as any,
        lock,
      ),
    );
    if (matched.length >= Math.min(windowSize / 2, 6)) products = matched;
  }

  let usedFallback = false;
  if (products.length === 0 && query) {
    usedFallback = true;
    const { data: recent } = await supabase
      .from("product_cache")
      .select("*")
      .eq("is_active", true)
      .not("image_url", "is", null)
      .order("created_at", { ascending: false })
      .limit(poolSize);
    products = normalizeDiscoverProducts(recent || [], { originalQuery: query });
  }

  return { products, poolSize: data?.length ?? 0, usedFallback };
}
