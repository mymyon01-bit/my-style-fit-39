// ─── RECOMMENDER ────────────────────────────────────────────────────────────
// Picks primary + alternate from the calculated SizeOutcome list, computes a
// recommendation confidence, and writes a short "why" sentence.
//
// Honesty rule: when the user's body is genuinely outside the chart range
// (e.g. 180cm/100kg picking a brand whose largest is S), we DO NOT silently
// recommend the closest size as if it were a match. We pin to the boundary
// size and surface a clear "this product won't fit" warning instead.

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
  const matrix: Record<FitPreference, Record<SizeOutcome["overall"], number>> = {
    fitted: {
      verySmall: 0.0, tightFit: 0.7, fitted: 1.0, regularFit: 0.85,
      relaxedFit: 0.55, oversizedFit: 0.3, tooLarge: 0.0,
    },
    regular: {
      verySmall: 0.0, tightFit: 0.55, fitted: 0.85, regularFit: 1.0,
      relaxedFit: 0.8, oversizedFit: 0.4, tooLarge: 0.0,
    },
    relaxed: {
      verySmall: 0.0, tightFit: 0.35, fitted: 0.6, regularFit: 0.85,
      relaxedFit: 1.0, oversizedFit: 0.75, tooLarge: 0.0,
    },
    oversized: {
      verySmall: 0.0, tightFit: 0.15, fitted: 0.4, regularFit: 0.6,
      relaxedFit: 0.85, oversizedFit: 1.0, tooLarge: 0.0,
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
  const alternate = ranked.find((r) => r.o.size !== primary?.size && r.o.overall !== primary?.overall)?.o
                 ?? ranked.find((r) => r.o.size !== primary?.size)?.o
                 ?? null;
  return { primary, alternate };
}

/**
 * Detect if the user's body genuinely sits OUTSIDE the chart range.
 * The largest size still being too tight (or smallest still too loose) means
 * NO size in this product will actually fit — we must say so.
 */
function detectRangeStatus(outcomes: SizeOutcome[]): {
  status: "ok" | "tooSmall" | "tooLarge";
  warning: string | null;
} {
  if (outcomes.length === 0) return { status: "ok", warning: null };

  const TIGHT = new Set(["tooTight", "slightlyTight"]);
  const LOOSE = new Set(["oversized", "loose"]);

  const countWith = (o: SizeOutcome, set: Set<string>) =>
    o.regions.filter((r) => set.has(r.status)).length;

  const largest = outcomes[outcomes.length - 1];
  const smallest = outcomes[0];

  const largestStillTight =
    largest.overall === "verySmall" ||
    largest.overall === "tightFit" ||
    countWith(largest, TIGHT) >= 2;
  if (largestStillTight) {
    return {
      status: "tooSmall",
      warning: `Even the largest available size (${largest.size}) is too small for your measurements. This product likely won't fit.`,
    };
  }

  const smallestStillLoose =
    smallest.overall === "tooLarge" ||
    smallest.overall === "oversizedFit" ||
    countWith(smallest, LOOSE) >= 2;
  if (smallestStillLoose) {
    return {
      status: "tooLarge",
      warning: `Even the smallest available size (${smallest.size}) is too large for your measurements.`,
    };
  }

  return { status: "ok", warning: null };
}

function buildReason(
  primary: SizeOutcome | null,
  alternate: SizeOutcome | null,
  pref: FitPreference,
  rangeStatus: "ok" | "tooSmall" | "tooLarge",
): string {
  if (!primary) return "Not enough information to recommend a size yet.";

  if (rangeStatus === "tooSmall") {
    const tight = primary.regions
      .filter((r) => r.status === "tooTight" || r.status === "slightlyTight")
      .map((r) => r.region)
      .join(", ") || "key regions";
    return `${primary.size} is the largest the brand offers, but your measurements exceed this size. Expect it to feel ${primary.overall === "verySmall" ? "very tight" : "tight"} in ${tight}.`;
  }
  if (rangeStatus === "tooLarge") {
    return `${primary.size} is the smallest the brand offers, but it will still sit loose on you.`;
  }

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

function computeConfidence(
  body: ResolvedBody,
  chart: GarmentChart,
  rangeStatus: "ok" | "tooSmall" | "tooLarge",
): { confidence: RecommendationConfidence; reason: string } {
  const inferredCount = body.inferredFieldNames.length;
  const bodyTier: RecommendationConfidence =
    inferredCount === 0 ? "high" :
    inferredCount <= 2 ? "medium" :
    "low";

  let combined: RecommendationConfidence =
    chart.confidence === "high" && bodyTier === "high" ? "high" :
    chart.confidence === "low" || bodyTier === "low" ? "low" :
    "medium";

  // Out-of-range = we already know the recommendation is wrong → force low.
  if (rangeStatus !== "ok") combined = "low";

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
  const range = detectRangeStatus(input.outcomes);

  let primary: SizeOutcome | null;
  let alternate: SizeOutcome | null;
  if (range.status === "tooSmall") {
    primary = input.outcomes[input.outcomes.length - 1] ?? null;
    alternate = input.outcomes[input.outcomes.length - 2] ?? null;
  } else if (range.status === "tooLarge") {
    primary = input.outcomes[0] ?? null;
    alternate = input.outcomes[1] ?? null;
  } else {
    const picked = pickPrimaryAndAlternate(input.outcomes, input.preference);
    primary = picked.primary;
    alternate = picked.alternate;
  }

  const { confidence, reason } = computeConfidence(input.body, input.chart, range.status);
  return {
    category: input.chart.category,
    sizes: input.outcomes,
    primarySize: primary?.size ?? null,
    alternateSize: alternate?.size ?? null,
    primaryReason: buildReason(primary, alternate, input.preference, range.status),
    confidence,
    confidenceReason: reason,
    preference: input.preference,
    usedCategoryDefaults: input.chart.usedCategoryDefaults,
    rangeStatus: range.status,
    rangeWarning: range.warning,
  };
}
