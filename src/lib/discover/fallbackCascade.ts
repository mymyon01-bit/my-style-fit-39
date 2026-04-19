/**
 * Discover fallback cascade
 * -------------------------
 * Last-mile safety net for the visible grid. The hybrid selector + ladder +
 * runSearch already do most of the work — this cascade exists so the user
 * NEVER sees an empty Discover grid when the cache has any inventory at all.
 *
 * Cascade (each stage runs only if the previous returned < SEARCH_MIN_STRONG_RESULTS):
 *
 *   1. category-locked recent products  (when intent.primaryCategory is set)
 *   2. broad recent active products     (no filter, just freshness)
 *
 * Pure DB reads. No AI. No mutation. Returns DiscoverProduct[].
 */
import { supabase } from "@/integrations/supabase/client";
import { productMatchesCategory, type PrimaryCategory } from "@/lib/search/category-lock";
import { normalizeDiscoverProducts } from "./discover-product-normalizer";
import { SEARCH_POOL_LIMIT, SEARCH_MIN_STRONG_RESULTS } from "./constants";
import type { DiscoverProduct } from "./discover-types";

export interface FallbackCascadeOptions {
  query: string;
  /** Already-collected results from earlier stages — fallback merges into these. */
  current: DiscoverProduct[];
  /** Active category lock (null = no lock). */
  lock: PrimaryCategory | null;
}

export interface FallbackCascadeResult {
  products: DiscoverProduct[];
  stagesUsed: Array<"none" | "category" | "broad">;
}

async function fetchRecent(lock: PrimaryCategory | null, query: string): Promise<DiscoverProduct[]> {
  let req = supabase
    .from("product_cache")
    .select("*")
    .eq("is_active", true)
    .not("image_url", "is", null)
    .order("created_at", { ascending: false })
    .limit(SEARCH_POOL_LIMIT);
  if (lock) req = req.or(`category.ilike.%${lock}%,name.ilike.%${lock}%`);
  const { data, error } = await req;
  if (error) {
    console.warn("[discover-fallback] fetch failed", error.message);
    return [];
  }
  let products = normalizeDiscoverProducts(data || [], { originalQuery: query });
  if (lock) {
    products = products.filter((p) =>
      productMatchesCategory({ id: p.id, title: p.title, category: p.category } as never, lock),
    );
  }
  return products;
}

export async function runFallbackCascade(opts: FallbackCascadeOptions): Promise<FallbackCascadeResult> {
  const stagesUsed: FallbackCascadeResult["stagesUsed"] = [];
  if (opts.current.length >= SEARCH_MIN_STRONG_RESULTS) {
    stagesUsed.push("none");
    return { products: opts.current, stagesUsed };
  }

  const seen = new Set(opts.current.map((p) => p.id));
  const merged = [...opts.current];

  // Stage 1 — category-locked recent
  if (opts.lock) {
    const cat = await fetchRecent(opts.lock, opts.query);
    for (const p of cat) {
      if (!seen.has(p.id)) {
        merged.push(p);
        seen.add(p.id);
      }
      if (merged.length >= SEARCH_MIN_STRONG_RESULTS * 2) break;
    }
    stagesUsed.push("category");
    if (merged.length >= SEARCH_MIN_STRONG_RESULTS) {
      console.log("[discover-search] fallback cascade", {
        query: opts.query,
        stagesUsed,
        finalCount: merged.length,
      });
      return { products: merged, stagesUsed };
    }
  }

  // Stage 2 — broad recent (no lock)
  const broad = await fetchRecent(null, opts.query);
  for (const p of broad) {
    if (!seen.has(p.id)) {
      merged.push(p);
      seen.add(p.id);
    }
    if (merged.length >= SEARCH_MIN_STRONG_RESULTS * 2) break;
  }
  stagesUsed.push("broad");

  console.log("[discover-search] fallback cascade", {
    query: opts.query,
    stagesUsed,
    finalCount: merged.length,
  });
  return { products: merged, stagesUsed };
}
