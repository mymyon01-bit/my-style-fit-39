import type { Product } from "./types";
import { detectPrimaryCategory, productMatchesCategory, type PrimaryCategory } from "./category-lock";

export type SearchStatus = "searching" | "partial" | "complete";

export interface SearchSession {
  id: string;
  query: string;
  results: Product[];
  seenIds: Set<string>;
  /** Normalized title/image fingerprints used for cross-source dedupe. */
  fingerprintIndex: Set<string>;
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
  /** Count of products dropped as duplicates (URL / title / image fingerprint). */
  rejectedByDedupe: number;
  /** True when the user explicitly searched for a brand (cap is then disabled). */
  isBrandQuery: boolean;
}

/**
 * Cross-session "seen" memory. Persisted in localStorage so users keep seeing
 * fresh products across reloads, not the same cached loop. Capped at 600 keys
 * (rolling window) so old items eventually re-surface.
 */
const SEEN_CAP = 600;
const SEEN_KEY = "wardrobe_seen_products_v2";

function loadSeen(): string[] {
  try {
    const raw =
      localStorage.getItem(SEEN_KEY) || sessionStorage.getItem(SEEN_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}
function saveSeen(keys: string[]): void {
  const trimmed = keys.slice(-SEEN_CAP);
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(trimmed));
  } catch {
    /* ignore quota */
  }
}
function rememberSeen(keys: string[]): void {
  if (keys.length === 0) return;
  const list = loadSeen();
  const set = new Set(list);
  for (const k of keys) {
    if (k) set.add(k);
  }
  saveSeen(Array.from(set));
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
    fingerprintIndex: new Set<string>(),
    cycle: 0,
    status: "searching",
    categoryLock: detectPrimaryCategory(trimmed),
    rejectedByCategory: 0,
    brandCounts: new Map<string, number>(),
    rejectedByBrandCap: 0,
    rejectedByDedupe: 0,
    isBrandQuery: isBrandQueryHeuristic(trimmed),
  };
}

/** Per-brand cap when the query is NOT a brand search (keeps any one label from dominating). */
const BRAND_CAP = 4;

/* ── Fingerprinting helpers ────────────────────────────────────────────── */

function normalizeTitle(s: string | undefined | null): string {
  if (!s) return "";
  return s
    .toLowerCase()
    .replace(/[\u2018\u2019'`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .slice(0, 6) // first 6 tokens — enough to catch reposts of the same item
    .join(" ");
}

function normalizeImage(url: string | undefined | null): string {
  if (!url) return "";
  try {
    const u = new URL(url);
    // Strip query string and trailing size suffixes like _1200x.jpg
    const path = u.pathname.replace(/_\d{2,4}x\d{0,4}/i, "").replace(/-\d{2,4}x\d{0,4}/i, "");
    return `${u.host}${path}`.toLowerCase();
  } catch {
    return url.toLowerCase().split("?")[0];
  }
}

function productFingerprints(p: Product): string[] {
  const fps: string[] = [];
  const title = normalizeTitle(p.name);
  const brand = (p.brand || "").toLowerCase().trim();
  if (title) fps.push(`t:${brand}|${title}`);
  const img = normalizeImage(p.imageUrl);
  if (img) fps.push(`i:${img}`);
  return fps;
}

function productKey(p: Product): string {
  return (p.externalUrl || p.id || p.imageUrl || "").toLowerCase();
}

/**
 * Append-only merge with HARD category lock, brand-cap diversity, and
 * multi-signal dedupe (URL + title + image). Returns true if newly added.
 */
export function appendToSession(session: SearchSession, p: Product): boolean {
  const key = productKey(p);
  if (!key) return false;
  if (session.seenIds.has(key)) return false;

  // HARD category lock — wrong-category products never enter the result set
  // when the query has an explicit product-type word.
  if (session.categoryLock && !productMatchesCategory(p, session.categoryLock)) {
    session.seenIds.add(key);
    session.rejectedByCategory++;
    return false;
  }

  // Cross-source dedupe — same product reposted by another store/scraper.
  const fps = productFingerprints(p);
  for (const fp of fps) {
    if (session.fingerprintIndex.has(fp)) {
      session.seenIds.add(key);
      session.rejectedByDedupe++;
      return false;
    }
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
  for (const fp of fps) session.fingerprintIndex.add(fp);
  session.results.push(p);
  return true;
}

/** Returns true if this product was shown in a recent prior session. */
export function wasRecentlyShown(key: string): boolean {
  if (!key) return false;
  return loadSeen().includes(key.toLowerCase());
}

/** Persist a batch of products as "seen" — call once per completed search. */
export function markProductsAsSeen(products: Product[]): void {
  if (!products.length) return;
  const keys: string[] = [];
  for (const p of products) {
    const k = productKey(p);
    if (k) keys.push(k);
  }
  rememberSeen(keys);
}

/**
 * Reorder results so the first visible window is dominated by UNSEEN items,
 * with a soft 70/30 unseen→seen mix and a no-more-than-2-consecutive-same-brand
 * rule. Seen items aren't removed — just demoted.
 *
 * Pure function: callers can apply it to any array.
 */
export function mixUnseenFirst<T extends Product>(
  items: T[],
  opts: { unseenRatio?: number; firstWindow?: number } = {},
): T[] {
  if (items.length <= 1) return items;
  const unseenRatio = opts.unseenRatio ?? 0.7;
  const firstWindow = opts.firstWindow ?? 24;
  const seenSet = new Set(loadSeen());

  const fresh: T[] = [];
  const repeat: T[] = [];
  for (const p of items) {
    const k = productKey(p);
    if (k && seenSet.has(k)) repeat.push(p);
    else fresh.push(p);
  }

  // Build first window with the 70/30 split.
  const targetFresh = Math.round(firstWindow * unseenRatio);
  const targetRepeat = firstWindow - targetFresh;
  const window = [
    ...fresh.slice(0, targetFresh),
    ...repeat.slice(0, targetRepeat),
  ];
  const remaining = [
    ...fresh.slice(targetFresh),
    ...repeat.slice(targetRepeat),
  ];

  // Anti-clustering: never more than 2 consecutive items from the same brand.
  const ordered: T[] = [];
  const pool = [...window, ...remaining];
  let lastBrand = "";
  let streak = 0;
  while (pool.length > 0) {
    let pickIdx = 0;
    if (streak >= 2) {
      const idx = pool.findIndex(
        (p) => (p.brand || "").toLowerCase() !== lastBrand,
      );
      if (idx > -1) pickIdx = idx;
    }
    const [picked] = pool.splice(pickIdx, 1);
    const brand = (picked.brand || "").toLowerCase();
    if (brand && brand === lastBrand) streak++;
    else {
      lastBrand = brand;
      streak = 1;
    }
    ordered.push(picked);
  }
  return ordered;
}
