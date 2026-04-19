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
  subcategory?: string | null;
  imageUrl?: string | null;
  externalUrl?: string | null;
  storeName?: string | null;
  platform?: string | null;
  styleTags?: string[];
  tags?: string[];
  color?: string;
  fit?: string;
  reason?: string;
  gender?: string | null;
  department?: string | null;
  audience?: string | null;
  breadcrumb?: string | string[] | null;
  searchQuery?: string | null;
  /** ISO timestamp when the product was first cached. Used for freshness decay. */
  createdAt?: string | null;
  /** ISO timestamp of the last successful image/source validation. */
  lastValidated?: string | null;
  /** Source signal carried through from the cache for ranking. */
  trendScore?: number;
  /** Normalized source key derived from externalUrl host (asos, farfetch, …). */
  source?: string;
}
