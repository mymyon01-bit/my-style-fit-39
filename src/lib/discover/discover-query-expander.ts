/**
 * Discover query expander
 * -----------------------
 * Deterministic expansions only in this phase. AI refinement is a stub that
 * the source orchestrator can call later — left intentionally optional so
 * the base flow always works without a network round-trip.
 *
 * Rules:
 *   1. Always include the raw normalized query first.
 *   2. Append style + color + scenario modifiers as compound variants.
 *   3. Never expand outside the category lock (we don't introduce new
 *      category nouns — we only refine adjectives/scenarios).
 */
import type { ParsedDiscoverQuery } from "./discover-query-parser";

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
