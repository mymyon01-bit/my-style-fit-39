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
  };
}

/**
 * Append-only merge with HARD category lock when applicable.
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

  session.seenIds.add(key);
  session.results.push(p);
  return true;
}
