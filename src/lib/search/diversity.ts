/**
 * Diversity layer: keeps the top relevant items in place but shuffles the
 * mid band, rotates style buckets, and guarantees a varied top row so the
 * same query never looks identical twice.
 *
 * Design rules:
 *  - Top N (default 4) stays as-ranked: relevance is sacred.
 *  - Mid band (next ~20) is lightly shuffled with a per-call seed.
 *  - Top row is post-checked: must contain ≥3 distinct brands and ≥2 style
 *    buckets — otherwise we swap in candidates from below.
 */
import type { Product } from "./types";

/* ── Style bucket inference ─────────────────────────────────────────────── */

const STYLE_BUCKETS = ["minimal", "street", "formal", "oversized", "sport", "vintage"] as const;
export type StyleBucket = (typeof STYLE_BUCKETS)[number];

const STYLE_PATTERNS: Record<StyleBucket, RegExp> = {
  minimal: /\b(minimal|clean|basic|essential|plain|monochrome|tonal|neutral|cos|arket|uniqlo|the\s*row|toteme|jil\s*sander|lemaire)\b/i,
  street: /\b(street|cargo|graphic|skate|hype|stussy|carhartt|supreme|bape|palace|kith|aime\s*leon|fear\s*of\s*god|essentials)\b/i,
  formal: /\b(formal|tailored|suit|blazer|dress\s*shirt|oxford|loafer|brogue|pleated|wool|cashmere|silk|hugo\s*boss|brunello|zegna|thom\s*browne)\b/i,
  oversized: /\b(oversized|relaxed|loose|wide|baggy|drop\s*shoulder|boxy|slouchy|overfit)\b/i,
  sport: /\b(sport|running|training|athletic|performance|tech|gym|nike|adidas|on\s*running|asics|salomon|lululemon|alo)\b/i,
  vintage: /\b(vintage|retro|y2k|90s|80s|archive|distressed|washed|faded|denim|levi|carhartt\s*wip)\b/i,
};

export function styleBucketOf(p: Product): StyleBucket | null {
  const blob = `${p.title || ""} ${p.brand || ""} ${(p.styleTags || []).join(" ")}`;
  for (const bucket of STYLE_BUCKETS) {
    if (STYLE_PATTERNS[bucket].test(blob)) return bucket;
  }
  return null;
}

/* ── Seeded RNG (deterministic per call but varies between calls) ───────── */

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleInPlace<T>(arr: T[], rand: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/* ── Mid-band shuffle: protect head, jitter middle ──────────────────────── */

export function shuffleMidBand<T>(
  items: T[],
  opts: { headLock?: number; midSize?: number; seed?: number } = {},
): T[] {
  const headLock = opts.headLock ?? 4;
  const midSize = opts.midSize ?? 20;
  const seed = opts.seed ?? Date.now();
  if (items.length <= headLock + 2) return items;
  const head = items.slice(0, headLock);
  const mid = items.slice(headLock, headLock + midSize);
  const tail = items.slice(headLock + midSize);
  shuffleInPlace(mid, mulberry32(seed));
  return [...head, ...mid, ...tail];
}

/* ── Top-row guarantee: ≥3 brands, ≥2 style buckets ─────────────────────── */

export function ensureTopRowDiversity<T extends Product>(
  items: T[],
  opts: { rowSize?: number; minBrands?: number; minStyles?: number } = {},
): T[] {
  const rowSize = Math.min(opts.rowSize ?? 4, items.length);
  const minBrands = opts.minBrands ?? 3;
  const minStyles = opts.minStyles ?? 2;
  if (items.length <= rowSize) return items;

  const result = [...items];

  const brandsInRow = () => new Set(result.slice(0, rowSize).map((p) => (p.brand || "").toLowerCase()));
  const stylesInRow = () => {
    const s = new Set<string>();
    for (const p of result.slice(0, rowSize)) {
      const b = styleBucketOf(p);
      if (b) s.add(b);
    }
    return s;
  };

  // Pass 1: enforce brand diversity by swapping duplicates with the first
  // candidate from below that brings a new brand.
  let guard = 0;
  while (brandsInRow().size < minBrands && guard < rowSize * 2) {
    guard++;
    const row = result.slice(0, rowSize);
    // Find a duplicate-brand slot to evict (keep the earliest occurrence).
    const seen = new Set<string>();
    let evictIdx = -1;
    for (let i = 0; i < row.length; i++) {
      const b = (row[i].brand || "").toLowerCase();
      if (seen.has(b)) {
        evictIdx = i;
        break;
      }
      seen.add(b);
    }
    if (evictIdx === -1) break;
    // Find a candidate below with a fresh brand.
    const presentBrands = brandsInRow();
    const candIdx = result.findIndex(
      (p, i) => i >= rowSize && !presentBrands.has((p.brand || "").toLowerCase()),
    );
    if (candIdx === -1) break;
    [result[evictIdx], result[candIdx]] = [result[candIdx], result[evictIdx]];
  }

  // Pass 2: enforce style diversity (only if it doesn't undo brand diversity).
  guard = 0;
  while (stylesInRow().size < minStyles && guard < rowSize * 2) {
    guard++;
    const presentStyles = stylesInRow();
    // Evict the LAST row item whose style is already represented or null.
    let evictIdx = -1;
    for (let i = rowSize - 1; i >= 1; i--) {
      const b = styleBucketOf(result[i]);
      if (!b || presentStyles.has(b)) {
        evictIdx = i;
        break;
      }
    }
    if (evictIdx === -1) break;
    const candIdx = result.findIndex((p, i) => {
      if (i < rowSize) return false;
      const b = styleBucketOf(p);
      return b !== null && !presentStyles.has(b);
    });
    if (candIdx === -1) break;
    // Don't undo brand diversity: skip if the candidate's brand collides.
    const candBrand = (result[candIdx].brand || "").toLowerCase();
    const evictBrand = (result[evictIdx].brand || "").toLowerCase();
    const otherBrands = new Set(
      result.slice(0, rowSize).filter((_, i) => i !== evictIdx).map((p) => (p.brand || "").toLowerCase()),
    );
    if (candBrand && candBrand !== evictBrand && otherBrands.has(candBrand)) break;
    [result[evictIdx], result[candIdx]] = [result[candIdx], result[evictIdx]];
  }

  return result;
}

/* ── Style round-robin: prevent any one style cluster from dominating ───── */

export function rotateStyleClusters<T extends Product>(items: T[], windowSize = 24): T[] {
  if (items.length <= 4) return items;
  const window = items.slice(0, windowSize);
  const tail = items.slice(windowSize);

  const buckets = new Map<string, T[]>();
  const order: string[] = [];
  for (const p of window) {
    const key = styleBucketOf(p) || "_other";
    if (!buckets.has(key)) {
      buckets.set(key, []);
      order.push(key);
    }
    buckets.get(key)!.push(p);
  }
  if (order.length <= 1) return items;

  const interleaved: T[] = [];
  let added = true;
  while (added) {
    added = false;
    for (const key of order) {
      const list = buckets.get(key)!;
      if (list.length > 0) {
        interleaved.push(list.shift()!);
        added = true;
      }
    }
  }
  return [...interleaved, ...tail];
}
