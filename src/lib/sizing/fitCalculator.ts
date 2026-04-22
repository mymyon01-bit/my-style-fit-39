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

/** Combine region statuses into an overall fit label. */
function pickOverall(regions: RegionOutcome[]): OverallFitLabel {
  const statuses = regions.map((r) => r.status);
  const has = (s: RegionStatus) => statuses.includes(s);
  const count = (s: RegionStatus) => statuses.filter((x) => x === s).length;

  if (count("tooTight") >= 2) return "verySmall";
  if (has("tooTight") && (count("slightlyTight") >= 1)) return "verySmall";
  if (count("oversized") >= 3) return "tooLarge";
  if (count("oversized") >= 2) return "oversizedFit";
  if (has("oversized")) return "oversizedFit";
  if (count("loose") >= 2) return "relaxedFit";
  if (count("slightlyLoose") >= 2) return "relaxedFit";
  if (has("tooTight") || count("slightlyTight") >= 2) return "tightFit";
  if (count("slightlyTight") >= 1 && count("regular") >= regions.length - 2) return "fitted";
  if (count("regular") >= Math.ceil(regions.length / 2)) return "regularFit";
  return "regularFit";
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

    const overall = pickOverall(regions);
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
  return out;
}

/** Re-export label maps for the UI. */
export { REGION_STATUS_LABEL };
