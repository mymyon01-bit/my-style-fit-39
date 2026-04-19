/**
 * Multi-query expansion — turns ONE user query into Korean + EN search variants.
 * Used by the Apify-first discovery pipeline. Category-locked variants only;
 * style words are appended, never substituted.
 */
export function expandQuery(q: string): string[] {
  const base = q.trim();
  if (!base) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of [
    base,
    `${base} 코디`,
    `${base} 추천`,
    `${base} 스타일`,
    `${base} 브랜드`,
    `${base} outfit`,
    `${base} fashion`,
    `${base} look`,
    `${base} streetwear`,
    `${base} minimal`,
  ]) {
    const k = v.toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      out.push(v);
    }
  }
  return out;
}
