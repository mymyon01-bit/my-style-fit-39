/**
 * Discover dedupe
 * ---------------
 * Removes the same product when re-syndicated across stores/scrapers.
 * Strategy: composite fingerprint per product:
 *
 *   1. productUrl (strongest)
 *   2. imageUrl basename
 *   3. brand + first-6-tokens(normalizedTitle)
 *
 * If ANY fingerprint already exists in the index, the product is dropped.
 */
import type { DiscoverProduct } from "./discover-types";

function imageFingerprint(url: string): string {
  try {
    const u = new URL(url);
    const base = u.pathname.split("/").pop() || u.pathname;
    return `img:${base.toLowerCase()}`;
  } catch {
    return `img:${url.toLowerCase()}`;
  }
}

function titleFingerprint(p: DiscoverProduct): string {
  const tokens = p.normalizedTitle.split(" ").filter(Boolean).slice(0, 6).join(" ");
  const brand = (p.brand || "").toLowerCase();
  return `t:${brand}|${tokens}`;
}

export function fingerprintsOf(p: DiscoverProduct): string[] {
  const fps: string[] = [];
  if (p.productUrl) fps.push(`u:${p.productUrl.toLowerCase()}`);
  if (p.imageUrl) fps.push(imageFingerprint(p.imageUrl));
  fps.push(titleFingerprint(p));
  return fps;
}

export interface DedupeResult {
  kept: DiscoverProduct[];
  rejectedCount: number;
}

export function dedupeDiscover(products: DiscoverProduct[]): DedupeResult {
  const seen = new Set<string>();
  const kept: DiscoverProduct[] = [];
  let rejected = 0;
  for (const p of products) {
    const fps = fingerprintsOf(p);
    if (fps.some((fp) => seen.has(fp))) {
      rejected++;
      continue;
    }
    for (const fp of fps) seen.add(fp);
    kept.push(p);
  }
  return { kept, rejectedCount: rejected };
}

/** Merge a fresh batch into an existing list, dropping new items that
 *  collide with anything already in `existing`. Preserves existing order. */
export function mergeWithoutDuplicates(
  existing: DiscoverProduct[],
  incoming: DiscoverProduct[],
): { merged: DiscoverProduct[]; addedCount: number } {
  const seen = new Set<string>();
  for (const p of existing) for (const fp of fingerprintsOf(p)) seen.add(fp);
  const additions: DiscoverProduct[] = [];
  for (const p of incoming) {
    const fps = fingerprintsOf(p);
    if (fps.some((fp) => seen.has(fp))) continue;
    for (const fp of fps) seen.add(fp);
    additions.push(p);
  }
  return { merged: [...existing, ...additions], addedCount: additions.length };
}
