/**
 * Firecrawl is used SERVER-SIDE inside discover-search-engine to enrich
 * partial scrapes (missing title/price/image/brand). This client module is
 * a placeholder that satisfies the architectural spec; the actual fetch
 * lives in the edge function. We never call Firecrawl from the browser.
 */
export interface PartialProduct {
  productUrl: string;
  title?: string | null;
  imageUrl?: string | null;
  price?: number | null;
  brand?: string | null;
}

export async function refineWithFirecrawl(product: PartialProduct): Promise<PartialProduct> {
  // No-op on the client. Refinement runs inside discover-search-engine.
  return product;
}
