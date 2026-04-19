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

/**
 * Cooldown is shortened so weak queries can be re-fanned out within the same
 * browsing session if the first pass returned little. 90 minutes is enough
 * to avoid duplicate spam without making Discover feel stalled.
 */
const COOLDOWN_MS = 90 * 60 * 1000;
const MAX_VARIANTS_TO_TRIGGER = 6;
/**
 * Per-variant source fan-out. Each variant invokes `search-discovery`
 * (Perplexity + Firecrawl + Naver — KR auto-routed inside the function)
 * AND `multi-source-scraper` so we hit two healthy backends per variant.
 */
const SOURCE_TARGETS = ["search-discovery", "multi-source-scraper"] as const;
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
  /** True when ingestion has been initiated; the hook can use this to
   *  schedule a single soft refresh without polling. */
  shouldRefresh: boolean;
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
    return { triggered: false, cooldownSuppressed: true, variantsTried: [], shouldRefresh: false };
  }
  triggerCache.set(key, Date.now());

  // Priority slice — exact normalized first, then category/material, then synonyms.
  const variants = input.interpreted.searchVariants.slice(0, MAX_VARIANTS_TO_TRIGGER);

  // Cache the interpretation so future searches skip AI.
  void persistInterpretation(input.interpreted).catch((err) =>
    console.warn("[triggerAutoDiscovery] persistInterpretation failed", err),
  );

  // Fan out to discovery + multi-source — fire-and-forget per variant × source.
  // We DON'T await: the hook handles the soft-refresh after a delay.
  for (const v of variants) {
    for (const target of SOURCE_TARGETS) {
      void supabase.functions
        .invoke(target, { body: { query: v } })
        .catch((err) =>
          console.warn(`[triggerAutoDiscovery] ${target} failed for "${v}"`, err),
        );
    }
  }

  logDiscoverEvent("discover_search_progress", {
    query: input.query,
    metadata: {
      auto_discovery_triggered: true,
      cooldown_suppressed: false,
      weak_reason: input.reason,
      variant_count: variants.length,
      variants,
      provider_targets: [...SOURCE_TARGETS],
      primary_category: input.interpreted.primaryCategory,
    },
  });

  return { triggered: true, cooldownSuppressed: false, variantsTried: variants, shouldRefresh: true };
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
