import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { normalizeFromCache } from "@/lib/search/product-normalizer";
import { detectPrimaryCategory, productMatchesCategory } from "@/lib/search/category-lock";
import {
  buildOrClause,
  freshnessSeconds,
  tokenizeQuery,
} from "@/lib/discover/discover-tokenizer";
import { expandSearchAliases } from "@/lib/discover/searchAliases";
import { logGridRender } from "@/lib/discover/discover-diagnostics";
import { SEARCH_POOL_LIMIT, SEARCH_SCORE_WEIGHTS } from "@/lib/discover/constants";
import { passesGenderFilter, parseGenderIntent, genderRankAdjustment, type GenderFilter } from "@/lib/discover/genderFilter";
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

export function useDbTopGrid(query: string, limit = 12, gender: GenderFilter = "all"): UseDbTopGridResult {
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
        // SEARCH pool — large candidate set; `limit` is the UI slice applied later.
        const dbLimit = SEARCH_POOL_LIMIT;

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

        // SEMANTIC EXPANSION — KR + vibe alias tokens merged into the OR clause.
        const orTerms = Array.from(new Set([
          ...tq.searchTerms,
          ...expandSearchAliases(trimmed),
        ]));

        // Pass 1 — all tokens + aliases
        let rows = await fetchPool(orTerms);
        let stage: "tokens" | "longest-token" | "recent" = "tokens";

        // GENDER FILTER (post-fetch, pre-rank).
        if (gender !== "all") {
          rows = rows.filter((r) => passesGenderFilter(r as never, gender));
        }

        // Pass 2 — degrade to longest single token if too thin
        if (rows.length < limit && orTerms.length > 1) {
          const longest = [...orTerms].sort((a, b) => b.length - a.length)[0];
          let extra = await fetchPool([longest]);
          if (gender !== "all") extra = extra.filter((r) => passesGenderFilter(r as never, gender));
          const seen = new Set(rows.map((r: { id: string }) => r.id));
          for (const r of extra) if (!seen.has(r.id)) rows.push(r);
          stage = "longest-token";
        }
        // Pass 3 — last-resort
        if (rows.length === 0) {
          rows = await fetchPool([]);
          if (gender !== "all") rows = rows.filter((r) => passesGenderFilter(r as never, gender));
          stage = "recent";
        }

        if (token !== tokenRef.current) return;

        const W = SEARCH_SCORE_WEIGHTS;
        const maxFresh = rows.reduce((m: number, r: { created_at?: string | null }) => {
          const t = r.created_at ? new Date(r.created_at).getTime() / 1000 : 0;
          return Number.isNaN(t) ? m : Math.max(m, t);
        }, 1);
        const ranked = rows
          .map((row: Record<string, unknown>) => {
            const r = row as { name?: string | null; brand?: string | null; category?: string | null; search_query?: string | null; created_at?: string | null };
            const name = (r.name || "").toLowerCase();
            const brand = (r.brand || "").toLowerCase();
            const category = (r.category || "").toLowerCase();
            const sq = (r.search_query || "").toLowerCase();
            let score = 0;
            for (const t of orTerms) {
              if (name.includes(t)) score += W.tokenInName;
              if (category.includes(t)) score += W.tokenInCategory;
              if (brand.includes(t)) score += W.tokenInBrand;
              if (sq.includes(t)) score += W.tokenInSearchQuery;
            }
            if (lock) {
              const matches = category.includes(lock) || name.includes(lock);
              if (matches) score += W.categoryExact;
              else score -= 100;
            }
            const created = r.created_at ? freshnessSeconds(r) : 0;
            const freshNorm = (created && maxFresh) ? (created / maxFresh) : 0;
            score += freshNorm * W.freshness;
            const jitter = Math.random() * 0.5;
            return { row, rank: score + jitter };
          })
          .filter((x) => x.rank > -50)
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
        // Diagnostics — confirm large candidate pool reaches selector.
        console.log("[discover-search] useDbTopGrid", {
          query: trimmed,
          candidateCount: rows.length,
          afterDedupe: normalized.length,
          afterRanking: ranked.length,
          visibleCount: finalProducts.length,
          stage,
        });
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
  }, [query, limit, gender]);

  return { products, loading, error };
}
