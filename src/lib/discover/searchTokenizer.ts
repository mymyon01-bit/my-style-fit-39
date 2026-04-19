/**
 * Discover search tokenizer (lightweight)
 * ---------------------------------------
 * Spec-mandated minimal tokenizer used by searchAliases + the parser's
 * `tokens` / `expandedTerms` fields.
 *
 * The richer `discover-tokenizer.ts` is still the source of truth for
 * DB selectors (it also handles Hangul detection and KR family hints).
 * This file exists to provide the exact API the upgrade spec requires:
 *
 *   normalizeSearchQuery(input) → string
 *   tokenizeSearchQuery(input)  → string[]
 *
 * Both are pure, sync, allocation-light and safe to call on every keystroke.
 */

const STOPWORDS = new Set<string>([
  // EN fillers
  "a", "an", "the", "for", "with", "look", "style", "outfit",
  "and", "or", "of", "to", "in", "on", "very", "really",
  // KR fillers
  "좀", "느낌", "같은", "코디", "룩", "추천",
]);

export function normalizeSearchQuery(input: string): string {
  return (input || "")
    .trim()
    .toLowerCase()
    .replace(/[(),.!?;:"']/g, " ")
    .replace(/\s+/g, " ");
}

export function tokenizeSearchQuery(input: string): string[] {
  const normalized = normalizeSearchQuery(input);
  if (!normalized) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of normalized.split(" ")) {
    const t = raw.trim();
    if (!t) continue;
    if (STOPWORDS.has(t)) continue;
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}
