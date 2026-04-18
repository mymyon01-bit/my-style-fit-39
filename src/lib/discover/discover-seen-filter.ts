/**
 * Discover seen filter
 * --------------------
 * Two layers of suppression so the same products don't loop:
 *   1. Local session memory (24h rolling, anonymous-friendly) — already
 *      maintained by search-session's `wasRecentlyShown` / `markProductsAsSeen`.
 *   2. DB-backed 24h memory (per-user) via `loadDbSeenKeys` / `recordDbSeen`
 *      from the discovery cache.
 *
 * This module is the single public surface the Discover hook should call.
 */
import {
  markProductsAsSeen as sessionMarkSeen,
  wasRecentlyShown,
} from "@/lib/search/search-session";
import { loadDbSeenKeys, recordDbSeen } from "@/lib/search/discovery-cache";
import type { Product } from "@/lib/search/types";

export interface SeenFilterContext {
  /** Keys loaded from DB at the start of a search (per-user, 24h). */
  dbSeen: Set<string>;
}

export function productKey(product: Pick<Product, "id" | "externalUrl" | "imageUrl">): string {
  return (product.externalUrl || product.id || product.imageUrl || "").toLowerCase();
}

export async function loadSeenContext(): Promise<SeenFilterContext> {
  const dbSeen = await loadDbSeenKeys();
  return { dbSeen };
}

export interface SeenAnnotation {
  isLocalSeen: boolean;
  isDbSeen: boolean;
  isUnseen: boolean;
}

export function annotateSeen(product: Product, ctx: SeenFilterContext): SeenAnnotation {
  const key = productKey(product);
  const isLocalSeen = key ? wasRecentlyShown(key) : false;
  const isDbSeen = key ? ctx.dbSeen.has(key) : false;
  return {
    isLocalSeen,
    isDbSeen,
    isUnseen: !isLocalSeen && !isDbSeen,
  };
}

/** Persist that a batch of products was actually rendered to the user. */
export async function markRendered(products: Product[]): Promise<void> {
  if (products.length === 0) return;
  const keys = products.map(productKey).filter(Boolean);
  sessionMarkSeen(keys);
  // DB write is best-effort — don't block the UI on failure.
  try {
    await recordDbSeen(keys);
  } catch (err) {
    console.warn("[discover-seen-filter] recordDbSeen failed", err);
  }
}
