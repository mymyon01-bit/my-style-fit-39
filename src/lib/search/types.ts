/**
 * Shared Product type for the search engine modules.
 * Mirrors the shape used by DiscoverPage's AIRecommendation so the
 * runner output drops into existing UI code without conversion.
 */
export interface Product {
  id: string;
  title: string;
  brand?: string;
  price?: string;
  category?: string;
  imageUrl?: string | null;
  externalUrl?: string | null;
  storeName?: string | null;
  platform?: string | null;
  styleTags?: string[];
  color?: string;
  fit?: string;
  reason?: string;
}
