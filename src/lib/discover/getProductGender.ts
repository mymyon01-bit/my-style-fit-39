import { MEN_TERMS, UNISEX_TERMS, WOMEN_TERMS } from "./constants";

export type ProductGender = "men" | "women" | "unisex" | null;

type GenderLikeValue = string | number | boolean | null | undefined | GenderLikeValue[] | Record<string, unknown>;

export interface GenderLikeProduct {
  gender?: GenderLikeValue;
  department?: GenderLikeValue;
  audience?: GenderLikeValue;
  category?: GenderLikeValue;
  subcategory?: GenderLikeValue;
  breadcrumb?: GenderLikeValue;
  breadcrumbs?: GenderLikeValue;
  name?: GenderLikeValue;
  title?: GenderLikeValue;
  search_query?: GenderLikeValue;
  searchQuery?: GenderLikeValue;
  tags?: GenderLikeValue;
  style_tags?: GenderLikeValue;
  styleTags?: GenderLikeValue;
  reason?: GenderLikeValue;
}

const EXTRA_MEN_TERMS = ["menswear", "for men", "for him", "mens fashion", "남성용"] as const;
const EXTRA_WOMEN_TERMS = ["womenswear", "for women", "for her", "womens fashion", "여성용"] as const;

function flatten(value: GenderLikeValue): string[] {
  if (value == null) return [];
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return [String(value)];
  }
  if (Array.isArray(value)) return value.flatMap(flatten);
  if (typeof value === "object") return Object.values(value).flatMap(flatten);
  return [];
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildTermRegex(terms: readonly string[]): RegExp {
  const parts = terms.map((term) => {
    const escaped = escapeRegex(term.toLowerCase());
    return /[a-z]/i.test(term)
      ? `(?<![a-z])${escaped}(?![a-z])`
      : escaped;
  });
  return new RegExp(`(${parts.join("|")})`, "i");
}

const MEN_RE = buildTermRegex([...MEN_TERMS, ...EXTRA_MEN_TERMS]);
const WOMEN_RE = buildTermRegex([...WOMEN_TERMS, ...EXTRA_WOMEN_TERMS]);
const UNISEX_RE = buildTermRegex(UNISEX_TERMS);

function collectGenderText(product: Record<string, unknown>): string {
  return [
    product.gender,
    product.department,
    product.audience,
    product.category,
    product.subcategory,
    product.breadcrumb,
    product.breadcrumbs,
    product.name,
    product.title,
    product.search_query,
    product.searchQuery,
    product.tags,
    product.style_tags,
    product.styleTags,
    product.reason,
  ]
    .flatMap(flatten)
    .join(" ")
    .toLowerCase();
}

export function getProductGender(product: unknown): ProductGender {
  if (!product || typeof product !== "object") return null;
  const text = collectGenderText(product as Record<string, unknown>);
  if (!text) return null;

  const hasMen = MEN_RE.test(text);
  const hasWomen = WOMEN_RE.test(text);
  const hasUnisex = UNISEX_RE.test(text);

  if (hasUnisex || (hasMen && hasWomen)) return "unisex";
  if (hasMen) return "men";
  if (hasWomen) return "women";
  return null;
}