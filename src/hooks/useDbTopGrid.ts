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
        const kr = resolveKrAliases(trimmed);
        const lockSource = kr.isKorean && kr.family ? kr.family : trimmed;
        const lock = lockSource ? detectPrimaryCategory(lockSource) : null;
        const dbLimit = Math.max(limit * 6, 48);

        // Tokenize: lowercase + whitespace split, drop sub-2-char noise.
        const tokens = trimmed
          .toLowerCase()
          .split(/\s+/)
          .map((t) => t.replace(/[(),]/g, " ").trim())
          .filter((t) => t.length >= 2);
        const orTerms = kr.isKorean && kr.aliases.length > 0
          ? Array.from(new Set([...tokens, ...kr.aliases]))
          : tokens;

        const buildOr = (terms: string[]) => {
          const parts: string[] = [];
          for (const t of terms) {
            parts.push(`name.ilike.%${t}%`);
            parts.push(`brand.ilike.%${t}%`);
            parts.push(`search_query.ilike.%${t}%`);
            parts.push(`category.ilike.%${t}%`);
          }
          return parts.join(",");
        };

        const fetchPool = async (terms: string[]) => {
          let req = supabase
            .from("product_cache")
            .select("*")
            .eq("is_active", true)
            .not("image_url", "is", null)
            .order("created_at", { ascending: false })
            .limit(dbLimit);
          if (terms.length > 0) req = req.or(buildOr(terms));
          const { data, error: e } = await req;
          if (e) throw e;
          return data || [];
        };

        // Pass 1 — all tokens
        let rows = await fetchPool(orTerms);
        // Pass 2 — degrade to longest single token if too thin
        if (rows.length < limit && orTerms.length > 1) {
          const longest = [...orTerms].sort((a, b) => b.length - a.length)[0];
          const extra = await fetchPool([longest]);
          const seen = new Set(rows.map((r: { id: string }) => r.id));
          for (const r of extra) if (!seen.has(r.id)) rows.push(r);
        }
        // Pass 3 — final safety net: recent unfiltered
        if (rows.length === 0) rows = await fetchPool([]);

        if (token !== tokenRef.current) return;

        // Token-scored ranking with jitter to break repetition.
        // Score: name +3, category +2, brand +2, search_query +1.
        const maxFresh = rows.reduce((m: number, r: { created_at?: string | null }) => {
          const t = r.created_at ? new Date(r.created_at).getTime() / 1000 : 0;
          return Number.isNaN(t) ? m : Math.max(m, t);
        }, 1);
        const ranked = rows
          .map((row: Record<string, unknown>) => {
            const name = String(row.name || "").toLowerCase();
            const brand = String(row.brand || "").toLowerCase();
            const category = String(row.category || "").toLowerCase();
            const sq = String(row.search_query || "").toLowerCase();
            let score = 0;
            for (const t of orTerms) {
              if (name.includes(t)) score += 3;
              if (category.includes(t)) score += 2;
              if (brand.includes(t)) score += 2;
              if (sq.includes(t)) score += 1;
            }
            const created = row.created_at ? new Date(String(row.created_at)).getTime() / 1000 : 0;
            const freshNorm = (created && maxFresh) ? (created / maxFresh) : 0;
            const jitter = Math.random() * 0.2;
            return { row, rank: score + jitter + freshNorm * 0.05 };
          })
          .sort((a, b) => b.rank - a.rank)
          .map((x) => x.row);

        let normalized = ranked
          .map((row) => normalizeFromCache(row))
          .filter((item): item is Product => Boolean(item && item.imageUrl));

        if (lock) {
          const matches = normalized.filter((item) => productMatchesCategory(item, lock));
          if (matches.length >= Math.min(limit / 2, 6)) normalized = matches;
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
