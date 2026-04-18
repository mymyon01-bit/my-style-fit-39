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
  // Fan out to THREE pipelines in parallel:
  //   1. search-discovery     (Firecrawl + Perplexity) — universal coverage
  //   2. multi-source-scraper (Apify ASOS/Zalando/Coupang/GShopping)
  //   3. discover-search-engine (Google CSE → Apify Web Scraper) — search-engine
  //      style: 10 query variants → 50–80 URLs → parallel page extraction.
  // Partial failure is fine; whichever returns first grows product_cache.
  try {
    const [discovery, multi, engine] = await Promise.allSettled([
      supabase.functions.invoke("search-discovery", {
        body: { query, maxQueries: 14, maxCandidates: 60 },
      }),
      supabase.functions.invoke("multi-source-scraper", {
        body: { query },
      }),
      supabase.functions.invoke("discover-search-engine", {
        body: { query },
      }),
    ]);
    const a = discovery.status === "fulfilled" ? Number(discovery.value.data?.inserted) || 0 : 0;
    const b = multi.status === "fulfilled" ? Number(multi.value.data?.inserted) || 0 : 0;
    const c = engine.status === "fulfilled" ? Number(engine.value.data?.totalInserted) || 0 : 0;
    return { inserted: a + b + c };
  } catch {
    return { inserted: 0 };
  }
}

// Reserved for a future direct-ingestion path (e.g. user-supplied URL).
// Currently a no-op so call sites don't break.
export async function ingestProducts(_products: Product[]): Promise<void> {
  return;
}
