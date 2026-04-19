import { MEN_TERMS, WOMEN_TERMS } from "./constants";
import { getProductGender, type ProductGender } from "./getProductGender";

export type GenderFilter = "all" | "women" | "men";

export interface GenderableRow extends Record<string, unknown> {
  name?: string | null;
  brand?: string | null;
  category?: string | null;
  search_query?: string | null;
  gender?: string | null;
  department?: string | null;
  audience?: string | null;
  breadcrumb?: string | string[] | null;
  searchQuery?: string | null;
}

export type GenderMatchBucket = "same" | "unisex" | "unknown" | "opposite";

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildIntentRegex(terms: readonly string[]): RegExp {
  const parts = terms.map((term) => {
    const escaped = escapeRegex(term.toLowerCase());
    return /[a-z]/i.test(term)
      ? `(?<![a-z])${escaped}(?![a-z])`
      : escaped;
  });
  return new RegExp(`(${parts.join("|")})`, "i");
}

const MEN_INTENT_RE = buildIntentRegex(MEN_TERMS);
const WOMEN_INTENT_RE = buildIntentRegex(WOMEN_TERMS);

export function inferRowGender(row: GenderableRow): "women" | "men" | "unisex" {
  const gender = getProductGender(row);
  if (gender === "men" || gender === "women" || gender === "unisex") return gender;
  return "unisex";
}

function mapBucket(gender: ProductGender, target: Exclude<GenderFilter, "all">): GenderMatchBucket {
  if (gender === target) return "same";
  if (gender === "unisex") return "unisex";
  if (gender === null) return "unknown";
  return "opposite";
}

export function getGenderBucket(
  row: GenderableRow,
  gender: Exclude<GenderFilter, "all">,
): GenderMatchBucket {
  return mapBucket(getProductGender(row), gender);
}

export function partitionByGender<T extends GenderableRow>(
  rows: T[],
  gender: Exclude<GenderFilter, "all">,
): Record<GenderMatchBucket, T[]> {
  const buckets: Record<GenderMatchBucket, T[]> = {
    same: [],
    unisex: [],
    unknown: [],
    opposite: [],
  };
  for (const row of rows) {
    buckets[getGenderBucket(row, gender)].push(row);
  }
  return buckets;
}

export function prioritizeGenderPool<T extends GenderableRow>(
  rows: T[],
  gender: Exclude<GenderFilter, "all">,
): T[] {
  const buckets = partitionByGender(rows, gender);
  const preferred = [...buckets.same, ...buckets.unisex];
  if (preferred.length > 0) return preferred;
  if (buckets.unknown.length > 0) return buckets.unknown;
  return buckets.opposite;
}

export function passesGenderFilter(row: GenderableRow, gender: GenderFilter): boolean {
  if (gender === "all") return true;
  return getGenderBucket(row, gender) !== "opposite";
}

/** Map a profile.gender_preference value to a Discover filter. */
export function genderPreferenceToFilter(pref?: string | null): GenderFilter {
  if (!pref) return "all";
  const p = pref.toLowerCase();
  if (p === "female" || p === "women" || p === "woman" || p === "f") return "women";
  if (p === "male" || p === "men" || p === "man" || p === "m") return "men";
  return "all";
}

/**
 * Parse explicit gender intent from a free-text query (EN + KR).
 * Returns "men"/"women" only when an unambiguous gender token is present.
 */
export function parseGenderIntent(query: string): "men" | "women" | null {
  if (!query) return null;
  const q = query.toLowerCase();
  const w = WOMEN_INTENT_RE.test(q);
  const m = MEN_INTENT_RE.test(q);
  if (w && !m) return "women";
  if (m && !w) return "men";
  return null;
}

/**
 * Gender-aware ranking adjustment — only applied when query has explicit
 * gender intent. Strong enough to overpower a single category-token match.
 *   same gender:     +40
 *   unisex/unknown:  +15
 *   opposite gender: -60
 */
export function genderRankAdjustment(
  row: GenderableRow,
  intent: "men" | "women" | null,
): number {
  if (!intent) return 0;
  const g = getProductGender(row);
  if (g === intent) return 40;
  if (g === "unisex") return 15;
  if (g === null) return 0;
  return -60;
}
