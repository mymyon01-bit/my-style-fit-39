/**
 * Korean → English alias map for Discover cache lookup.
 * ----------------------------------------------------
 * Korean queries hit a mostly-English product_cache and would otherwise
 * return zero on cold start. This map normalizes common KR fashion terms
 * into EN search families so the cache selector can OR-match against them
 * (and category-lock can stay active).
 *
 * Pure functions — no I/O, no async. Safe to import client-side.
 */

export interface KrAliasResult {
  isKorean: boolean;
  aliases: string[];      // EN tokens to OR into cache lookups
  family: string | null;  // primary EN family hint ("bag", "jacket", ...)
}

// Hangul Unicode block check — fast and accurate for "is this Korean?".
const HANGUL_RE = /[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/;

export function isKoreanQuery(q: string): boolean {
  return !!q && HANGUL_RE.test(q);
}

/**
 * Term-level KR → EN aliases. Order matters only for `family` resolution
 * (first match wins). Multi-word KR phrases listed before single tokens.
 */
const KR_ALIASES: Array<{ kr: string; aliases: string[]; family: string }> = [
  // multi-word styling phrases
  { kr: "코트 코디",     aliases: ["coat outfit", "outerwear styling", "coat look"], family: "coat" },
  { kr: "비오는날 코디", aliases: ["rainy outfit", "rain outerwear", "weather outfit"], family: "outerwear" },
  { kr: "데이트룩",      aliases: ["date outfit", "smart casual", "date look"], family: "outfit" },
  { kr: "출근룩",        aliases: ["work outfit", "business casual", "office look"], family: "outfit" },
  { kr: "미니멀 룩",     aliases: ["minimal outfit", "clean look", "neutral outfit"], family: "minimal" },
  { kr: "여름 코디",     aliases: ["summer outfit", "summer look"], family: "seasonal" },
  { kr: "겨울 코디",     aliases: ["winter outfit", "winter look"], family: "seasonal" },

  // bags
  { kr: "가방",   aliases: ["bag", "bags", "tote", "crossbody", "backpack"], family: "bag" },
  // outerwear
  { kr: "자켓",   aliases: ["jacket", "outerwear", "blazer", "bomber"], family: "jacket" },
  { kr: "재킷",   aliases: ["jacket", "outerwear", "blazer", "bomber"], family: "jacket" },
  { kr: "코트",   aliases: ["coat", "outerwear", "trench"], family: "coat" },
  { kr: "후드",   aliases: ["hoodie", "sweatshirt"], family: "hoodie" },
  // shoes
  { kr: "스니커즈", aliases: ["sneakers", "shoes", "trainers"], family: "sneakers" },
  { kr: "운동화",   aliases: ["sneakers", "running shoes", "trainers"], family: "sneakers" },
  { kr: "구두",     aliases: ["loafers", "dress shoes", "shoes"], family: "shoes" },
  // tops
  { kr: "셔츠",   aliases: ["shirt", "top"], family: "shirt" },
  { kr: "니트",   aliases: ["knit", "sweater"], family: "knit" },
  { kr: "티셔츠", aliases: ["t-shirt", "tee"], family: "tee" },
  // bottoms
  { kr: "바지",   aliases: ["pants", "trousers"], family: "pants" },
  { kr: "청바지", aliases: ["jeans", "denim"], family: "jeans" },
  { kr: "치마",   aliases: ["skirt"], family: "skirt" },
  // styles
  { kr: "미니멀", aliases: ["minimal", "clean", "neutral"], family: "minimal" },
  { kr: "힙한",   aliases: ["streetwear", "oversized", "urban"], family: "streetwear" },
  { kr: "코디",   aliases: ["outfit", "look", "styling"], family: "outfit" },
];

/**
 * Resolve KR → EN aliases. Non-Korean queries return isKorean=false and
 * an empty alias set (caller falls back to its normal lexical lookup).
 */
export function resolveKrAliases(query: string): KrAliasResult {
  const q = (query || "").trim();
  if (!isKoreanQuery(q)) {
    return { isKorean: false, aliases: [], family: null };
  }
  const aliases = new Set<string>();
  let family: string | null = null;
  for (const entry of KR_ALIASES) {
    if (q.includes(entry.kr)) {
      for (const a of entry.aliases) aliases.add(a);
      if (!family) family = entry.family;
    }
  }
  return { isKorean: true, aliases: Array.from(aliases), family };
}

/**
 * Build OR-clauses for a Supabase `.or()` ilike query against
 * (name, brand, search_query, category). Escapes commas/parens that would
 * break PostgREST's OR grammar.
 */
export function buildKrOrClauses(aliases: string[]): string {
  const safe = aliases
    .map((a) => a.replace(/[(),]/g, " ").trim())
    .filter((a) => a.length > 0);
  if (safe.length === 0) return "";
  const parts: string[] = [];
  for (const a of safe) {
    parts.push(`name.ilike.%${a}%`);
    parts.push(`brand.ilike.%${a}%`);
    parts.push(`search_query.ilike.%${a}%`);
    parts.push(`category.ilike.%${a}%`);
  }
  return parts.join(",");
}
