/**
 * Gender filter for Discover
 * --------------------------
 * product_cache has no `gender` column, so we infer from textual signals
 * (name, category, search_query, brand) using a keyword dictionary.
 *
 * - "women" / "men" returns rows that match those signals AND drops rows
 *   that clearly belong to the opposite gender.
 * - Unisex / unknown rows are KEPT for both genders (better recall on a
 *   sparse cache than strict exclusion).
 * - "all" is a no-op pass-through.
 */
export type GenderFilter = "all" | "women" | "men";

const WOMEN_HINTS = [
  "women", "woman", "womens", "women's", "ladies", "ladys", "lady",
  "female", "femme", "girls", "girl", "miss", "ms.",
  "여성", "여자", "우먼", "미스",
  "dress", "skirt", "blouse", "heels", "pumps", "stiletto", "bra", "lingerie",
  "midi", "maxi", "bodycon", "camisole", "kitten heel", "slingback",
];

const MEN_HINTS = [
  "men", "mens", "men's", "man", "male", "boys", "boy", "guys", "gentleman",
  "남성", "남자", "맨즈",
  "boxer", "boxers", "necktie", "tuxedo",
];

// Strong opposite-gender signals — drop on conflict.
const STRICT_WOMEN_ONLY = ["dress", "skirt", "blouse", "heels", "lingerie", "bra"];
const STRICT_MEN_ONLY = ["boxer", "boxers", "necktie", "tuxedo"];

interface GenderableRow {
  name?: string | null;
  brand?: string | null;
  category?: string | null;
  search_query?: string | null;
}

function buildHaystack(row: GenderableRow): string {
  return [row.name, row.brand, row.category, row.search_query]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function matchesAny(hay: string, hints: string[]): boolean {
  return hints.some((h) => hay.includes(h));
}

export function inferRowGender(row: GenderableRow): "women" | "men" | "unisex" {
  const hay = buildHaystack(row);
  const w = matchesAny(hay, WOMEN_HINTS);
  const m = matchesAny(hay, MEN_HINTS);
  if (w && !m) return "women";
  if (m && !w) return "men";
  return "unisex";
}

export function passesGenderFilter(row: GenderableRow, gender: GenderFilter): boolean {
  if (gender === "all") return true;
  const hay = buildHaystack(row);
  if (gender === "women") {
    if (matchesAny(hay, STRICT_MEN_ONLY)) return false;
    // Keep women + unisex (no strong signal). Only drop confirmed men.
    return inferRowGender(row) !== "men";
  }
  // men
  if (matchesAny(hay, STRICT_WOMEN_ONLY)) return false;
  return inferRowGender(row) !== "women";
}

/** Map a profile.gender_preference value to a Discover filter. */
export function genderPreferenceToFilter(pref?: string | null): GenderFilter {
  if (!pref) return "all";
  const p = pref.toLowerCase();
  if (p === "female" || p === "women" || p === "woman" || p === "f") return "women";
  if (p === "male" || p === "men" || p === "man" || p === "m") return "men";
  return "all";
}
