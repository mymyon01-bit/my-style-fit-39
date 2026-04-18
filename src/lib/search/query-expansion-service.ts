import type { QueryType } from "./query-intent-service";
import { supabase } from "@/integrations/supabase/client";

/**
 * Expand the user's raw query into a "query family" of up to 20 variants.
 * Tries the search-discovery edge function (Perplexity + deterministic family);
 * falls back / merges with a richer local family on error.
 *
 * Volume target: 2x the previous expansion (was ~12 → now up to 20).
 */
export async function expandQueries(query: string, type: QueryType): Promise<string[]> {
  try {
    const { data, error } = await supabase.functions.invoke("search-discovery", {
      body: { query, expandOnly: true, maxQueries: 10 },
    });
    if (!error && data?.queries && Array.isArray(data.queries) && data.queries.length > 0) {
      // Merge edge-function results with local fallback to guarantee breadth,
      // de-duplicating while preserving order. Cap at 20.
      const merged: string[] = [];
      const seen = new Set<string>();
      for (const q of [...(data.queries as string[]), ...fallbackQueries(query, type)]) {
        const key = (q || "").trim().toLowerCase();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        merged.push(q);
        if (merged.length >= 20) break;
      }
      return merged;
    }
  } catch {
    // fall through
  }
  return fallbackQueries(query, type);
}

export function fallbackQueries(query: string, type: QueryType): string[] {
  const q = query.trim().toLowerCase();
  // Shared style/color modifiers used to broaden the generic family.
  const styles = ["minimal", "streetwear", "oversized", "vintage", "formal", "casual"];
  const colors = ["black", "white", "beige", "navy", "burgundy"];

  if (type === "brand") {
    return [
      `${q} bag`, `${q} sneakers`, `${q} jacket`, `${q} accessories`,
      `${q} shoes`, `${q} loafers`, `${q} men`, `${q} women`,
      `${q} new collection`, `${q} black`, `${q} white`, `${q} outerwear`,
      `${q} knit`, `${q} pants`, `${q} top`, `${q} runway`,
    ];
  }
  if (type === "weather") {
    return [
      `${q} day jacket`, `${q} outfit`, `${q} outerwear`, `${q} shoes`,
      `${q} layering`, `${q} men`, `${q} women`, `${q} accessories`,
      `${q} coat`, `${q} knit`, `${q} boots`, `${q} streetwear`,
      `${q} minimal`, `${q} oversized`, `${q} formal`, `${q} casual`,
    ];
  }
  if (type === "scenario") {
    return [
      `${q} outfit`, `${q} men`, `${q} women`,
      `${q} jacket`, `${q} shoes`, `${q} bag`, `${q} accessories`,
      `${q} top`, `${q} pants`, `${q} dress`, `${q} blazer`,
      `${q} streetwear`, `${q} minimal`, `${q} formal`, `${q} casual`,
      `${q} oversized`,
    ];
  }
  // Generic / color / category — broaden to 18+ phrasings.
  const base = [
    q, `${q} outfit`, `${q} fashion`, `${q} clothing`,
    `${q} men`, `${q} women`, `${q} jacket`, `${q} top`,
    `${q} bag`, `${q} shoes`, `${q} accessories`, `${q} outerwear`,
  ];
  const styled = styles.slice(0, 3).map((s) => `${s} ${q}`);
  const colored = colors.slice(0, 3).map((c) => `${c} ${q}`);
  return [...base, ...styled, ...colored].slice(0, 20);
}
