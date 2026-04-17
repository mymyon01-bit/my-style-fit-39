import type { QueryType } from "./query-intent-service";
import { supabase } from "@/integrations/supabase/client";

/**
 * Expand the user's raw query into a "query family" of 8-15 variants.
 * Tries the search-discovery edge function (which uses Perplexity + a
 * deterministic family generator); falls back to a local family on error.
 */
export async function expandQueries(query: string, type: QueryType): Promise<string[]> {
  try {
    const { data, error } = await supabase.functions.invoke("search-discovery", {
      body: { query, expandOnly: true, maxQueries: 12 },
    });
    if (!error && data?.queries && Array.isArray(data.queries) && data.queries.length > 0) {
      return data.queries.slice(0, 15);
    }
  } catch {
    // fall through
  }
  return fallbackQueries(query, type);
}

export function fallbackQueries(query: string, type: QueryType): string[] {
  const q = query.trim().toLowerCase();
  if (type === "brand") {
    return [
      `${q} bag`, `${q} sneakers`, `${q} jacket`, `${q} accessories`,
      `${q} shoes`, `${q} loafers`, `${q} men`, `${q} women`,
      `${q} new collection`, `${q} black`,
    ];
  }
  if (type === "weather") {
    return [
      `${q} day jacket`, `${q} outfit`, `${q} outerwear`, `${q} shoes`,
      `${q} layering`, `${q} men`, `${q} women`, `${q} accessories`,
    ];
  }
  if (type === "scenario") {
    return [
      `${q} outfit`, `${q} men`, `${q} women`,
      `${q} jacket`, `${q} shoes`, `${q} bag`, `${q} accessories`,
    ];
  }
  return [
    q, `${q} outfit`, `${q} fashion`, `${q} clothing`,
    `${q} men`, `${q} women`, `${q} streetwear`, `${q} minimal`,
    `black ${q}`, `oversized ${q}`,
  ];
}
