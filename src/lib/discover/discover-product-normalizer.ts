/**
 * Discover product normalizer
 * ---------------------------
 * Single conversion point from any upstream shape into `DiscoverProduct`.
 * Accepts:
 *   - product_cache rows (snake_case)
 *   - search-runner `Product` objects (camelCase)
 *   - raw scraper payloads (best-effort)
 *
 * Boundary adapter pattern: nothing inside /lib/discover should ever read
 * raw fields directly — always normalize first.
 */
import type { Product } from "@/lib/search/types";
import { sourceFromUrl } from "@/lib/search/sources";
import { freshnessWeight } from "@/lib/search/freshness";
import { inferCategory } from "@/lib/search/product-normalizer";
import type { DiscoverProduct } from "./discover-types";

const PRICE_RE = /-?\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?/;
const CURRENCY_SYMBOL_MAP: Record<string, string> = {
  "$": "USD",
  "€": "EUR",
  "£": "GBP",
  "¥": "JPY",
  "₩": "KRW",
};

function normalizeTitle(raw: string): string {
  return (raw || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parsePriceString(raw: unknown, currencyHint?: string | null): { price: number | null; currency: string | null } {
  if (raw == null) return { price: null, currency: currencyHint ?? null };
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return { price: raw, currency: currencyHint ?? null };
  }
  const str = String(raw);
  let currency = currencyHint ?? null;
  for (const [sym, code] of Object.entries(CURRENCY_SYMBOL_MAP)) {
    if (str.includes(sym)) { currency = code; break; }
  }
  const m = str.match(PRICE_RE);
  if (!m) return { price: null, currency };
  const cleaned = m[0].replace(/[.,](?=\d{3}\b)/g, "").replace(",", ".");
  const value = Number.parseFloat(cleaned);
  return { price: Number.isFinite(value) ? value : null, currency };
}

function hostnameOf(url: string | null | undefined): string {
  if (!url) return "unknown";
  try { return new URL(url).hostname.toLowerCase(); } catch { return "unknown"; }
}

function pickString(...candidates: unknown[]): string | null {
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  return null;
}

function pickArray(...candidates: unknown[]): string[] {
  for (const c of candidates) {
    if (Array.isArray(c) && c.length > 0) return c.filter((v) => typeof v === "string");
  }
  return [];
}

export interface NormalizeContext {
  originalQuery: string;
  queryFamily?: string;
}

/** Normalize a product_cache row OR a search-runner Product into DiscoverProduct.
 *  Returns null if mandatory fields (image, url, title) are missing. */
export function normalizeDiscoverProduct(raw: unknown, ctx: NormalizeContext): DiscoverProduct | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  const title = pickString(r.title, r.name);
  const imageUrl = pickString(r.imageUrl, r.image_url);
  const productUrl = pickString(r.productUrl, r.externalUrl, r.source_url);
  if (!title || !imageUrl || !productUrl) return null;

  const id = pickString(r.id, productUrl) ?? `${title}-${Date.now()}`;
  const category = pickString(r.category) ?? inferCategory(title);
  const subcategory = pickString(r.subcategory);
  const brand = pickString(r.brand);
  const colorTags = pickArray(r.color_tags, r.colorTags);
  const color = pickString(r.color, colorTags[0]);
  const gender = pickString(r.gender, r.gender_preference);
  const createdAt = pickString(r.createdAt, r.created_at) ?? new Date().toISOString();
  const lastVerifiedAt = pickString(r.lastVerifiedAt, r.last_validated, r.lastValidated);

  const currencyHint = pickString(r.currency);
  const { price, currency } = parsePriceString(r.price ?? r.priceText, currencyHint);

  const sourceDomain = hostnameOf(productUrl);
  const source = pickString(r.source) ?? sourceFromUrl(productUrl);

  // Freshness — reuse the existing weight function so every Discover layer
  // agrees on what "fresh" means.
  const freshnessScore = freshnessWeight({
    createdAt,
    lastValidated: lastVerifiedAt,
  } as Product);

  return {
    id,
    title,
    normalizedTitle: normalizeTitle(title),
    brand,
    price,
    currency,
    imageUrl,
    cutoutImageUrl: pickString(r.cutoutImageUrl, r.cutout_image_url),
    productUrl,
    category,
    subcategory,
    color,
    gender,
    source,
    sourceDomain,
    originalQuery: ctx.originalQuery,
    queryFamily: ctx.queryFamily ?? ctx.originalQuery,
    freshnessScore,
    createdAt,
    lastVerifiedAt,
  };
}

/** Convenience: bulk normalize, dropping invalid records silently. */
export function normalizeDiscoverProducts(raws: unknown[], ctx: NormalizeContext): DiscoverProduct[] {
  const out: DiscoverProduct[] = [];
  for (const raw of raws) {
    const normalized = normalizeDiscoverProduct(raw, ctx);
    if (normalized) out.push(normalized);
  }
  return out;
}
