/**
 * Discover fresh injector
 * -----------------------
 * Append-only merging of newly discovered products into a live result set.
 * Used by the live-results layer so the visible grid never resets when new
 * fresh items arrive — they only ADD on top.
 *
 *   inject(existing, incoming) → { merged, addedIds }
 *
 * Guarantees:
 *   - Existing order is preserved.
 *   - Duplicates are dropped using the same fingerprint as discover-dedupe.
 *   - Returns the IDs that were actually added so the caller can flash a
 *     "N new arrivals" badge.
 */
import { mergeWithoutDuplicates } from "./discover-dedupe";
import type { DiscoverProduct } from "./discover-types";

export interface InjectionResult {
  merged: DiscoverProduct[];
  addedIds: string[];
  addedCount: number;
}

export function injectFresh(
  existing: DiscoverProduct[],
  incoming: DiscoverProduct[],
): InjectionResult {
  const existingIds = new Set(existing.map((p) => p.id));
  const { merged, addedCount } = mergeWithoutDuplicates(existing, incoming);
  const addedIds = merged
    .filter((p) => !existingIds.has(p.id))
    .map((p) => p.id);
  return { merged, addedIds, addedCount };
}
