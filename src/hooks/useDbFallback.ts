import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * DB-first fallback: instantly returns cached `product_cache` rows that
 * loosely match the inferred category for a query, while live retrieval
 * runs in parallel elsewhere.
 *
 * Behaviour:
 *  - render DB content immediately (no spinner blocking the UI)
 *  - never blanks the previous results when a new query starts
 *  - safe to call on every keystroke; deduped by (query, category)
 */

export interface FallbackProduct {
  id: string;
  name: string;
  brand: string;
  price: string;
  category: string;
  reason: string;
  style_tags: string[];
  color: string;
  fit: string;
  image_url: string | null;
  source_url: string | null;
  store_name: string | null;
  platform: string | null;
}

interface Options {
  query: string;
  /** Inferred fashion category (e.g. "outerwear", "shoes"). Optional. */
  category?: string | null;
  /** Disable when search has already returned plenty of live results. */
  enabled?: boolean;
  limit?: number;
}

const inflight = new Map<string, Promise<FallbackProduct[]>>();

async function fetchFallback(
  query: string,
  category: string | null,
  limit: number
): Promise<FallbackProduct[]> {
  const key = `${query.toLowerCase().trim()}::${category || ""}::${limit}`;
  const existing = inflight.get(key);
  if (existing) return existing;

  const promise = (async () => {
    try {
      // Log the cluster usage for analytics
      if (query.length > 2) {
        supabase.from("query_clusters").insert({ query: query.toLowerCase().trim() }).then();
      }

      let q = supabase
        .from("product_cache")
        .select(
          "id, name, brand, price, category, style_tags, color_tags, fit, image_url, source_url, store_name, platform, reason"
        )
        .eq("is_active", true)
        .not("image_url", "is", null)
        .order("trend_score", { ascending: false })
        .limit(limit);

      if (category) q = q.ilike("category", `%${category}%`);

      // Loose name/tag match on the raw query (best-effort, no error if empty)
      const trimmed = query.trim();
      if (trimmed.length > 1) {
        q = q.or(
          `name.ilike.%${trimmed}%,brand.ilike.%${trimmed}%,search_query.ilike.%${trimmed}%`
        );
      }

      const { data, error } = await q;
      if (error || !data) return [];

      return data
        .filter((p: any) => typeof p.image_url === "string" && p.image_url.startsWith("https"))
        .map((p: any) => ({
          id: p.id,
          name: p.name,
          brand: p.brand || "",
          price: p.price || "",
          category: p.category || "",
          reason: p.reason || "Saved pick",
          style_tags: p.style_tags || [],
          color: (p.color_tags || [])[0] || "",
          fit: p.fit || "regular",
          image_url: p.image_url,
          source_url: p.source_url,
          store_name: p.store_name,
          platform: p.platform || null,
        }));
    } catch {
      return [];
    }
  })().finally(() => {
    // keep the dedup window short — 2s is enough to cover typing bursts
    setTimeout(() => inflight.delete(key), 2000);
  });

  inflight.set(key, promise);
  return promise;
}

export function useDbFallback({
  query,
  category = null,
  enabled = true,
  limit = 12,
}: Options) {
  const [items, setItems] = useState<FallbackProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const lastKey = useRef<string>("");

  useEffect(() => {
    if (!enabled) return;
    const trimmed = query.trim();
    if (!trimmed) {
      setItems([]);
      return;
    }
    const key = `${trimmed.toLowerCase()}::${category || ""}`;
    if (key === lastKey.current) return;
    lastKey.current = key;

    setLoading(true);
    let cancelled = false;
    fetchFallback(trimmed, category, limit).then((rows) => {
      if (cancelled) return;
      setItems(rows);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [query, category, enabled, limit]);

  return { items, loading };
}
