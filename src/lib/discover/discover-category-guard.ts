/**
 * Discover category guard
 * -----------------------
 * Wraps the existing category-lock primitives behind a stable Discover API.
 * Single responsibility: keep results inside the locked category family.
 *
 * - When a query has a primary category, products outside that family are
 *   rejected (with diagnostics on rejection counts).
 * - When the query is scenario/style (no lock), the guard is a no-op.
 */
import {
  productMatchesCategory,
  type PrimaryCategory,
} from "@/lib/search/category-lock";
import type { Product } from "@/lib/search/types";
import type { ParsedDiscoverQuery } from "./discover-query-parser";

export interface CategoryGuardResult {
  kept: Product[];
  rejected: Product[];
  lock: PrimaryCategory | null;
}

/** Returns the active lock for a parsed query (null = no lock). */
export function getCategoryLock(parsed: ParsedDiscoverQuery): PrimaryCategory | null {
  // Brand and scenario queries never enforce a category lock — let the
  // catalog mix freely.
  if (parsed.queryType === "brand") return null;
  if (parsed.queryType === "scenario") return null;
  return parsed.primaryCategory;
}

/** Filter a product list against the lock. No-op if lock is null. */
export function enforceCategoryLock(
  products: Product[],
  lock: PrimaryCategory | null,
): CategoryGuardResult {
  if (!lock) return { kept: products, rejected: [], lock };
  const kept: Product[] = [];
  const rejected: Product[] = [];
  for (const p of products) {
    if (productMatchesCategory(p, lock)) kept.push(p);
    else rejected.push(p);
  }
  return { kept, rejected, lock };
}

/** Soft variant — never returns an empty list. Falls back to the input if the
 *  filter would empty the grid (so users still see something while the runner
 *  re-fetches a corrected category cohort). */
export function enforceCategoryLockSoft(
  products: Product[],
  lock: PrimaryCategory | null,
  minKeep = 6,
): CategoryGuardResult {
  const result = enforceCategoryLock(products, lock);
  if (lock && result.kept.length < minKeep) {
    return { kept: products, rejected: [], lock };
  }
  return result;
}
