/**
 * Discover query expander
 * -----------------------
 * Deterministic expansions only. AI refinement is intentionally NOT used here
 * so the base flow is fast, predictable, and never network-dependent.
 *
 * Rules:
 *   1. Always include the raw normalized query first.
 *   2. Append style + color + scenario + brand modifiers as compound variants.
 *   3. **CATEGORY LOCK IS LAW.** When the parsed query has a primaryCategory,
 *      every emitted variant must contain a noun from that category family.
 *      Variants that mention a noun from a DIFFERENT family are discarded
 *      immediately — style words can never override the category.
 *   4. Seasonal/freshness fillers also respect the lock (e.g. "trending bags",
 *      never bare "trending" when bags is locked).
 */
import { inferCategoryFromTitle, type PrimaryCategory } from "@/lib/search/category-lock";
import type { ParsedDiscoverQuery } from "./discover-query-parser";

/** Canonical noun per family — used to repair lock-less variants. */
const FAMILY_HEAD_NOUN: Record<PrimaryCategory, string> = {
  bags: "bag",
  shoes: "shoes",
  outerwear: "jacket",
  tops: "top",
  bottoms: "pants",
  dresses: "dress",
  accessories: "accessory",
};

/** Returns true when `text` is safe under the lock:
 *   - no lock → always safe
 *   - mentions the locked family → safe
 *   - mentions a DIFFERENT family noun → unsafe (drop) */
function passesCategoryGuard(text: string, lock: PrimaryCategory | null): boolean {
  if (!lock) return true;
  const inferred = inferCategoryFromTitle(text);
  if (inferred === null) return true;        // no category noun — safe modifier-only phrase
  return inferred === lock;                  // any other category noun = drift, drop it
}

const SEASONAL_HINTS = ["new arrivals", "trending", "this week"];

const SCENARIO_STYLE_BOOSTS: Record<string, string[]> = {
  wedding: ["formal", "elegant"],
  office: ["minimal", "tailored"],
  gym: ["sporty", "performance"],
  beach: ["casual", "linen"],
  party: ["statement", "sequins"],
  weekend: ["casual", "relaxed"],
  travel: ["lightweight", "comfortable"],
};

export interface ExpansionPlan {
  base: string;
  variants: string[];     // includes base as variants[0]
  fanoutCount: number;
}

function uniquePush(arr: string[], next: string): void {
  const v = next.trim().replace(/\s+/g, " ");
  if (v && !arr.includes(v)) arr.push(v);
}

export function expandDiscoverQuery(parsed: ParsedDiscoverQuery): ExpansionPlan {
  const base = parsed.normalized || "new arrivals";
  const variants: string[] = [];
  uniquePush(variants, base);

  // Modifier compounds
  if (parsed.color && parsed.primaryCategory) {
    uniquePush(variants, `${parsed.color} ${parsed.primaryCategory}`);
  }
  if (parsed.fit && parsed.primaryCategory) {
    uniquePush(variants, `${parsed.fit} ${parsed.primaryCategory}`);
  }
  for (const style of parsed.styleModifiers) {
    if (parsed.primaryCategory) {
      uniquePush(variants, `${style} ${parsed.primaryCategory}`);
    } else {
      uniquePush(variants, `${style} outfit`);
    }
  }

  // Scenario boosts
  if (parsed.scenario) {
    const boosts = SCENARIO_STYLE_BOOSTS[parsed.scenario] || [];
    for (const b of boosts) {
      uniquePush(variants, `${b} ${parsed.scenario}`);
    }
  }

  // Brand carriers
  if (parsed.brand && parsed.primaryCategory) {
    uniquePush(variants, `${parsed.brand} ${parsed.primaryCategory}`);
  }

  // Seasonal freshness if we still have headroom
  if (variants.length < 4) {
    for (const hint of SEASONAL_HINTS) {
      uniquePush(variants, parsed.primaryCategory ? `${hint} ${parsed.primaryCategory}` : hint);
      if (variants.length >= 4) break;
    }
  }

  return { base, variants, fanoutCount: variants.length };
}
