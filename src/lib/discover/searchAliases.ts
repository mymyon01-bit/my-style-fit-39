/**
 * Discover search alias expander
 * ------------------------------
 * Turns a user query into the broadest reasonable set of search terms by:
 *   1. normalizing + tokenizing
 *   2. expanding KR / vibe tokens via SEARCH_KR_EN_MAP
 *   3. re-tokenizing the EN expansions so multi-word aliases ("date night")
 *      contribute their individual words too
 *
 * Output is a deduped string[] safe to feed to the OR-clause builder.
 *
 * Why this exists:
 *   - Korean queries (가방, 자켓) hit a mostly-English product_cache
 *   - Vibe queries (꾸안꾸 느낌, 데이트룩) need EN synonyms to match anything
 *   - Multi-word EN queries ("red shoes") must NOT be matched as a single
 *     literal phrase — token fallback is essential
 */
import { SEARCH_KR_EN_MAP } from "./constants";
import { normalizeSearchQuery, tokenizeSearchQuery } from "./searchTokenizer";

export function expandSearchAliases(query: string): string[] {
  const normalized = normalizeSearchQuery(query);
  const tokens = tokenizeSearchQuery(query);
  const expanded = new Set<string>();

  if (normalized) expanded.add(normalized);
  for (const token of tokens) {
    expanded.add(token);
    const aliases = SEARCH_KR_EN_MAP[token];
    if (aliases) {
      for (const alias of aliases) {
        const a = alias.toLowerCase();
        expanded.add(a);
        for (const sub of tokenizeSearchQuery(alias)) expanded.add(sub);
      }
    }
  }

  // Also scan the raw normalized string for multi-char KR keys (가방 inside 가방추천).
  for (const krKey of Object.keys(SEARCH_KR_EN_MAP)) {
    if (normalized.includes(krKey)) {
      for (const alias of SEARCH_KR_EN_MAP[krKey]) {
        const a = alias.toLowerCase();
        expanded.add(a);
        for (const sub of tokenizeSearchQuery(alias)) expanded.add(sub);
      }
    }
  }

  return Array.from(expanded);
}
