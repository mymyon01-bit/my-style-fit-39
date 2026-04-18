import type { Product } from "./types";
import { detectPrimaryCategory, productMatchesCategory, type PrimaryCategory } from "./category-lock";

export type SearchStatus = "searching" | "partial" | "complete";

export interface SearchSession {
  id: string;
  query: string;
  results: Product[];
  seenIds: Set<string>;
  cycle: number;
  status: SearchStatus;
  /** Locked primary category derived from the query (null = scenario/style query, mixed allowed). */
  categoryLock: PrimaryCategory | null;
  /** Count of products dropped because they didn't match the lock — for diagnostics. */
  rejectedByCategory: number;
  /** Per-brand count for cap-based diversity (non-brand queries only). */
  brandCounts: Map<string, number>;
  /** Count of products dropped because the brand cap was reached. */
  rejectedByBrandCap: number;
  /** True when the user explicitly searched for a brand (cap is then disabled). */
  isBrandQuery: boolean;
}

/**
 * Cross-session "recently shown" memory (last ~120 product keys per browser).
 * Reduces immediate repetition between consecutive searches without making
 * the same products invisible forever — keys age out as new ones come in.
 */
const RECENT_CAP = 120;
const RECENT_KEY = "wardrobe_recent_seen_v1";
function loadRecent(): string[] {
  try {
    const raw = sessionStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}
function saveRecent(keys: string[]): void {
  try {
    sessionStorage.setItem(RECENT_KEY, JSON.stringify(keys.slice(-RECENT_CAP)));
  } catch {
    /* ignore quota */
  }
}
function rememberRecent(key: string): void {
  const list = loadRecent();
  if (list.includes(key)) return;
  list.push(key);
  saveRecent(list);
}

/** Lightweight brand-query heuristic — matches the edge function's intent classifier. */
const KNOWN_BRANDS_RE =
  /\b(nike|adidas|gucci|prada|zara|h&m|uniqlo|cos|arket|loewe|chanel|dior|hermes|balenciaga|ysl|saint\s*laurent|burberry|fendi|miu\s*miu|bottega|jacquemus|stussy|carhartt|patagonia|north\s*face|new\s*balance|asics|salomon|on\s*running|levi'?s|polo\s*ralph|ralph\s*lauren|tommy|lacoste|maison\s*margiela|acne\s*studios?|ami\s*paris|jw\s*anderson|ganni|toteme|the\s*row|khaite|alo|lululemon|reformation|aritzia|aime\s*leon\s*dore|kith)\b/i;

function isBrandQueryHeuristic(q: string): boolean {
  return KNOWN_BRANDS_RE.test(q);
}

export function createSearchSession(query: string): SearchSession {
  const trimmed = query.trim();
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    query: trimmed,
    results: [],
    seenIds: new Set<string>(),
    cycle: 0,
    status: "searching",
    categoryLock: detectPrimaryCategory(trimmed),
    rejectedByCategory: 0,
    brandCounts: new Map<string, number>(),
    rejectedByBrandCap: 0,
    isBrandQuery: isBrandQueryHeuristic(trimmed),
  };
}

/** Per-brand cap when the query is NOT a brand search (keeps any one label from dominating). */
const BRAND_CAP = 4;

/**
 * Append-only merge with HARD category lock and brand-cap diversity.
 * Returns true if the product was newly added.
 */
export function appendToSession(session: SearchSession, p: Product): boolean {
  const key = (p.externalUrl || p.id || p.imageUrl || "").toLowerCase();
  if (!key) return false;
  if (session.seenIds.has(key)) return false;

  // HARD category lock — wrong-category products never enter the result set
  // when the query has an explicit product-type word.
  if (session.categoryLock && !productMatchesCategory(p, session.categoryLock)) {
    session.seenIds.add(key); // remember so we don't re-evaluate the same item
    session.rejectedByCategory++;
    return false;
  }

  // Brand-cap diversity — non-brand queries get at most BRAND_CAP per brand.
  if (!session.isBrandQuery && p.brand) {
    const brandKey = p.brand.toLowerCase().trim();
    const count = session.brandCounts.get(brandKey) || 0;
    if (count >= BRAND_CAP) {
      session.seenIds.add(key);
      session.rejectedByBrandCap++;
      return false;
    }
    session.brandCounts.set(brandKey, count + 1);
  }

  session.seenIds.add(key);
  session.results.push(p);
  rememberRecent(key);
  return true;
}

/** Returns true if the key was shown in a recent prior session — used for soft demotion only. */
export function wasRecentlyShown(key: string): boolean {
  if (!key) return false;
  return loadRecent().includes(key.toLowerCase());
}
