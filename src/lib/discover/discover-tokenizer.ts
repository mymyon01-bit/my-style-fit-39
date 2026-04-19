/**
 * Discover tokenizer — shared by all DB selectors.
 * -------------------------------------------------
 * Single source of truth for query tokenization + scoring.
 *
 * Goals (Part 2A of the upgrade plan):
 *   - lowercase, trim, strip punctuation, split, drop weak tokens
 *   - remove fashion stopwords (look, outfit, style, 추천, 느낌, 코디, ...)
 *   - keep strong category/style/brand/color words
 *   - one canonical scoring function so DB selector + useDbTopGrid agree
 *
 * Pure functions only. Safe client-side. No I/O.
 */
import { resolveKrAliases } from "./krAliasMap";

/** Words that pollute scoring without adding semantic signal. */
const STOPWORDS = new Set<string>([
  // EN generic fashion fillers
  "look", "looks", "outfit", "outfits", "style", "styles", "styling",
  "fashion", "wear", "wearing", "clothes", "clothing", "vibes", "vibe",
  "for", "the", "a", "an", "and", "or", "with", "in", "on", "of", "to",
  "my", "your", "this", "that", "some", "any", "very", "really",
  "new", "best", "good", "nice", "cool",
  // KR generic fashion fillers
  "추천", "느낌", "코디", "스타일", "패션", "옷", "룩", "분위기",
]);

export interface TokenizedQuery {
  /** Original query, trimmed only. */
  raw: string;
  /** Lowercased + punct-stripped + split tokens, stopwords removed. */
  tokens: string[];
  /** Tokens + KR→EN alias expansions (deduped). */
  searchTerms: string[];
  /** Canonical EN family hint when query is Korean. */
  krFamily: string | null;
  /** True if input contained Hangul. */
  isKorean: boolean;
}

/** Lowercase, strip punct, split on whitespace, drop stopwords + sub-2-char noise. */
export function tokenizeQuery(raw: string): TokenizedQuery {
  const trimmed = (raw || "").trim();
  const cleaned = trimmed.toLowerCase().replace(/[(),.!?;:"']/g, " ");
  const all = cleaned
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));

  // Dedupe while preserving order.
  const seen = new Set<string>();
  const tokens: string[] = [];
  for (const t of all) {
    if (!seen.has(t)) {
      seen.add(t);
      tokens.push(t);
    }
  }

  const kr = resolveKrAliases(trimmed);
  const searchTerms = kr.isKorean && kr.aliases.length > 0
    ? Array.from(new Set([...tokens, ...kr.aliases]))
    : tokens;

  return {
    raw: trimmed,
    tokens,
    searchTerms,
    krFamily: kr.family,
    isKorean: kr.isKorean,
  };
}

/** Build a Postgres `.or()` ilike clause across name/brand/category/search_query. */
export function buildOrClause(terms: string[]): string {
  const safe = terms
    .map((t) => t.replace(/[(),]/g, " ").trim())
    .filter((t) => t.length >= 2);
  if (safe.length === 0) return "";
  const parts: string[] = [];
  for (const t of safe) {
    parts.push(`name.ilike.%${t}%`);
    parts.push(`brand.ilike.%${t}%`);
    parts.push(`search_query.ilike.%${t}%`);
    parts.push(`category.ilike.%${t}%`);
  }
  return parts.join(",");
}

export interface ScoreableRow {
  name?: string | null;
  brand?: string | null;
  category?: string | null;
  search_query?: string | null;
  created_at?: string | null;
}

/**
 * Canonical scoring (Part 2A spec):
 *   name +3, normalizedTitle +3 (we treat name as title), category +3,
 *   brand +2, search_query +1.
 * Caller adds freshness +1 and unseen +1 bonuses on top.
 */
export function scoreRowAgainstTokens(row: ScoreableRow, terms: string[]): number {
  if (terms.length === 0) return 0;
  const name = (row.name || "").toLowerCase();
  const brand = (row.brand || "").toLowerCase();
  const category = (row.category || "").toLowerCase();
  const sq = (row.search_query || "").toLowerCase();
  let score = 0;
  for (const t of terms) {
    if (name.includes(t)) score += 3;
    if (category.includes(t)) score += 3;
    if (brand.includes(t)) score += 2;
    if (sq.includes(t)) score += 1;
  }
  return score;
}

/** Freshness in seconds since epoch — caller normalizes against pool max. */
export function freshnessSeconds(row: ScoreableRow): number {
  if (!row.created_at) return 0;
  const t = new Date(row.created_at).getTime();
  return Number.isNaN(t) ? 0 : t / 1000;
}
