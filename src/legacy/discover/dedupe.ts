/**
 * Lightweight client-side dedupe for products coming back from the
 * Apify-first edge function. The edge function already dedupes during
 * upsert; this is a final guardrail before render.
 */
import type { DiscoverProduct } from "@/lib/discover/discover-types";
import { dedupeDiscover } from "@/lib/discover/discover-dedupe";

export function dedupeProducts(products: DiscoverProduct[]): DiscoverProduct[] {
  return dedupeDiscover(products).kept;
}
