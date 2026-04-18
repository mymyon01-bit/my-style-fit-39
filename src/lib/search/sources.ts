/**
 * Source aggregation: derive a normalized `source` from a product URL host
 * and enforce a per-source quota in the result mixer so no single store
 * dominates the visible grid.
 *
 * Korean launch (Nov 2025): Naver, Coupang, Musinsa, Kream, SSG, Gmarket,
 * 29CM, W Concept are first-class. `isKoreanMarketQuery` + `enforceKoreanMix`
 * keep KR sources in front when the query feels Korean.
 */
import type { Product } from "./types";

export type SourceKey =
  // Korean sources (priority for KR launch)
  | "naver"
  | "coupang"
  | "musinsa"
  | "kream"
  | "ssg"
  | "gmarket"
  | "29cm"
  | "wconcept"
  | "ably"
  | "zigzag"
  | "interpark"
  // Western sources
  | "asos"
  | "farfetch"
  | "yoox"
  | "zalando"
  | "ssense"
  | "net-a-porter"
  | "mr-porter"
  | "mytheresa"
  | "matchesfashion"
  | "endclothing"
  | "nordstrom"
  | "shopbop"
  | "revolve"
  | "luisaviaroma"
  | "uniqlo"
  | "cos"
  | "arket"
  | "hm"
  | "zara"
  | "everlane"
  | "aritzia"
  | "saksfifthavenue"
  | "neimanmarcus"
  | "amazon"
  | "other";

const KOREAN_SOURCES: ReadonlySet<SourceKey> = new Set<SourceKey>([
  "naver", "coupang", "musinsa", "kream", "ssg",
  "gmarket", "29cm", "wconcept", "ably", "zigzag", "interpark",
]);

/**
 * Korean source tiers — drives per-tier ranking weight in `enforceKoreanMix`.
 *  T1 = style core + primary inventory (Musinsa + Naver) → top rows
 *  T2 = conversion / price (Coupang + Interpark) → mid rows (Interpark capped)
 *  T3 = western fallback → lower rows
 */
export const KR_TIER_1: ReadonlySet<SourceKey> = new Set<SourceKey>(["musinsa", "naver"]);
export const KR_TIER_2: ReadonlySet<SourceKey> = new Set<SourceKey>(["coupang", "interpark"]);
export function krTier(s: SourceKey): 1 | 2 | 3 | 0 {
  if (KR_TIER_1.has(s)) return 1;
  if (KR_TIER_2.has(s)) return 2;
  if (KOREAN_SOURCES.has(s)) return 2; // other KR (kream, ssg, 29cm, wconcept, gmarket, ably, zigzag) act as T2
  return 3;
}

const HOST_RULES: Array<{ re: RegExp; source: SourceKey }> = [
  // Korean hosts FIRST so naver.com matches before generic rules
  { re: /shopping\.naver\.com|smartstore\.naver\.com|brand\.naver\.com|(^|\.)naver\.com/i, source: "naver" },
  { re: /(^|\.)coupang\.com/i, source: "coupang" },
  { re: /(^|\.)musinsa\.com/i, source: "musinsa" },
  { re: /(^|\.)kream\.co\.kr/i, source: "kream" },
  { re: /(^|\.)ssg\.com/i, source: "ssg" },
  { re: /(^|\.)gmarket\.co\.kr/i, source: "gmarket" },
  { re: /(^|\.)29cm\.co\.kr/i, source: "29cm" },
  { re: /wconcept\.co\.kr/i, source: "wconcept" },
  { re: /(^|\.)a-bly\.com|(^|\.)ably\.kr/i, source: "ably" },
  { re: /zigzag\.kr/i, source: "zigzag" },
  { re: /(^|\.)interpark\.com|(^|\.)interpark\.co\.kr/i, source: "interpark" },
  // Western
  { re: /(^|\.)asos\./i, source: "asos" },
  { re: /(^|\.)farfetch\./i, source: "farfetch" },
  { re: /(^|\.)yoox\./i, source: "yoox" },
  { re: /(^|\.)zalando\./i, source: "zalando" },
  { re: /(^|\.)ssense\./i, source: "ssense" },
  { re: /net-a-porter\./i, source: "net-a-porter" },
  { re: /mrporter\./i, source: "mr-porter" },
  { re: /mytheresa\./i, source: "mytheresa" },
  { re: /matchesfashion\./i, source: "matchesfashion" },
  { re: /endclothing\./i, source: "endclothing" },
  { re: /nordstrom\./i, source: "nordstrom" },
  { re: /shopbop\./i, source: "shopbop" },
  { re: /revolve\./i, source: "revolve" },
  { re: /luisaviaroma\./i, source: "luisaviaroma" },
  { re: /uniqlo\./i, source: "uniqlo" },
  { re: /cosstores\.|(^|\.)cos\./i, source: "cos" },
  { re: /arket\./i, source: "arket" },
  { re: /(^|\.)hm\./i, source: "hm" },
  { re: /zara\./i, source: "zara" },
  { re: /everlane\./i, source: "everlane" },
  { re: /aritzia\./i, source: "aritzia" },
  { re: /saksfifthavenue\./i, source: "saksfifthavenue" },
  { re: /neimanmarcus\./i, source: "neimanmarcus" },
  { re: /amazon\./i, source: "amazon" },
];

export function sourceFromUrl(url: string | null | undefined): SourceKey {
  if (!url) return "other";
  let host = "";
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return "other";
  }
  for (const { re, source } of HOST_RULES) {
    if (re.test(host)) return source;
  }
  return "other";
}

export function sourceOf(p: Product): SourceKey {
  return (p as Product & { source?: SourceKey }).source || sourceFromUrl(p.externalUrl);
}

export function isKoreanSource(s: SourceKey): boolean {
  return KOREAN_SOURCES.has(s);
}

/**
 * A query is "Korean-market" if it contains Hangul, mentions a known Korean
 * brand/site, or the user's profile language is Korean. This drives the
 * 50/50 KR-first mix and unlocks Naver/Coupang discovery patterns.
 */
const HANGUL_RE = /[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/;
const KR_HINTS_RE = /\b(korea|korean|seoul|hongdae|gangnam|musinsa|kream|naver|coupang|ssg|gmarket|29cm|wconcept|ably|zigzag|hanbok|k-fashion|kfashion|k-style)\b/i;

export function isKoreanMarketQuery(query: string, opts: { userLanguage?: string | null; userLocation?: string | null } = {}): boolean {
  if (HANGUL_RE.test(query)) return true;
  if (KR_HINTS_RE.test(query)) return true;
  const lang = (opts.userLanguage || "").toLowerCase();
  if (lang === "ko" || lang === "ko-kr") return true;
  const loc = (opts.userLocation || "").toLowerCase();
  if (/\b(kr|korea|south\s*korea|seoul)\b/.test(loc)) return true;
  return false;
}

/**
 * Reorder so no single source occupies more than `maxRatio` of the first
 * `windowSize` slots. Items beyond the cap are pushed back; under-represented
 * sources fill in. Relevance order is preserved within each source bucket.
 */
export function enforceSourceQuota<T extends Product>(
  items: T[],
  opts: { windowSize?: number; maxRatio?: number } = {},
): T[] {
  const windowSize = Math.min(opts.windowSize ?? 24, items.length);
  const maxRatio = opts.maxRatio ?? 0.3;
  if (items.length <= 4) return items;
  const maxPerSource = Math.max(2, Math.floor(windowSize * maxRatio));

  const window = items.slice(0, windowSize);
  const tail = items.slice(windowSize);

  const counts = new Map<SourceKey, number>();
  const kept: T[] = [];
  const overflow: T[] = [];

  for (const p of window) {
    const src = sourceOf(p);
    const c = counts.get(src) || 0;
    if (c < maxPerSource) {
      counts.set(src, c + 1);
      kept.push(p);
    } else {
      overflow.push(p);
    }
  }

  let cursor = 0;
  while (kept.length < windowSize && cursor < tail.length) {
    const cand = tail[cursor++];
    const src = sourceOf(cand);
    const c = counts.get(src) || 0;
    if (c < maxPerSource) {
      counts.set(src, c + 1);
      kept.push(cand);
    } else {
      overflow.push(cand);
    }
  }

  const remainingTail = tail.slice(cursor);
  return [...kept, ...overflow, ...remainingTail];
}

/**
 * Korean-market mixer: when the query is Korean, target a 50/50 split of
 * KR vs non-KR items in the first `windowSize` slots by interleaving the
 * two streams. If KR supply is short, falls back to whatever is available
 * (never inserts placeholders).
 */
export function enforceKoreanMix<T extends Product>(
  items: T[],
  opts: { windowSize?: number; krRatio?: number } = {},
): T[] {
  const windowSize = Math.min(opts.windowSize ?? 12, items.length);
  const krRatio = opts.krRatio ?? 0.5;
  if (windowSize < 4) return items;

  const window = items.slice(0, Math.min(windowSize * 3, items.length));
  const tail = items.slice(window.length);

  const kr: T[] = [];
  const other: T[] = [];
  for (const p of window) {
    if (isKoreanSource(sourceOf(p))) kr.push(p);
    else other.push(p);
  }

  // Target counts in the first windowSize slots
  const targetKr = Math.round(windowSize * krRatio);
  const targetOther = windowSize - targetKr;

  const front: T[] = [];
  let ki = 0;
  let oi = 0;
  // Interleave KR-first to make Korean supply visible immediately
  while (front.length < windowSize && (ki < kr.length || oi < other.length)) {
    if (ki < kr.length && (front.filter((p) => isKoreanSource(sourceOf(p))).length < targetKr || oi >= other.length)) {
      front.push(kr[ki++]);
    } else if (oi < other.length) {
      front.push(other[oi++]);
    }
  }

  // Whatever wasn't placed in front gets appended after, KR first to keep
  // load-more biased Korean too.
  const rest = [...kr.slice(ki), ...other.slice(oi), ...tail];
  return [...front, ...rest];
}
