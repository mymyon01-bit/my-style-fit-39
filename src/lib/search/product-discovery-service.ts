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
  const body = {
    query,
    limit: opts.limit ?? 18,
    excludeIds: opts.excludeIds || [],
    expandExternal: true,
    randomize: true,
    freshSearch: opts.freshSearch ?? false,
  };

  // Retry up to 3x on transient BOOT_ERROR / 503 cold-starts
  const delays = [250, 700, 1400];
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      const { data, error } = await supabase.functions.invoke("product-search", { body });
      const msg = (error as any)?.message ?? "";
      const isBoot = /BOOT_ERROR|failed to start|503/i.test(msg);
      if (isBoot && attempt < delays.length) {
        await new Promise((r) => setTimeout(r, delays[attempt]));
        continue;
      }
      if (error || !data?.products) return [];
      return (data.products as unknown[]).map(normalizeFromCache).filter(Boolean) as Product[];
    } catch (e: any) {
      const msg = e?.message ?? "";
      if (/BOOT_ERROR|failed to start|503/i.test(msg) && attempt < delays.length) {
        await new Promise((r) => setTimeout(r, delays[attempt]));
        continue;
      }
      return [];
    }
  }
  return [];
}
