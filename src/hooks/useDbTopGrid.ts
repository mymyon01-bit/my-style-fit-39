import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { normalizeFromCache } from "@/lib/search/product-normalizer";
import { detectPrimaryCategory, productMatchesCategory } from "@/lib/search/category-lock";
import { resolveKrAliases } from "@/lib/discover/krAliasMap";
import type { Product } from "@/lib/search/types";

/**
 * LAYER 1 hook — instant DB top grid.
 *
 * Pulls the freshest cached products straight from product_cache so the
 * Discover page can paint a full grid without waiting on edge functions,
 * external scrapers, or the search-runner pipeline.
 *
 * Concerns are kept narrow on purpose:
 *   - DB-first only (no live discovery here)
 *   - Category-lock filtered when the query implies a product type
 *   - Returns normalized Product shape so it shares cards with Layer 3
 */
export interface UseDbTopGridResult {
  products: Product[];
  loading: boolean;
  error: string | null;
}

export function useDbTopGrid(query: string, limit = 12): UseDbTopGridResult {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const tokenRef = useRef(0);

  useEffect(() => {
    const trimmed = query.trim();
    const token = ++tokenRef.current;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const lock = trimmed ? detectPrimaryCategory(trimmed) : null;
        // Pull more than we need so category-lock filtering still leaves a full grid.
        const dbLimit = Math.max(limit * 4, 48);
        let request = supabase
          .from("product_cache")
          .select("*")
          .eq("is_active", true)
          .not("image_url", "is", null)
          .order("created_at", { ascending: false })
          .limit(dbLimit);

        if (trimmed.length > 0) {
          // Soft text match — never hard-fail; fallback to recent if nothing matches.
          request = request.or(
            `name.ilike.%${trimmed}%,brand.ilike.%${trimmed}%,search_query.ilike.%${trimmed}%,category.ilike.%${trimmed}%`,
          );
        }

        const { data, error: dbError } = await request;
        if (token !== tokenRef.current) return;
        if (dbError) throw dbError;

        let normalized = (data || [])
          .map((row) => normalizeFromCache(row))
          .filter((item): item is Product => Boolean(item && item.imageUrl));

        if (lock) {
          const matches = normalized.filter((item) => productMatchesCategory(item, lock));
          if (matches.length >= Math.min(limit / 2, 6)) normalized = matches;
        }

        // Fallback: if soft-match returned nothing, pull recent active items.
        if (normalized.length === 0 && trimmed.length > 0) {
          const { data: recent } = await supabase
            .from("product_cache")
            .select("*")
            .eq("is_active", true)
            .not("image_url", "is", null)
            .order("created_at", { ascending: false })
            .limit(limit);
          normalized = (recent || [])
            .map((row) => normalizeFromCache(row))
            .filter((item): item is Product => Boolean(item && item.imageUrl));
        }

        setProducts(normalized.slice(0, limit));
        setLoading(false);
      } catch (err) {
        if (token !== tokenRef.current) return;
        console.warn("[useDbTopGrid] failed", err);
        setError(err instanceof Error ? err.message : "DB grid failed");
        setProducts([]);
        setLoading(false);
      }
    })();
  }, [query, limit]);

  return { products, loading, error };
}
