/**
 * Ingestion is owned by the edge functions (product-search, search-discovery,
 * commerce-scraper) which upsert into product_cache with service-role
 * credentials. The client just triggers the relevant function — RLS prevents
 * direct writes from the browser.
 *
 * This façade lets future code call `ingestProducts()` symmetrically with
 * the rest of the search modules.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Product } from "./types";

export async function ingestQuery(query: string): Promise<{ inserted: number }> {
  // Fan out to BOTH pipelines in parallel:
  //   1. search-discovery (Firecrawl + Perplexity) — universal coverage
  //   2. multi-source-scraper (Apify ASOS/Zalando + Crawlbase Farfetch)
  // Partial failure is fine; whichever returns first grows product_cache.
  try {
    const [discovery, multi] = await Promise.allSettled([
      supabase.functions.invoke("search-discovery", {
        body: { query, maxQueries: 14, maxCandidates: 60 },
      }),
      supabase.functions.invoke("multi-source-scraper", {
        body: { query },
      }),
    ]);
    const a = discovery.status === "fulfilled" ? Number(discovery.value.data?.inserted) || 0 : 0;
    const b = multi.status === "fulfilled" ? Number(multi.value.data?.inserted) || 0 : 0;
    return { inserted: a + b };
  } catch {
    return { inserted: 0 };
  }
}

// Reserved for a future direct-ingestion path (e.g. user-supplied URL).
// Currently a no-op so call sites don't break.
export async function ingestProducts(_products: Product[]): Promise<void> {
  return;
}
