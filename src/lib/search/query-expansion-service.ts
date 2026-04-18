import type { QueryType } from "./query-intent-service";
import { supabase } from "@/integrations/supabase/client";

/**
 * Expand the user's raw query into a "query family" of up to 24 variants
 * (continuous discovery target: 15-30 new candidates per search).
 *
 * Variants ROTATE per call: a per-call shuffle seed reorders the local
 * fallback so consecutive searches for the same term hit different
 * sub-queries first → fresh products even when the cache is warm.
 */
export async function expandQueries(query: string, type: QueryType): Promise<string[]> {
  try {
    const { data, error } = await supabase.functions.invoke("search-discovery", {
      body: { query, expandOnly: true, maxQueries: 20 },
    });
    if (!error && data?.queries && Array.isArray(data.queries) && data.queries.length > 0) {
      // Merge edge-function results with local fallback to guarantee breadth,
      // de-duplicating while preserving order. Cap at 24.
      const merged: string[] = [];
      const seen = new Set<string>();
      for (const q of [...(data.queries as string[]), ...fallbackQueries(query, type)]) {
        const key = (q || "").trim().toLowerCase();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        merged.push(q);
        if (merged.length >= 24) break;
      }
      return merged;
    }
  } catch {
    // fall through
  }
  return fallbackQueries(query, type);
}

/** Tiny seeded shuffle so rotation is deterministic per call but varies over time. */
function rotateVariants(arr: string[]): string[] {
  const seed = Date.now() % 7;
  if (seed === 0 || arr.length <= 2) return arr;
  // Rotate by `seed` positions — keeps adjacency but shifts which variants
  // hit the discovery budget first.
  return [...arr.slice(seed), ...arr.slice(0, seed)];
}

export function fallbackQueries(query: string, type: QueryType): string[] {
  const q = query.trim().toLowerCase();
  // Shared style / fit / context modifiers used to broaden the family.
  const styles = ["minimal", "streetwear", "oversized", "vintage", "tailored", "relaxed"];
  const colors = ["black", "white", "beige", "navy", "olive"];
  const contexts = ["new collection", "men fashion", "women fashion", "outfit"];

  if (type === "brand") {
    return rotateVariants([
      `${q} bag`, `${q} sneakers`, `${q} jacket`, `${q} accessories`,
      `${q} shoes`, `${q} loafers`, `${q} men`, `${q} women`,
      `${q} new collection`, `${q} black`, `${q} white`, `${q} outerwear`,
      `${q} knit`, `${q} pants`, `${q} top`, `${q} runway`,
      `${q} resort`, `${q} archive`, `${q} fall`, `${q} spring`,
    ]);
  }
  if (type === "weather") {
    return rotateVariants([
      `${q} day jacket`, `${q} outfit`, `${q} outerwear`, `${q} shoes`,
      `${q} layering`, `${q} men`, `${q} women`, `${q} accessories`,
      `${q} coat`, `${q} knit`, `${q} boots`, `${q} streetwear`,
      `${q} minimal`, `${q} oversized`, `tailored ${q} outerwear`, `${q} casual`,
      `street ${q} outfit`, `minimal ${q} coat`,
    ]);
  }
  if (type === "scenario") {
    return rotateVariants([
      `${q} outfit`, `${q} men`, `${q} women`,
      `${q} jacket`, `${q} shoes`, `${q} bag`, `${q} accessories`,
      `${q} top`, `${q} pants`, `${q} dress`, `${q} blazer`,
      `${q} streetwear`, `${q} minimal`, `${q} formal`, `${q} casual`,
      `${q} oversized`, `${q} tailored`, `${q} vintage`,
    ]);
  }
  // Generic / color / category — broaden to a ~22-variant family.
  // Examples for "black jacket":
  //   "black zip jacket", "tailored black outerwear",
  //   "minimal black coat", "street black jacket outfit",
  //   "black jacket men fashion"
  const base = [
    q, `${q} outfit`, `${q} fashion`, `${q} clothing`,
    `${q} men`, `${q} women`, `${q} jacket`, `${q} top`,
    `${q} bag`, `${q} shoes`, `${q} accessories`, `${q} outerwear`,
  ];
  const styled = styles.slice(0, 4).map((s) => `${s} ${q}`);
  const colored = colors.slice(0, 3).map((c) => `${c} ${q}`);
  const contextual = contexts.map((c) => `${q} ${c}`);
  return rotateVariants([...base, ...styled, ...colored, ...contextual]).slice(0, 22);
}
