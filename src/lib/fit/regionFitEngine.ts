// ─── REGION FIT ENGINE ──────────────────────────────────────────────────────
// Pure deterministic comparison of a BodyModel vs a ResolvedGarmentSize.
// Produces region-by-region deltas + labels + an honest overall confidence.
//
// This is the analytical layer the user sees as the fit table, AND the
// payload that feeds the image prompt so the rendered preview reflects the
// same fit story (tight shoulders, roomy torso, short hem, etc).

import type { ResolvedGarmentSize } from "./garmentSizeResolver";
import type { BodyProfile } from "./buildBodyProfile";

export type RegionLabel =
  | "very-tight" | "slightly-tight" | "ideal"
  | "slightly-loose" | "loose" | "oversized"
  | "too-short" | "slightly-short" | "regular-length"
  | "slightly-long" | "too-long";

export type RegionTone = "tight" | "regular" | "loose";

export interface RegionFitResult {
  region: string;             // human-readable: "Shoulders", "Chest", ...
  bodyValueCm?: number;       // user body measurement at this region
  garmentValueCm?: number;    // garment measurement at this region
  deltaCm?: number;           // garment - body (positive = roomy)
  label: RegionLabel;
  tone: RegionTone;
  visualEffect: string;       // short instruction for the image prompt
}

export interface RegionFitComputation {
  selectedSize: string;
  category: string;
  exactSizeDataAvailable: boolean;
  approximationUsed: boolean;
  confidence: "high" | "medium" | "low";
  overallLabel: "tight" | "regular" | "relaxed" | "oversized";
  regions: RegionFitResult[];
  /** Concise human-readable summary used by the explainer + prompt. */
  summary: string;
  /** Warnings to surface in the UI (e.g. missing size chart). */
  warnings: string[];
}

type BodyKey =
  | "shoulderCm" | "chestCm" | "waistCm" | "hipCm"
  | "inseamCm" | "sleeveLengthCm" | "torsoLengthCm";

interface RegionRule {
  region: string;
  body: BodyKey;
  garment: keyof ResolvedGarmentSize["measurements"];
  /** Bands (in cm of delta) for tight → loose interpretation. */
  bands: { tight: number; ideal: number; loose: number };
  /** Whether this is a length region (uses short/long labels). */
  isLength?: boolean;
}

/** Reference body values when a profile field is missing. */
const REF_BODY = {
  shoulderCm: 44,
  chestCm: 96,
  waistCm: 80,
  hipCm: 94,
  inseamCm: 78,
  sleeveLengthCm: 60,
  torsoLengthCm: 68, // approximate top length for an "ideal" hem
};

function bodyValue(profile: BodyProfile, key: string): number | undefined {
  switch (key) {
    case "shoulderCm":      return Math.round(REF_BODY.shoulderCm * profile.shoulderRatio);
    case "chestCm":         return Math.round(REF_BODY.chestCm * profile.chestRatio);
    case "waistCm":         return Math.round(REF_BODY.waistCm * profile.waistRatio);
    case "hipCm":           return Math.round(REF_BODY.hipCm * profile.hipRatio);
    case "inseamCm":        return Math.round(REF_BODY.inseamCm * profile.legRatio);
    case "sleeveLengthCm":  return Math.round(REF_BODY.sleeveLengthCm * (0.5 + profile.torsoRatio * 0.5));
    case "torsoLengthCm":   return Math.round(REF_BODY.torsoLengthCm * profile.torsoRatio);
    default: return undefined;
  }
}

const TOP_RULES: RegionRule[] = [
  { region: "Shoulders", body: "shoulderCm", garment: "shoulderCm",
    bands: { tight: -1, ideal: 2, loose: 5 } },
  { region: "Chest", body: "chestCm", garment: "chestCm",
    bands: { tight: 2, ideal: 8, loose: 16 } },
  { region: "Waist", body: "waistCm", garment: "waistCm",
    bands: { tight: 2, ideal: 10, loose: 20 } },
  { region: "Sleeves", body: "sleeveLengthCm", garment: "sleeveLengthCm",
    bands: { tight: -3, ideal: 3, loose: 8 }, isLength: true },
  { region: "Length", body: "torsoLengthCm", garment: "totalLengthCm",
    bands: { tight: -3, ideal: 4, loose: 10 }, isLength: true },
];

const BOTTOM_RULES: RegionRule[] = [
  { region: "Waist", body: "waistCm", garment: "waistCm",
    bands: { tight: 0, ideal: 4, loose: 10 } },
  { region: "Hips", body: "hipCm", garment: "hipCm",
    bands: { tight: 0, ideal: 6, loose: 14 } },
  { region: "Thigh", body: "hipCm", garment: "thighCm",
    bands: { tight: -4, ideal: 4, loose: 12 } }, // thigh roughly hip/2 + ease
  { region: "Inseam", body: "inseamCm", garment: "inseamCm",
    bands: { tight: -3, ideal: 3, loose: 8 }, isLength: true },
];

function rulesForCategory(category: string): RegionRule[] {
  if (/(pant|jean|short|legging|skirt|bottom)/.test(category)) return BOTTOM_RULES;
  return TOP_RULES;
}

function classify(deltaCm: number, bands: RegionRule["bands"], isLength?: boolean): {
  label: RegionLabel; tone: RegionTone;
} {
  if (isLength) {
    if (deltaCm < bands.tight) return { label: "too-short", tone: "tight" };
    if (deltaCm < 0)           return { label: "slightly-short", tone: "tight" };
    if (deltaCm <= bands.ideal) return { label: "regular-length", tone: "regular" };
    if (deltaCm <= bands.loose) return { label: "slightly-long", tone: "loose" };
    return { label: "too-long", tone: "loose" };
  }
  if (deltaCm < bands.tight)   return { label: "very-tight", tone: "tight" };
  if (deltaCm < 0)             return { label: "slightly-tight", tone: "tight" };
  if (deltaCm <= bands.ideal)  return { label: "ideal", tone: "regular" };
  if (deltaCm <= bands.loose)  return { label: "slightly-loose", tone: "loose" };
  return { label: "loose", tone: "loose" };
}

function visualEffectFor(region: string, label: RegionLabel): string {
  const r = region.toLowerCase();
  switch (label) {
    case "very-tight":     return `${r} pulled visibly tight, fabric stretched`;
    case "slightly-tight": return `${r} sits close, minimal ease`;
    case "ideal":          return `${r} clean and natural fit`;
    case "slightly-loose": return `${r} relaxed with comfortable ease`;
    case "loose":          return `${r} roomy with generous drape`;
    case "oversized":      return `${r} oversized with deep folds`;
    case "too-short":      return `${r} ends noticeably high`;
    case "slightly-short": return `${r} sits a touch high`;
    case "regular-length": return `${r} hits at the ideal length`;
    case "slightly-long":  return `${r} extends slightly past ideal`;
    case "too-long":       return `${r} hangs noticeably long`;
  }
}

export interface ComputeRegionFitInput {
  body: BodyProfile;
  garment: ResolvedGarmentSize;
}

export function computeRegionFit({ body, garment }: ComputeRegionFitInput): RegionFitComputation {
  const rules = rulesForCategory(garment.category);
  const regions: RegionFitResult[] = [];

  for (const rule of rules) {
    const garmentValue = garment.measurements[rule.garment];
    const bodyVal = bodyValue(body, rule.body as string);
    if (typeof garmentValue !== "number" || typeof bodyVal !== "number") {
      continue; // skip regions where we lack data for an honest comparison
    }
    const deltaCm = Math.round((garmentValue - bodyVal) * 10) / 10;
    const { label, tone } = classify(deltaCm, rule.bands, rule.isLength);
    regions.push({
      region: rule.region,
      bodyValueCm: bodyVal,
      garmentValueCm: garmentValue,
      deltaCm,
      label,
      tone,
      visualEffect: visualEffectFor(rule.region, label),
    });
  }

  // Overall = balance of tones across non-length regions
  const nonLength = regions.filter((r) => r.label !== "regular-length" && !r.label.endsWith("-short") && !r.label.endsWith("-long"));
  const tightCount = nonLength.filter((r) => r.tone === "tight").length;
  const looseCount = nonLength.filter((r) => r.tone === "loose").length;
  const idealCount = nonLength.filter((r) => r.tone === "regular").length;

  let overallLabel: RegionFitComputation["overallLabel"] = "regular";
  if (tightCount > looseCount + idealCount) overallLabel = "tight";
  else if (looseCount > tightCount + idealCount + 1) overallLabel = "oversized";
  else if (looseCount > tightCount) overallLabel = "relaxed";

  // Confidence honestly reflects the data source.
  const confidence: RegionFitComputation["confidence"] = !garment.exactSizeDataAvailable
    ? "low"
    : garment.confidence;

  const warnings: string[] = [];
  // Surface the resolver's note when we're not on exact DB data so the user
  // always sees WHY the preview is approximate (graded / fallback / nothing).
  if (garment.source === "db_graded") {
    warnings.push(
      `${garment.resolverNote} Size grading is approximate.`,
    );
  } else if (garment.source === "category_fallback") {
    warnings.push(
      `Exact measurements for size ${garment.selectedSize} are unavailable. ${garment.resolverNote}`,
    );
  } else if (garment.source === "brand_average") {
    warnings.push(
      `${garment.resolverNote} Confidence is reduced.`,
    );
  } else if (garment.source === "approximate") {
    warnings.push(garment.resolverNote);
  } else if (garment.missingFields.length > 0) {
    warnings.push(
      `Brand size chart is incomplete (missing ${garment.missingFields.length} field${
        garment.missingFields.length === 1 ? "" : "s"
      }). Confidence reduced.`,
    );
  }

  const summary = buildSummary(overallLabel, regions, garment.selectedSize);

  return {
    selectedSize: garment.selectedSize,
    category: garment.category,
    exactSizeDataAvailable: garment.exactSizeDataAvailable,
    approximationUsed: garment.source !== "db_exact",
    confidence,
    overallLabel,
    regions,
    summary,
    warnings,
  };
}

function buildSummary(
  overall: RegionFitComputation["overallLabel"],
  regions: RegionFitResult[],
  selectedSize: string,
): string {
  if (regions.length === 0) {
    return `Size ${selectedSize}: not enough garment measurements to compute a region-by-region fit.`;
  }
  const highlights = regions
    .filter((r) => r.tone !== "regular")
    .slice(0, 3)
    .map((r) => `${r.region.toLowerCase()} ${labelToHuman(r.label)}`);
  const overallText =
    overall === "tight"     ? "should feel close to the body"
  : overall === "relaxed"   ? "should feel comfortably relaxed"
  : overall === "oversized" ? "should sit clearly oversized"
  :                           "should sit naturally";
  if (highlights.length === 0) {
    return `Size ${selectedSize} ${overallText} across all measured regions.`;
  }
  return `Size ${selectedSize} ${overallText}, with ${highlights.join(", ")}.`;
}

function labelToHuman(label: RegionLabel): string {
  return label.replace(/-/g, " ");
}
