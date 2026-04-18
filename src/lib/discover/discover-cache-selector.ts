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
  const lock = query ? detectPrimaryCategory(query) : null;

  let request = supabase
    .from("product_cache")
    .select("*")
    .eq("is_active", true)
    .not("image_url", "is", null)
    .order("trend_score", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(poolSize);

  if (query) {
    request = request.or(
      `name.ilike.%${query}%,brand.ilike.%${query}%,search_query.ilike.%${query}%,category.ilike.%${query}%`,
    );
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
