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
  try {
    // Supply expansion pass: 12→16 queries, 40→70 candidate URLs per ingest cycle.
    const { data } = await supabase.functions.invoke("search-discovery", {
      body: { query, maxQueries: 16, maxCandidates: 70 },
    });
    return { inserted: Number(data?.inserted) || 0 };
  } catch {
    return { inserted: 0 };
  }
}

// Reserved for a future direct-ingestion path (e.g. user-supplied URL).
// Currently a no-op so call sites don't break.
export async function ingestProducts(_products: Product[]): Promise<void> {
  return;
}
