/**
 * Main client orchestrator for the new Apify-first Discover pipeline.
 *
 * This is a *trigger* — it kicks the edge function once per query family
 * (it's the edge function that fans out to per-domain Apify scrapers and
 * Firecrawl refinement). Returns per-domain ingestion telemetry.
 *
 * Designed to be fire-and-forget from useDiscoverSearch.
 */
import { expandQuery } from "./expand";
import { getSourcePlan, type ParsedQueryLike } from "./sourcePlan";
import { runApifyDiscovery, type ApifyDiscoveryResult } from "./apifyDiscovery";

export interface RunDiscoveryReport {
  query: string;
  variants: string[];
  domains: string[];
  perDomain: ApifyDiscoveryResult[];
  totalInserted: number;
}

export async function runDiscovery(parsedQuery: ParsedQueryLike): Promise<RunDiscoveryReport> {
  const variants = expandQuery(parsedQuery.rawQuery);
  const plan = getSourcePlan(parsedQuery);

  // Single edge invocation per user search — the edge function expands
  // internally too and runs Apify scrapers in parallel across domains.
  const results = await runApifyDiscovery({
    query: parsedQuery.rawQuery,
    domains: plan.domains,
    category: plan.category,
    limitPerDomain: 30,
  });

  const totalInserted = results.reduce((sum, r) => sum + (r.inserted_count ?? 0), 0);
  return {
    query: parsedQuery.rawQuery,
    variants,
    domains: plan.domains,
    perDomain: results,
    totalInserted,
  };
}
