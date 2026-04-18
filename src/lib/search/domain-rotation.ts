/**
 * Domain rotation: track which sources/domains the user has been served
 * recently and bias the next search toward UNSEEN domains. Persisted in
 * localStorage so rotation survives reloads. Capped + decayed so domains
 * eventually re-surface.
 */
import type { Product } from "./types";
import { sourceOf, type SourceKey } from "./sources";

const KEY = "wardrobe_seen_domains_v1";
const CAP = 40;

interface DomainRecord {
  source: SourceKey;
  count: number;
  lastSeen: number; // epoch ms
}

function load(): DomainRecord[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as DomainRecord[]) : [];
  } catch {
    return [];
  }
}

function save(records: DomainRecord[]): void {
  try {
    // Keep most-recent CAP entries.
    const trimmed = [...records]
      .sort((a, b) => b.lastSeen - a.lastSeen)
      .slice(0, CAP);
    localStorage.setItem(KEY, JSON.stringify(trimmed));
  } catch {
    /* quota — ignore */
  }
}

/** Record that these products were shown — call once per completed search. */
export function recordDomainsShown(products: Product[]): void {
  if (!products.length) return;
  const records = load();
  const map = new Map(records.map((r) => [r.source, r]));
  const now = Date.now();
  for (const p of products) {
    const src = sourceOf(p);
    const existing = map.get(src);
    if (existing) {
      existing.count++;
      existing.lastSeen = now;
    } else {
      map.set(src, { source: src, count: 1, lastSeen: now });
    }
  }
  save(Array.from(map.values()));
}

/**
 * Return a "freshness score" per source: 1.0 = unseen, decays toward 0 as
 * recency + frequency grow. 24h half-life so domains rotate back in.
 */
export function getDomainFreshness(): Map<SourceKey, number> {
  const records = load();
  const out = new Map<SourceKey, number>();
  const now = Date.now();
  const HALF_LIFE_MS = 24 * 60 * 60 * 1000;
  for (const r of records) {
    const ageRatio = (now - r.lastSeen) / HALF_LIFE_MS;
    const recencyDecay = Math.pow(0.5, Math.min(ageRatio, 4));
    // Frequency penalty: 1 / (1 + log2(count))
    const freqPenalty = 1 / (1 + Math.log2(1 + r.count));
    // Higher score = fresher. Unseen domains aren't in the map → caller
    // treats them as 1.0.
    out.set(r.source, 1 - recencyDecay * (1 - freqPenalty));
  }
  return out;
}

/**
 * Reorder products so under-served (unseen / least-recent) domains float
 * toward the top of the first window. Pure function. Relevance order is
 * preserved within each domain bucket.
 */
export function prioritizeUnseenDomains<T extends Product>(
  items: T[],
  opts: { windowSize?: number } = {},
): T[] {
  if (items.length <= 4) return items;
  const windowSize = Math.min(opts.windowSize ?? 24, items.length);
  const freshness = getDomainFreshness();
  const window = items.slice(0, windowSize);
  const tail = items.slice(windowSize);
  // Group by source, preserving order.
  const buckets = new Map<SourceKey, T[]>();
  for (const p of window) {
    const src = sourceOf(p);
    if (!buckets.has(src)) buckets.set(src, []);
    buckets.get(src)!.push(p);
  }
  // Sort source keys by freshness DESC (unseen sources score 1.0).
  const orderedSources = Array.from(buckets.keys()).sort((a, b) => {
    const sa = freshness.has(a) ? freshness.get(a)! : 1;
    const sb = freshness.has(b) ? freshness.get(b)! : 1;
    return sb - sa;
  });
  // Round-robin pull one at a time from each bucket so unseen sources lead.
  const out: T[] = [];
  let pulled = true;
  while (pulled && out.length < windowSize) {
    pulled = false;
    for (const src of orderedSources) {
      const bucket = buckets.get(src);
      if (bucket && bucket.length > 0) {
        out.push(bucket.shift()!);
        pulled = true;
        if (out.length >= windowSize) break;
      }
    }
  }
  return [...out, ...tail];
}
