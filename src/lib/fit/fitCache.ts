// ─── fitCache — V4.0 unified cache for the FIT pipeline ──────────────────
// In-memory cache for prepared fit artifacts (garment DNA, size correlation,
// brand bias, processed images). Keyed by body_signature + product_key.
//
// Body change → call invalidateForBodySignature(oldSig) to drop everything
// that depended on the previous body. New entries are written under the
// fresh signature so old and new never collide.
//
// Pure client-side: no I/O, soft-bounded by an LRU cap. Safe to import
// anywhere on the client.

const MAX_ENTRIES = 80;

type Entry<T> = { value: T; at: number; bodySig: string };

const store = new Map<string, Entry<unknown>>();

function evictIfFull(): void {
  if (store.size <= MAX_ENTRIES) return;
  // Drop the oldest 20% in one pass — cheaper than per-insert eviction.
  const targets = Array.from(store.entries())
    .sort((a, b) => a[1].at - b[1].at)
    .slice(0, Math.ceil(MAX_ENTRIES * 0.2));
  for (const [k] of targets) store.delete(k);
}

export interface FitCacheKeyParts {
  bodySignature: string;
  productKey: string;
  selectedSize?: string | null;
  targetGender?: string | null;
  bucket: string; // e.g. "garmentDNA", "sizeCorrelation", "brandBias", "processedImage"
}

export function buildFitCacheKey(p: FitCacheKeyParts): string {
  return [
    p.bodySignature,
    p.productKey,
    p.selectedSize ?? "_",
    p.targetGender ?? "_",
    p.bucket,
  ].join("|");
}

export function getFit<T>(parts: FitCacheKeyParts): T | null {
  const k = buildFitCacheKey(parts);
  const e = store.get(k);
  return e ? (e.value as T) : null;
}

export function setFit<T>(parts: FitCacheKeyParts, value: T): void {
  const k = buildFitCacheKey(parts);
  store.set(k, { value, at: Date.now(), bodySig: parts.bodySignature });
  evictIfFull();
}

/** Async memoization helper. Computes once per cache key, reuses afterwards. */
export async function withFitCache<T>(
  parts: FitCacheKeyParts,
  compute: () => Promise<T>,
): Promise<T> {
  const hit = getFit<T>(parts);
  if (hit !== null) return hit;
  const value = await compute();
  setFit(parts, value);
  return value;
}

/** Invalidate every entry whose body signature does NOT match the new one. */
export function invalidateForBodySignature(currentSig: string): number {
  let dropped = 0;
  for (const [k, e] of store) {
    if (e.bodySig !== currentSig) {
      store.delete(k);
      dropped++;
    }
  }
  return dropped;
}

/** Drop a specific bucket across all keys (e.g. nuke processed images). */
export function invalidateBucket(bucket: string): number {
  let dropped = 0;
  for (const [k] of store) {
    if (k.endsWith(`|${bucket}`)) {
      store.delete(k);
      dropped++;
    }
  }
  return dropped;
}

export function clearFitCache(): void {
  store.clear();
}

export function fitCacheSize(): number {
  return store.size;
}
