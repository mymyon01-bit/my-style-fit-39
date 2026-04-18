/**
 * Multi-query expansion — turns ONE user query into ~10 search variants.
 * Used by the discover-search-engine pipeline so we behave like a real
 * search engine (collect 50–200 URLs per concept) instead of a single crawler.
 */
export function expandQuery(q: string): string[] {
  const base = q.trim();
  if (!base) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of [
    base,
    `${base} outfit`,
    `${base} fashion`,
    `${base} style`,
    `${base} 코디`,
    `${base} 추천`,
    `${base} 브랜드`,
    `${base} streetwear`,
    `${base} outfit men`,
    `${base} outfit women`,
  ]) {
    const k = v.toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      out.push(v);
    }
  }
  return out;
}
