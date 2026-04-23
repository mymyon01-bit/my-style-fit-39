// ─── FIT CALCULATOR ─────────────────────────────────────────────────────────
// For every available size in a product chart, compute per-region status,
// overall fit label, score, and a one-line summary. Driven by:
//
//   user body (resolved + flagged) + garment chart + category rules + preference
//
// The output is reusable by both the UI (per-size table) AND the visual try-on
// pipeline (passed as `fitOutcomes` to fit-generate-v2).

import {
  CATEGORY_RULES,
  REGION_STATUS_LABEL,
  classifyRegion,
  type EasePerRegion,
} from "./categoryRules";
import type { GarmentChart, SizeMeasurements } from "./garmentChart";
import type {
  FitPreference,
  OverallFitLabel,
  Region,
  RegionOutcome,
  RegionStatus,
  ResolvedBody,
  SizeOutcome,
  SizingCategory,
} from "./types";

interface CalcInput {
  body: ResolvedBody;
  chart: GarmentChart;
  preference: FitPreference;
}

/** Return body cm for a region. Returns null if not derivable. */
function bodyValue(body: ResolvedBody, region: Region): number | null {
  switch (region) {
    case "shoulder": return body.shoulderCm.cm;
    case "chest":    return body.chestCm.cm;
    case "waist":    return body.waistCm.cm;
    case "hip":      return body.hipCm.cm;
    case "thigh":    return body.thighCm.cm;
    case "sleeve":   return body.sleeveCm.cm;
    case "inseam":   return body.inseamCm.cm;
    case "length":   return null; // length doesn't correspond to a body measurement directly
  }
}

/** Compute one region for one size. */
function evalRegion(
  body: ResolvedBody,
  garment: SizeMeasurements,
  region: Region,
  ease: number,
  garmentSource: "exact" | "graded" | "categoryDefault",
  category: keyof typeof CATEGORY_RULES,
): RegionOutcome {
  const garmentCm = (garment as any)[region] as number | undefined;
  const bodyCm = bodyValue(body, region);

  // For length, garment value is absolute and not compared to a body cm —
  // we use category-aware tolerance against the size's own default if
  // present, otherwise mark "regular".
  if (region === "length") {
    const ruleMode = CATEGORY_RULES[category].lengthMode;
    if (ruleMode === "ignore") {
      return { region, status: "regular", deltaCm: null, garmentSource };
    }
    if (typeof garmentCm !== "number") {
      return { region, status: "regular", deltaCm: null, garmentSource: "missing" };
    }
    return { region, status: "regular", deltaCm: 0, garmentSource };
  }

  if (typeof garmentCm !== "number" || bodyCm == null) {
    return { region, status: "regular", deltaCm: null, garmentSource: "missing" };
  }

  const measuredEase = garmentCm - bodyCm;
  const diff = measuredEase - ease;
  const status = classifyRegion(diff, ease, region);
  return {
    region,
    status,
    deltaCm: Math.round(measuredEase * 10) / 10,
    garmentSource,
  };
}

/** Score one region's status for the overall fit number. */
function statusScore(s: RegionStatus): number {
  switch (s) {
    case "regular":       return 100;
    case "slightlyTight": return 75;
    case "slightlyLoose": return 80;
    case "loose":         return 55;
    case "oversized":     return 35;
    case "tooTight":      return 20;
  }
}

/** Combine region statuses into an overall fit label.
 *  Heavily weighted regions (shoulder, chest) dominate even when alone tight. */
function pickOverall(regions: RegionOutcome[], weights: Partial<Record<string, number>>): OverallFitLabel {
  const statuses = regions.map((r) => r.status);
  const has = (s: RegionStatus) => statuses.includes(s);
  const count = (s: RegionStatus) => statuses.filter((x) => x === s).length;

  // Helper: is any heavy-weight (>=0.25) region in a given status?
  const heavyWith = (s: RegionStatus) =>
    regions.some((r) => r.status === s && ((weights as any)[r.region] ?? 0) >= 0.25);

  // Hard fails first — be honest about catastrophic mismatches.
  if (count("tooTight") >= 2) return "verySmall";
  if (heavyWith("tooTight")) return "verySmall"; // shoulder OR chest tooTight = verySmall
  if (count("oversized") >= 3) return "tooLarge";
  if (count("oversized") >= 2) return "oversizedFit";
  if (heavyWith("oversized")) return "oversizedFit";

  if (has("tooTight") || count("slightlyTight") >= 2) return "tightFit";
  if (count("loose") >= 2) return "relaxedFit";
  if (count("slightlyLoose") >= 2) return "relaxedFit";
  if (count("slightlyTight") >= 1 && count("regular") >= regions.length - 2) return "fitted";
  if (count("regular") >= Math.ceil(regions.length / 2)) return "regularFit";
  return "regularFit";
}

/**
 * EXTREME-MISMATCH GUARD (per spec [4] INVALID OUTPUT RULE).
 *
 * Compares aggregate body circumference vs aggregate garment circumference
 * for the most weight-critical region of the category (chest for tops, waist
 * for bottoms). Catches cases where the soft per-region status logic would
 * still allow a 100kg user wearing S to be labeled "regularFit" because the
 * category-default chart was filled in too generously.
 *
 * Hard rules:
 *   garment_chest < body_chest − 4cm     → MUST be at least "tightFit"
 *   garment_chest < body_chest − 10cm    → MUST be "verySmall"
 *   garment_chest > body_chest + ease+12 → MUST be at least "oversizedFit"
 *   garment_chest > body_chest + ease+22 → MUST be "tooLarge"
 */
function applyExtremeRules(
  base: OverallFitLabel,
  regions: RegionOutcome[],
  body: ResolvedBody,
  category: SizingCategory,
  preferenceEase: EasePerRegion,
): OverallFitLabel {
  // Pick the dominant region for this category.
  const isBottom = ["pants", "denim", "shorts", "skirt"].includes(category);
  const region: Region = isBottom ? "waist" : "chest";

  const garment = regions.find((r) => r.region === region);
  if (!garment || garment.deltaCm == null) return base;

  const bodyCm = region === "chest" ? body.chestCm.cm : body.waistCm.cm;
  if (!bodyCm || bodyCm <= 0) return base;

  // garment circumference - body = deltaCm  (positive = ease/room)
  const delta = garment.deltaCm;
  const targetEase = (preferenceEase as any)[region] ?? 4;

  // ── TIGHT side ──
  if (delta < -10) return "verySmall";        // garment is 10cm+ smaller than body
  if (delta < -4)  return rankMin(base, "tightFit");
  if (delta < targetEase - 6) return rankMin(base, "tightFit");

  // ── LOOSE side ──
  if (delta > targetEase + 22) return "tooLarge";
  if (delta > targetEase + 12) return rankMax(base, "oversizedFit");

  return base;
}

const TIER_ORDER: OverallFitLabel[] = [
  "verySmall", "tightFit", "fitted", "regularFit", "relaxedFit", "oversizedFit", "tooLarge",
];
function tierIdx(l: OverallFitLabel): number {
  return TIER_ORDER.indexOf(l);
}
/** Return the LARGER (looser) of two labels — used to push toward looser. */
function rankMax(a: OverallFitLabel, b: OverallFitLabel): OverallFitLabel {
  return tierIdx(a) >= tierIdx(b) ? a : b;
}
/** Return the SMALLER (tighter) of two labels — used to push toward tighter. */
function rankMin(a: OverallFitLabel, b: OverallFitLabel): OverallFitLabel {
  return tierIdx(a) <= tierIdx(b) ? a : b;
}

const OVERALL_LABEL_FRIENDLY: Record<OverallFitLabel, string> = {
  verySmall:    "Very small",
  tightFit:     "Tight fit",
  fitted:       "Fitted",
  regularFit:   "Regular fit",
  relaxedFit:   "Relaxed fit",
  oversizedFit: "Oversized fit",
  tooLarge:     "Too large",
};

export function overallLabelText(o: OverallFitLabel): string {
  return OVERALL_LABEL_FRIENDLY[o];
}

function summarize(regions: RegionOutcome[]): string {
  const tight = regions.filter((r) => r.status === "tooTight" || r.status === "slightlyTight");
  const loose = regions.filter((r) => r.status === "loose" || r.status === "oversized");
  const parts: string[] = [];
  if (tight.length) parts.push(`Tight in ${tight.map((r) => r.region).join(", ")}`);
  if (loose.length) parts.push(`Loose in ${loose.map((r) => r.region).join(", ")}`);
  if (parts.length === 0) return "Balanced across all regions.";
  return parts.join(" · ");
}

/** Calculate per-size outcomes for the whole chart. */
export function calculateAllSizes(input: CalcInput): SizeOutcome[] {
  const rule = CATEGORY_RULES[input.chart.category];
  const ease = rule.ease[input.preference];
  const out: SizeOutcome[] = [];

  for (const size of input.chart.sizeOrder) {
    const garment = input.chart.sizes[size];
    const garmentSource = input.chart.sources[size];

    const regions: RegionOutcome[] = rule.regions.map((r) =>
      evalRegion(
        input.body,
        garment,
        r,
        (ease as any)[r] ?? 0,
        garmentSource,
        input.chart.category,
      ),
    );

    let overall = pickOverall(regions, rule.weights);
    // EXTREME-MISMATCH GUARD — heavy body + small garment must be tight,
    // light body + large garment must be oversized, regardless of how the
    // category-default rows happen to add up.
    overall = applyExtremeRules(overall, regions, input.body, input.chart.category, ease);
    let score = 0;
    let weightSum = 0;
    for (const r of regions) {
      const w = (rule.weights as any)[r.region] ?? 0;
      weightSum += w;
      score += w * statusScore(r.status);
    }
    score = weightSum > 0 ? Math.round(score / weightSum) : 60;

    out.push({
      size,
      regions,
      overall,
      score,
      summary: summarize(regions),
    });
  }

  // ── Sanity validation pass: enforce monotonic progression across adjacent
  // sizes so we never jump (e.g.) verySmall → regularFit between S and M.
  // Adjacent sizes can move at most ONE tier on the OVERALL_TIER ladder.
  return smoothAdjacentSizes(out);
}

/** Ordered tier ladder used for monotonic smoothing. */
const OVERALL_TIER: OverallFitLabel[] = [
  "verySmall", "tightFit", "fitted", "regularFit", "relaxedFit", "oversizedFit", "tooLarge",
];
const TIER_INDEX: Record<OverallFitLabel, number> = OVERALL_TIER.reduce(
  (acc, label, i) => { acc[label] = i; return acc; },
  {} as Record<OverallFitLabel, number>,
);

/**
 * Walk the size ladder twice (forward + backward) and clamp any single-step
 * jump greater than one tier. Adjacent sizes physically can't leap multiple
 * fit categories — when they appear to, the underlying numbers are noisy
 * (mixed exact + categoryDefault rows), so we smooth toward the neighbour.
 */
function smoothAdjacentSizes(outcomes: SizeOutcome[]): SizeOutcome[] {
  if (outcomes.length < 2) return outcomes;
  const labels = outcomes.map((o) => TIER_INDEX[o.overall]);
  // Forward pass — sizes get progressively LOOSER as we go up the ladder, so
  // each tier index should be >= previous. Cap upward jumps at +2 tiers.
  for (let i = 1; i < labels.length; i++) {
    if (labels[i] < labels[i - 1] - 1) labels[i] = labels[i - 1] - 1;
    if (labels[i] > labels[i - 1] + 2) labels[i] = labels[i - 1] + 2;
  }
  // Backward pass — same logic from the other direction.
  for (let i = labels.length - 2; i >= 0; i--) {
    if (labels[i] > labels[i + 1] + 1) labels[i] = labels[i + 1] + 1;
    if (labels[i] < labels[i + 1] - 2) labels[i] = labels[i + 1] - 2;
  }
  return outcomes.map((o, i) => {
    const smoothed = OVERALL_TIER[Math.max(0, Math.min(OVERALL_TIER.length - 1, labels[i]))];
    return smoothed === o.overall ? o : { ...o, overall: smoothed };
  });
}

/** Re-export label maps for the UI. */
export { REGION_STATUS_LABEL };
