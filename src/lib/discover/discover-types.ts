/**
 * DiscoverProduct — the canonical product shape used everywhere inside the
 * Discover module. Decoupled from the legacy `Product` type used by the
 * search-runner so we can evolve the schema without touching edge functions.
 *
 * Conversion happens at the boundary (discover-product-normalizer.ts):
 *   product_cache row | search-runner Product  →  DiscoverProduct
 */

export interface DiscoverProduct {
  id: string;
  title: string;
  /** lowercased, punctuation-stripped, deduped-tokens — used for fingerprint dedupe. */
  normalizedTitle: string;
  brand: string | null;
  /** Numeric price in `currency` units. null when unparseable. */
  price: number | null;
  currency: string | null;
  imageUrl: string;
  cutoutImageUrl?: string | null;
  productUrl: string;
  category: string;
  subcategory?: string | null;
  color?: string | null;
  gender?: string | null;
  /** Normalized source key (asos, farfetch, musinsa, …). */
  source: string;
  /** Raw hostname extracted from productUrl. */
  sourceDomain: string;
  /** The user-typed query that started this search session. */
  originalQuery: string;
  /** The expansion variant that surfaced this product. */
  queryFamily: string;
  /** 0..1 — higher = fresher. Decays from createdAt. */
  freshnessScore: number;
  /** ISO. Always present (falls back to now() during normalization). */
  createdAt: string;
  lastVerifiedAt?: string | null;
}

/** Lightweight metadata appended by the seen-filter / ranker. Optional so
 *  raw normalized records can flow through pipelines that don't need it. */
export interface DiscoverProductAnnotations {
  isLocalSeen: boolean;
  isDbSeen: boolean;
  isUnseen: boolean;
  isFresh: boolean;
  finalScore: number;
}

export type AnnotatedDiscoverProduct = DiscoverProduct & DiscoverProductAnnotations;
