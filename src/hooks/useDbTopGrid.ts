import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { normalizeFromCache } from "@/lib/search/product-normalizer";
import { detectPrimaryCategory, productMatchesCategory } from "@/lib/search/category-lock";
import {
  buildOrClause,
  freshnessSeconds,
  scoreRowAgainstTokens,
  tokenizeQuery,
} from "@/lib/discover/discover-tokenizer";
import { logGridRender } from "@/lib/discover/discover-diagnostics";
import type { Product } from "@/lib/search/types";

/**
 * LAYER 1 hook — instant DB top grid.
 *
 * Uses the shared discover-tokenizer so scoring + stopwords stay aligned
 * with selectFastTopGrid. 3-pass strategy: full tokens → longest token →
 * recent unfiltered. Soft category lock at the end.
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
        const tq = tokenizeQuery(trimmed);
        const lockSource = tq.isKorean && tq.krFamily ? tq.krFamily : tq.raw;
        const lock = lockSource ? detectPrimaryCategory(lockSource) : null;
        const dbLimit = Math.max(limit * 6, 48);

        const fetchPool = async (terms: string[]) => {
          let req = supabase
            .from("product_cache")
            .select("*")
            .eq("is_active", true)
            .not("image_url", "is", null)
            .order("created_at", { ascending: false })
            .limit(dbLimit);
          const clause = buildOrClause(terms);
          if (clause) req = req.or(clause);
          const { data, error: e } = await req;
          if (e) throw e;
          return data || [];
        };

        // Pass 1 — all tokens
        let rows = await fetchPool(tq.searchTerms);
        let stage: "tokens" | "longest-token" | "recent" = "tokens";
        // Pass 2 — degrade to longest single token if too thin
        if (rows.length < limit && tq.searchTerms.length > 1) {
          const longest = [...tq.searchTerms].sort((a, b) => b.length - a.length)[0];
          const extra = await fetchPool([longest]);
          const seen = new Set(rows.map((r: { id: string }) => r.id));
          for (const r of extra) if (!seen.has(r.id)) rows.push(r);
          stage = "longest-token";
        }
        // Pass 3 — last-resort
        if (rows.length === 0) {
          rows = await fetchPool([]);
          stage = "recent";
        }

        if (token !== tokenRef.current) return;

        const maxFresh = rows.reduce((m: number, r: { created_at?: string | null }) => {
          const t = r.created_at ? new Date(r.created_at).getTime() / 1000 : 0;
          return Number.isNaN(t) ? m : Math.max(m, t);
        }, 1);
        const ranked = rows
          .map((row: Record<string, unknown>) => {
            const score = scoreRowAgainstTokens(
              row as { name?: string | null; brand?: string | null; category?: string | null; search_query?: string | null },
              tq.searchTerms,
            );
            const created = row.created_at
              ? freshnessSeconds(row as { created_at?: string | null })
              : 0;
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

        const finalProducts = normalized.slice(0, limit);
        setProducts(finalProducts);
        setLoading(false);

        if (trimmed) {
          logGridRender({
            query: trimmed,
            normalized: tq.raw,
            tokens: tq.tokens,
            expandedTokens: tq.searchTerms,
            lockedCategory: lock,
            dbResultCount: finalProducts.length,
            fallbackStage: stage,
            topProductIds: finalProducts.map((p) => p.id),
            layer: "db",
          });
        }
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
