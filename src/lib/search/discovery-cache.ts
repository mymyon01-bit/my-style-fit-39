/**
 * 10-minute in-memory cache for discovery results, plus a 70/30 fresh-cached
 * mixer. The cache lives only for the page session — refreshing or navigating
 * away clears it. After TTL the next call forces a fresh fetch.
 */
import type { Product } from "./types";
import { discoverProducts } from "./product-discovery-service";
import { supabase } from "@/integrations/supabase/client";

const TTL_MS = 10 * 60 * 1000; // 10 minutes
const FRESH_RATIO = 0.3;       // 30% always from a fresh fetch

interface CacheEntry {
  products: Product[];
  fetchedAt: number;
}

const cache = new Map<string, CacheEntry>();

function key(query: string): string {
  return query.trim().toLowerCase();
}

function isExpired(entry: CacheEntry): boolean {
  return Date.now() - entry.fetchedAt > TTL_MS;
}

/**
 * Fetch products with a 70/30 cached/fresh mix.
 *
 *  - If the cache is empty or expired → full fresh fetch, store, return.
 *  - Otherwise → kick off a small fresh discovery in parallel with the cache
 *    and interleave them so the user always sees ~30% never-cached items.
 */
export async function discoverWithCache(
  query: string,
  opts: { limit?: number; excludeIds?: string[] } = {},
): Promise<Product[]> {
  const k = key(query);
  const limit = opts.limit ?? 24;
  const entry = cache.get(k);

  // Cold or expired cache → force refresh.
  if (!entry || isExpired(entry)) {
    const fresh = await discoverProducts(query, {
      limit,
      excludeIds: opts.excludeIds,
      freshSearch: true,
    });
    cache.set(k, { products: fresh, fetchedAt: Date.now() });
    return fresh;
  }

  // Warm cache → 70/30 mix. Fire fresh fetch in parallel so the UI always
  // sees brand-new items even on cache hits.
  const freshTarget = Math.max(2, Math.round(limit * FRESH_RATIO));
  const cachedTarget = limit - freshTarget;
  const freshPromise = discoverProducts(query, {
    limit: freshTarget * 2, // pull a bit more so we can dedupe down
    excludeIds: opts.excludeIds,
    freshSearch: true,
  });

  const cached = entry.products.slice(0, cachedTarget);
  const cachedKeys = new Set(cached.map((p) => p.externalUrl || p.id));
  const fresh = (await freshPromise).filter(
    (p) => !cachedKeys.has(p.externalUrl || p.id),
  );

  // Refresh the cache entry with the merged pool so subsequent calls evolve.
  const merged = interleave(fresh.slice(0, freshTarget), cached);
  cache.set(k, {
    products: dedupeById([...fresh, ...entry.products]).slice(0, 80),
    fetchedAt: entry.fetchedAt, // keep original timestamp until TTL fires
  });
  return merged;
}

/** Force-evict a query from the cache (e.g. user pulled to refresh). */
export function invalidateCache(query: string): void {
  cache.delete(key(query));
}

/** Drop everything older than TTL. Cheap; safe to call on a timer. */
export function pruneCache(): void {
  for (const [k, v] of cache.entries()) {
    if (isExpired(v)) cache.delete(k);
  }
}

function interleave<T>(a: T[], b: T[]): T[] {
  const out: T[] = [];
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    if (i < a.length) out.push(a[i]);
    if (i < b.length) out.push(b[i]);
  }
  return out;
}

function dedupeById<T extends { id: string; externalUrl?: string | null }>(arr: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const p of arr) {
    const k2 = (p.externalUrl || p.id).toLowerCase();
    if (seen.has(k2)) continue;
    seen.add(k2);
    out.push(p);
  }
  return out;
}

/* ── Hybrid SEEN filter (session memory + 24h DB window) ───────────────── */

/**
 * Pulls product keys the logged-in user has been shown in the last 24h.
 * Returns an empty set for guests (their seen state lives in localStorage).
 */
export async function loadDbSeenKeys(): Promise<Set<string>> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Set();
    const { data } = await supabase
      .from("user_seen_products")
      .select("product_key, seen_at")
      .eq("user_id", user.id)
      .gte("seen_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .limit(2000);
    return new Set((data || []).map((r) => String(r.product_key).toLowerCase()));
  } catch {
    return new Set();
  }
}

/**
 * Best-effort write: record the products the user just saw so subsequent
 * searches skip them for 24h. RLS guarantees this is per-user.
 */
export async function recordDbSeen(products: Pick<Product, "id" | "externalUrl">[]): Promise<void> {
  if (!products.length) return;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const rows = products
      .map((p) => (p.externalUrl || p.id || "").toLowerCase())
      .filter(Boolean)
      .slice(0, 60)
      .map((product_key) => ({ user_id: user.id, product_key }));
    if (!rows.length) return;
    await supabase
      .from("user_seen_products")
      .upsert(rows, { onConflict: "user_id,product_key", ignoreDuplicates: true });
  } catch {
    /* non-blocking */
  }
}
