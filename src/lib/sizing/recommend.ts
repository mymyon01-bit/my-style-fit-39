// ─── RECOMMENDER ────────────────────────────────────────────────────────────
// Picks primary + alternate from the calculated SizeOutcome list, computes a
// recommendation confidence, and writes a short "why" sentence.

import type { GarmentChart } from "./garmentChart";
import type {
  FitPreference,
  RecommendationConfidence,
  ResolvedBody,
  SizeOutcome,
  SizeRecommendation,
} from "./types";

interface RecommendInput {
  body: ResolvedBody;
  chart: GarmentChart;
  preference: FitPreference;
  outcomes: SizeOutcome[];
}

/** Score multiplier per overall label, given the user's preference. */
function preferenceWeight(label: SizeOutcome["overall"], pref: FitPreference): number {
  // The closer the label matches the preference, the higher the weight.
  const matrix: Record<FitPreference, Record<SizeOutcome["overall"], number>> = {
    fitted: {
      verySmall: 0.4, tightFit: 0.7, fitted: 1.0, regularFit: 0.85,
      relaxedFit: 0.55, oversizedFit: 0.3, tooLarge: 0.1,
    },
    regular: {
      verySmall: 0.2, tightFit: 0.6, fitted: 0.85, regularFit: 1.0,
      relaxedFit: 0.8, oversizedFit: 0.4, tooLarge: 0.1,
    },
    relaxed: {
      verySmall: 0.1, tightFit: 0.4, fitted: 0.6, regularFit: 0.85,
      relaxedFit: 1.0, oversizedFit: 0.75, tooLarge: 0.2,
    },
    oversized: {
      verySmall: 0.05, tightFit: 0.2, fitted: 0.4, regularFit: 0.6,
      relaxedFit: 0.85, oversizedFit: 1.0, tooLarge: 0.55,
    },
  };
  return matrix[pref][label];
}

function pickPrimaryAndAlternate(outcomes: SizeOutcome[], pref: FitPreference) {
  if (outcomes.length === 0) return { primary: null, alternate: null };

  const ranked = [...outcomes]
    .map((o) => ({ o, weight: o.score * preferenceWeight(o.overall, pref) }))
    .sort((a, b) => b.weight - a.weight);

  const primary = ranked[0]?.o ?? null;
  // Alternate: the next-best size that has a different overall label OR a different
  // physical size; fall back to the next-ranked if uniqueness can't be enforced.
  let alternate = ranked.find((r) => r.o.size !== primary?.size && r.o.overall !== primary?.overall)?.o
                ?? ranked.find((r) => r.o.size !== primary?.size)?.o
                ?? null;
  return { primary, alternate };
}

function buildReason(primary: SizeOutcome | null, alternate: SizeOutcome | null, pref: FitPreference): string {
  if (!primary) return "Not enough information to recommend a size yet.";
  const tightRegions = primary.regions
    .filter((r) => r.status === "slightlyTight" || r.status === "tooTight")
    .map((r) => r.region);
  const looseRegions = primary.regions
    .filter((r) => r.status === "loose" || r.status === "oversized")
    .map((r) => r.region);
  const parts: string[] = [];
  parts.push(`${primary.size} matches your ${pref} preference best.`);
  if (tightRegions.length === 0 && looseRegions.length === 0) {
    parts.push("Balanced across the key regions for this category.");
  } else {
    if (tightRegions.length) parts.push(`May feel snug in ${tightRegions.join(", ")}.`);
    if (looseRegions.length) parts.push(`Roomier in ${looseRegions.join(", ")}.`);
  }
  if (alternate) {
    parts.push(`Try ${alternate.size} for a ${alternate.overall === "oversizedFit" ? "looser" : alternate.overall === "tightFit" ? "tighter" : "different"} silhouette.`);
  }
  return parts.join(" ");
}

function computeConfidence(body: ResolvedBody, chart: GarmentChart): { confidence: RecommendationConfidence; reason: string } {
  // Inputs that affect honesty:
  //  - chart.confidence (high/medium/low)
  //  - body.hasInferredFields (and how many)
  const inferredCount = body.inferredFieldNames.length;
  const bodyTier: RecommendationConfidence =
    inferredCount === 0 ? "high" :
    inferredCount <= 2 ? "medium" :
    "low";

  // Combine via worst-of with one bump if both are good.
  const combined: RecommendationConfidence =
    chart.confidence === "high" && bodyTier === "high" ? "high" :
    chart.confidence === "low" || bodyTier === "low" ? "low" :
    "medium";

  const chartReason =
    chart.confidence === "high" ? "exact size chart available" :
    chart.confidence === "medium" ? "partial size chart" :
    "no detailed size chart for this product";
  const bodyReason =
    inferredCount === 0 ? "all body measurements provided" :
    `${inferredCount} body measurement${inferredCount === 1 ? "" : "s"} inferred`;

  return {
    confidence: combined,
    reason: `${chartReason} · ${bodyReason}`,
  };
}

export function buildRecommendation(input: RecommendInput): SizeRecommendation {
  const { primary, alternate } = pickPrimaryAndAlternate(input.outcomes, input.preference);
  const { confidence, reason } = computeConfidence(input.body, input.chart);
  return {
    category: input.chart.category,
    sizes: input.outcomes,
    primarySize: primary?.size ?? null,
    alternateSize: alternate?.size ?? null,
    primaryReason: buildReason(primary, alternate, input.preference),
    confidence,
    confidenceReason: reason,
    preference: input.preference,
    usedCategoryDefaults: input.chart.usedCategoryDefaults,
  };
}
