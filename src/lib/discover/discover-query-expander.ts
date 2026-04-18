/**
 * Discover query expander
 * -----------------------
 * Deterministic expansions only. AI refinement is intentionally NOT used here
 * so the base flow is fast, predictable, and never network-dependent.
 *
 * Rules:
 *   1. Always include the raw normalized query first.
 *   2. Append style + color + scenario + brand modifiers as compound variants.
 *   3. **CATEGORY LOCK IS LAW.** When the parsed query has a primaryCategory,
 *      every emitted variant must contain a noun from that category family.
 *      Variants that mention a noun from a DIFFERENT family are discarded
 *      immediately — style words can never override the category.
 *   4. Seasonal/freshness fillers also respect the lock (e.g. "trending bags",
 *      never bare "trending" when bags is locked).
 */
import { inferCategoryFromTitle, type PrimaryCategory } from "@/lib/search/category-lock";
import type { ParsedDiscoverQuery } from "./discover-query-parser";

/** Canonical noun per family — used to repair lock-less variants. */
const FAMILY_HEAD_NOUN: Record<PrimaryCategory, string> = {
  bags: "bag",
  shoes: "shoes",
  outerwear: "jacket",
  tops: "top",
  bottoms: "pants",
  dresses: "dress",
  accessories: "accessory",
};

/** Returns true when `text` is safe under the lock:
 *   - no lock → always safe
 *   - mentions the locked family → safe
 *   - mentions a DIFFERENT family noun → unsafe (drop) */
function passesCategoryGuard(text: string, lock: PrimaryCategory | null): boolean {
  if (!lock) return true;
  const inferred = inferCategoryFromTitle(text);
  if (inferred === null) return true;        // no category noun — safe modifier-only phrase
  return inferred === lock;                  // any other category noun = drift, drop it
}

/** Rotation pools — each search picks a different slice so the candidate
 *  pool is never frozen across repeated queries. */
const SEASONAL_POOL = [
  "new arrivals",
  "trending",
  "this week",
  "just in",
  "fresh drops",
  "editor picks",
  "must have",
  "최신",            // KR: "newest"
  "신상",            // KR: "new arrival"
  "인기",            // KR: "trending"
];

const STYLE_ROTATION_POOL = [
  "minimal",
  "street",
  "y2k",
  "old money",
  "clean",
  "vintage",
  "oversized",
  "tailored",
];

const DOMAIN_SCOPE_POOL = [
  "site:asos.com",
  "site:farfetch.com",
  "site:yoox.com",
  "site:zalando.com",
  "site:ssense.com",
  "site:shopping.naver.com",
  "site:coupang.com",
  "site:musinsa.com",
];

const SHOPPING_PHRASING_POOL = ["shop", "buy", "online", "best", "where to buy"];

/** Deterministic but rotation-safe pick: combines a daily epoch with the
 *  query so the same query gets a fresh slice each day, and different queries
 *  in the same session also get different slices. */
function rotationOffset(query: string): number {
  const day = Math.floor(Date.now() / (1000 * 60 * 60 * 6)); // rotates every 6h
  let hash = 0;
  for (let i = 0; i < query.length; i++) hash = (hash * 31 + query.charCodeAt(i)) | 0;
  return Math.abs(hash + day);
}

function rotateSlice<T>(pool: T[], offset: number, count: number): T[] {
  if (pool.length === 0 || count <= 0) return [];
  const out: T[] = [];
  for (let i = 0; i < Math.min(count, pool.length); i++) {
    out.push(pool[(offset + i) % pool.length]);
  }
  return out;
}

const SCENARIO_STYLE_BOOSTS: Record<string, string[]> = {
  wedding: ["formal", "elegant"],
  office: ["minimal", "tailored"],
  gym: ["sporty", "performance"],
  beach: ["casual", "linen"],
  party: ["statement", "sequins"],
  weekend: ["casual", "relaxed"],
  travel: ["lightweight", "comfortable"],
};

export interface ExpansionPlan {
  base: string;
  variants: string[];     // includes base as variants[0]
  fanoutCount: number;
}

function uniquePush(arr: string[], next: string): void {
  const v = next.trim().replace(/\s+/g, " ");
  if (v && !arr.includes(v)) arr.push(v);
}

export function expandDiscoverQuery(parsed: ParsedDiscoverQuery): ExpansionPlan {
  const base = parsed.normalized || "new arrivals";
  const lock = parsed.primaryCategory;
  const variants: string[] = [];
  let rejectedByGuard = 0;

  // Push only when the variant survives the category guard. If the variant
  // has no category noun at all and we have a lock, repair it by appending
  // the canonical family noun (so "street" → "street bag" under bags-lock).
  const tryPush = (raw: string) => {
    let v = raw.trim().replace(/\s+/g, " ");
    if (!v) return;
    if (lock && inferCategoryFromTitle(v) === null) {
      v = `${v} ${FAMILY_HEAD_NOUN[lock]}`.trim();
    }
    if (!passesCategoryGuard(v, lock)) {
      rejectedByGuard++;
      return;
    }
    uniquePush(variants, v);
  };

  tryPush(base);

  // Modifier compounds
  if (parsed.color && lock) tryPush(`${parsed.color} ${lock}`);
  if (parsed.fit && lock) tryPush(`${parsed.fit} ${lock}`);
  for (const style of parsed.styleModifiers) {
    tryPush(lock ? `${style} ${lock}` : `${style} outfit`);
  }

  // Scenario boosts
  if (parsed.scenario) {
    const boosts = SCENARIO_STYLE_BOOSTS[parsed.scenario] || [];
    for (const b of boosts) tryPush(`${b} ${parsed.scenario}`);
  }

  // Brand carriers
  if (parsed.brand && lock) tryPush(`${parsed.brand} ${lock}`);

  // ROTATION: pick a fresh slice of style + seasonal + shopping + domain
  // modifiers each invocation so the candidate pool evolves over time.
  const offset = rotationOffset(parsed.normalized);

  for (const style of rotateSlice(STYLE_ROTATION_POOL, offset, 2)) {
    if (parsed.styleModifiers.includes(style)) continue;
    tryPush(lock ? `${style} ${lock}` : `${style} outfit`);
  }
  for (const hint of rotateSlice(SEASONAL_POOL, offset + 1, 2)) {
    tryPush(lock ? `${hint} ${lock}` : hint);
  }
  for (const phrase of rotateSlice(SHOPPING_PHRASING_POOL, offset + 2, 1)) {
    tryPush(lock ? `${phrase} ${lock}` : `${phrase} ${base}`);
  }
  // Domain scopes piggyback as discovery hints (search-runner can choose to
  // honor them; harmless if it doesn't).
  for (const scope of rotateSlice(DOMAIN_SCOPE_POOL, offset + 3, 2)) {
    tryPush(`${base} ${scope}`);
  }

  if (rejectedByGuard > 0) {
    console.debug(
      `[discover-expander] guard dropped ${rejectedByGuard} variants under lock=${lock ?? "none"}`,
    );
  }

  return { base, variants, fanoutCount: variants.length };
}
