import type { Product } from "./types";

export type SearchStatus = "searching" | "partial" | "complete";

export interface SearchSession {
  id: string;
  query: string;
  results: Product[];
  seenIds: Set<string>;
  cycle: number;
  status: SearchStatus;
}

export function createSearchSession(query: string): SearchSession {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    query: query.trim(),
    results: [],
    seenIds: new Set<string>(),
    cycle: 0,
    status: "searching",
  };
}

/** Append-only merge: returns true if the product was newly added. */
export function appendToSession(session: SearchSession, p: Product): boolean {
  const key = (p.externalUrl || p.id || p.imageUrl || "").toLowerCase();
  if (!key) return false;
  if (session.seenIds.has(key)) return false;
  session.seenIds.add(key);
  session.results.push(p);
  return true;
}
