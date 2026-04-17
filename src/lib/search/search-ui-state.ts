import type { SearchSession } from "./search-session";

export function getSearchMessage(session: SearchSession): string {
  if (session.status === "searching") return "Searching…";
  if (session.status === "partial") return "Fetching more products…";
  return `Showing results for "${session.query}"`;
}

export function getSearchStats(session: SearchSession) {
  return {
    cycle: session.cycle,
    total: session.results.length,
    status: session.status,
  };
}
