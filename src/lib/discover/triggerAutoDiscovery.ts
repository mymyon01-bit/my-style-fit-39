/**
 * Auto-discovery trigger
 * ----------------------
 * Fire-and-forget. When a Discover query is judged weak by `assessQueryCoverage`,
 * this function:
 *   1. checks an in-memory cooldown (6h) to avoid duplicate ingestion spam
 *   2. invokes `search-discovery` (healthy: Perplexity + Firecrawl + Naver) for
 *      the top N variants in priority order
 *   3. upserts the interpreted query into `query_clusters` for reuse
 *   4. records a diagnostics event
 *
 * Never blocks the UI, never throws. Apify is intentionally not used.
 */
import { supabase } from "@/integrations/supabase/client";
import { logDiscoverEvent } from "./discover-diagnostics";
import type { InterpretedQuery } from "./aiQueryInterpreter";

const COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6 hours
const MAX_VARIANTS_TO_TRIGGER = 4;
const triggerCache = new Map<string, number>();

function cooldownKey(query: string): string {
  return query.trim().toLowerCase();
}

function withinCooldown(key: string): boolean {
  const last = triggerCache.get(key);
  if (!last) return false;
  if (Date.now() - last > COOLDOWN_MS) {
    triggerCache.delete(key);
    return false;
  }
  return true;
}

export interface AutoDiscoveryInput {
  query: string;
  interpreted: InterpretedQuery;
  reason: string[];
}

export interface AutoDiscoveryResult {
  triggered: boolean;
  cooldownSuppressed: boolean;
  variantsTried: string[];
}

export async function triggerAutoDiscovery(input: AutoDiscoveryInput): Promise<AutoDiscoveryResult> {
  const key = cooldownKey(input.query);
  if (withinCooldown(key)) {
    logDiscoverEvent("discover_search_progress", {
      query: input.query,
      metadata: {
        auto_discovery_triggered: false,
        cooldown_suppressed: true,
        weak_reason: input.reason,
      },
    });
    return { triggered: false, cooldownSuppressed: true, variantsTried: [] };
  }
  triggerCache.set(key, Date.now());

  // Priority slice — exact normalized first, then category/material, then synonyms.
  const variants = input.interpreted.searchVariants.slice(0, MAX_VARIANTS_TO_TRIGGER);

  // Cache the interpretation so future searches skip AI.
  void persistInterpretation(input.interpreted).catch((err) =>
    console.warn("[triggerAutoDiscovery] persistInterpretation failed", err),
  );

  // Fan out to discovery — fire-and-forget per variant.
  for (const v of variants) {
    void supabase.functions
      .invoke("search-discovery", { body: { query: v } })
      .catch((err) => console.warn(`[triggerAutoDiscovery] search-discovery failed for "${v}"`, err));
  }

  logDiscoverEvent("discover_search_progress", {
    query: input.query,
    metadata: {
      auto_discovery_triggered: true,
      cooldown_suppressed: false,
      weak_reason: input.reason,
      variant_count: variants.length,
      variants,
      provider_targets: ["search-discovery"],
      primary_category: input.interpreted.primaryCategory,
    },
  });

  return { triggered: true, cooldownSuppressed: false, variantsTried: variants };
}

async function persistInterpretation(interp: InterpretedQuery): Promise<void> {
  const clusterKey = `auto:${interp.normalized}`.slice(0, 200);
  const tags = [
    ...(interp.styles || []),
    ...(interp.materials || []),
    ...(interp.colors || []),
    ...(interp.scenario ? [interp.scenario] : []),
  ].filter(Boolean);
  await supabase.rpc("upsert_query_cluster", {
    _cluster_key: clusterKey,
    _query_family: interp.primaryCategory || "general",
    _normalized_query: interp.normalized,
    _category: interp.primaryCategory ?? null,
    _tags: tags,
    _product_ids: [],
  });
}

/** Looks for a cached interpretation in query_clusters by normalized query. */
export async function loadCachedInterpretation(normalized: string): Promise<{
  primaryCategory: string | null;
  tags: string[];
  lastRefreshedAt: string | null;
} | null> {
  try {
    const { data, error } = await supabase
      .from("query_clusters")
      .select("category, tags, last_refreshed_at")
      .eq("cluster_key", `auto:${normalized}`.slice(0, 200))
      .maybeSingle();
    if (error || !data) return null;
    return {
      primaryCategory: (data.category as string) ?? null,
      tags: (data.tags as string[]) ?? [],
      lastRefreshedAt: (data.last_refreshed_at as string) ?? null,
    };
  } catch {
    return null;
  }
}
