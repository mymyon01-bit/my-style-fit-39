/**
 * Apify-first discovery — client-side trigger that hands the work to the
 * `discover-search-engine` edge function. The edge function is the only
 * place that holds APIFY_TOKEN / FIRECRAWL_API_KEY.
 *
 * The browser never talks to Apify directly; this is just a typed shim so
 * callers in /lib/discover can stay symmetric with the spec.
 */
import { supabase } from "@/integrations/supabase/client";

export interface ApifyDiscoveryInput {
  query: string;
  domains: string[];
  category?: string | null;
  limitPerDomain?: number;
}

export interface ApifyDiscoveryResult {
  query: string;
  domain: string;
  fetched_count: number;
  refined_count: number;
  inserted_count: number;
  deduped_count: number;
  failed_count: number;
}

export async function runApifyDiscovery(input: ApifyDiscoveryInput): Promise<ApifyDiscoveryResult[]> {
  const { data, error } = await supabase.functions.invoke("discover-search-engine", {
    body: {
      query: input.query,
      domains: input.domains,
      category: input.category ?? null,
      limitPerDomain: input.limitPerDomain ?? 30,
    },
  });
  if (error) {
    console.warn("[apifyDiscovery] edge invoke failed", error.message);
    return [];
  }
  return (data?.results as ApifyDiscoveryResult[] | undefined) ?? [];
}
