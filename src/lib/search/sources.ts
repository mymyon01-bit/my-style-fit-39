/**
 * Source aggregation: derive a normalized `source` from a product URL host
 * and enforce a per-source quota in the result mixer so no single store
 * dominates the visible grid.
 *
 * No DB migration required — `source` is computed on the client from the
 * existing `source_url` column. New ingestions from Farfetch/YOOX/Zalando
 * land in product_cache like any other URL.
 */
import type { Product } from "./types";

export type SourceKey =
  | "asos"
  | "farfetch"
  | "yoox"
  | "zalando"
  | "ssense"
  | "net-a-porter"
  | "mr-porter"
  | "mytheresa"
  | "matchesfashion"
  | "endclothing"
  | "nordstrom"
  | "shopbop"
  | "revolve"
  | "luisaviaroma"
  | "uniqlo"
  | "cos"
  | "arket"
  | "hm"
  | "zara"
  | "everlane"
  | "aritzia"
  | "saksfifthavenue"
  | "neimanmarcus"
  | "amazon"
  | "other";

const HOST_RULES: Array<{ re: RegExp; source: SourceKey }> = [
  { re: /(^|\.)asos\./i, source: "asos" },
  { re: /(^|\.)farfetch\./i, source: "farfetch" },
  { re: /(^|\.)yoox\./i, source: "yoox" },
  { re: /(^|\.)zalando\./i, source: "zalando" },
  { re: /(^|\.)ssense\./i, source: "ssense" },
  { re: /net-a-porter\./i, source: "net-a-porter" },
  { re: /mrporter\./i, source: "mr-porter" },
  { re: /mytheresa\./i, source: "mytheresa" },
  { re: /matchesfashion\./i, source: "matchesfashion" },
  { re: /endclothing\./i, source: "endclothing" },
  { re: /nordstrom\./i, source: "nordstrom" },
  { re: /shopbop\./i, source: "shopbop" },
  { re: /revolve\./i, source: "revolve" },
  { re: /luisaviaroma\./i, source: "luisaviaroma" },
  { re: /uniqlo\./i, source: "uniqlo" },
  { re: /cosstores\.|(^|\.)cos\./i, source: "cos" },
  { re: /arket\./i, source: "arket" },
  { re: /(^|\.)hm\./i, source: "hm" },
  { re: /zara\./i, source: "zara" },
  { re: /everlane\./i, source: "everlane" },
  { re: /aritzia\./i, source: "aritzia" },
  { re: /saksfifthavenue\./i, source: "saksfifthavenue" },
  { re: /neimanmarcus\./i, source: "neimanmarcus" },
  { re: /amazon\./i, source: "amazon" },
];

export function sourceFromUrl(url: string | null | undefined): SourceKey {
  if (!url) return "other";
  let host = "";
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return "other";
  }
  for (const { re, source } of HOST_RULES) {
    if (re.test(host)) return source;
  }
  return "other";
}

export function sourceOf(p: Product): SourceKey {
  return (p as Product & { source?: SourceKey }).source || sourceFromUrl(p.externalUrl);
}

/**
 * Reorder so no single source occupies more than `maxRatio` of the first
 * `windowSize` slots. Items beyond the cap are pushed back; under-represented
 * sources fill in. Relevance order is preserved within each source bucket.
 */
export function enforceSourceQuota<T extends Product>(
  items: T[],
  opts: { windowSize?: number; maxRatio?: number } = {},
): T[] {
  const windowSize = Math.min(opts.windowSize ?? 24, items.length);
  const maxRatio = opts.maxRatio ?? 0.3;
  if (items.length <= 4) return items;
  const maxPerSource = Math.max(2, Math.floor(windowSize * maxRatio));

  const window = items.slice(0, windowSize);
  const tail = items.slice(windowSize);

  const counts = new Map<SourceKey, number>();
  const kept: T[] = [];
  const overflow: T[] = [];

  for (const p of window) {
    const src = sourceOf(p);
    const c = counts.get(src) || 0;
    if (c < maxPerSource) {
      counts.set(src, c + 1);
      kept.push(p);
    } else {
      overflow.push(p);
    }
  }

  // Backfill kept up to windowSize from tail items whose source is under the cap.
  let cursor = 0;
  while (kept.length < windowSize && cursor < tail.length) {
    const cand = tail[cursor++];
    const src = sourceOf(cand);
    const c = counts.get(src) || 0;
    if (c < maxPerSource) {
      counts.set(src, c + 1);
      kept.push(cand);
    } else {
      overflow.push(cand);
    }
  }

  // Anything we couldn't fit goes after, then the rest of the original tail
  // (minus what we already pulled in).
  const remainingTail = tail.slice(cursor);
  return [...kept, ...overflow, ...remainingTail];
}
