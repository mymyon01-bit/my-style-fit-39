import { supabase } from "@/integrations/supabase/client";
import type { Product } from "./types";
import { normalizeFromCache } from "./product-normalizer";

/**
 * Discover products for a single shopping query.
 * Delegates to the product-search edge function which:
 *  - serves cached DB products instantly
 *  - triggers external commerce-scraper / search-discovery in the background
 */
export async function discoverProducts(query: string, opts: {
  excludeIds?: string[];
  limit?: number;
  freshSearch?: boolean;
} = {}): Promise<Product[]> {
  try {
    const { data, error } = await supabase.functions.invoke("product-search", {
      body: {
        query,
        limit: opts.limit ?? 18,
        excludeIds: opts.excludeIds || [],
        expandExternal: true,
        randomize: true,
        freshSearch: opts.freshSearch ?? false,
      },
    });
    if (error || !data?.products) return [];
    return (data.products as unknown[]).map(normalizeFromCache).filter(Boolean) as Product[];
  } catch {
    return [];
  }
}
