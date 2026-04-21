// ─── FIT SOLVER — DETERMINISTIC CORE ────────────────────────────────────────
// Source of truth for the FIT system. Combines BodyProfile + GarmentFitMap +
// (optional) regional cm-deltas from the legacy fitEngine into a single
// solver result: score, fitType, recommendation, per-region labels,
// human summary, and AI image-generation hints.
//
// Every other layer (FitResults UI, FitBreakdown, AI prompt builder)
// consumes SolverResult — never the reverse.

import type { BodyProfile } from "./buildBodyProfile";
import type { GarmentFitMap, GarmentCategory, SilhouetteType } from "./buildGarmentFitMap";

export type RegionFit =
  | "tight" | "snug" | "balanced" | "roomy" | "oversized";
export type WaistFit =
  | "tight" | "clean" | "balanced" | "relaxed" | "loose";
export type ShoulderFit =
  | "pulled" | "structured" | "natural" | "dropped";
export type LengthFit =
  | "short" | "slightly_short" | "regular" | "slightly_long" | "long";
export type SleeveFit =
  | "tight" | "trim" | "regular" | "loose";

export type FitTypeLabel = "trim" | "regular" | "relaxed" | "oversized";
export type Recommendation = "best" | "good" | "acceptable" | "not_recommended";
export type FitConfidence = "high" | "medium" | "low";

export interface SolverRegion<F extends string> {
  /** unitless delta — positive = more room than body, negative = tighter */
  delta: number;
  fit: F;
}

export interface SolverResult {
  overallScore: number;
  fitType: FitTypeLabel;
  silhouette: SilhouetteType;
  recommendation: Recommendation;
  regions: {
    chest: SolverRegion<RegionFit>;
    waist: SolverRegion<WaistFit>;
    shoulder: SolverRegion<ShoulderFit>;
    length: SolverRegion<LengthFit>;
    sleeve: SolverRegion<SleeveFit>;
  };
  summary: string;
  /** Short imperative phrases injected into the image-generation prompt. */
  visualPromptHints: string[];
  /** high = full real measurements, medium = partial, low = mostly defaults. */
  confidence: FitConfidence;
  /** True when any region falls back to reference defaults. */
  approximation: boolean;
  /** Body fields that came from the user (vs reference defaults). */
  fieldsUsed: string[];
}

// ── Region classifiers ─────────────────────────────────────────────────────

function classifyChest(ease: number): RegionFit {
  if (ease <= 0.01) return "tight";
  if (ease <= 0.04) return "snug";
  if (ease <= 0.08) return "balanced";
  if (ease <= 0.13) return "roomy";
  return "oversized";
}

function classifyWaist(ease: number): WaistFit {
  if (ease <= 0.01) return "tight";
  if (ease <= 0.04) return "clean";
  if (ease <= 0.08) return "balanced";
  if (ease <= 0.12) return "relaxed";
  return "loose";
}

function classifyShoulder(drop: number): ShoulderFit {
  if (drop < 0) return "pulled";
  if (drop <= 0.015) return "structured";
  if (drop <= 0.04) return "natural";
  return "dropped";
}

function classifyLength(delta: number): LengthFit {
  if (delta <= -0.04) return "short";
  if (delta <= -0.015) return "slightly_short";
  if (delta < 0.025) return "regular";
  if (delta < 0.05) return "slightly_long";
  return "long";
}

function classifySleeve(volume: number): SleeveFit {
  if (volume <= 0.02) return "tight";
  if (volume <= 0.05) return "trim";
  if (volume <= 0.09) return "regular";
  return "loose";
}

// ── Region → score ─────────────────────────────────────────────────────────

const CHEST_SCORE: Record<RegionFit, number> = {
  tight: 45, snug: 78, balanced: 96, roomy: 84, oversized: 70,
};
const WAIST_SCORE: Record<WaistFit, number> = {
  tight: 50, clean: 88, balanced: 95, relaxed: 82, loose: 68,
};
const SHOULDER_SCORE: Record<ShoulderFit, number> = {
  pulled: 45, structured: 95, natural: 88, dropped: 72,
};
const LENGTH_SCORE: Record<LengthFit, number> = {
  short: 50, slightly_short: 72, regular: 95, slightly_long: 80, long: 65,
};
const SLEEVE_SCORE: Record<SleeveFit, number> = {
  tight: 55, trim: 86, regular: 92, loose: 74,
};

// ── Visual hints per region (drive the image prompt) ───────────────────────

const CHEST_HINT: Record<RegionFit, string> = {
  tight:     "very close chest line, fabric pulling slightly across pecs",
  snug:      "close chest line with minimal fabric room",
  balanced:  "natural chest room with clean drape",
  roomy:     "visible chest room with soft volume",
  oversized: "generous chest volume with wide drape",
};
const WAIST_HINT: Record<WaistFit, string> = {
  tight:     "tighter waist line, contoured to body",
  clean:     "clean waist line, lightly skimming the torso",
  balanced:  "natural waist line, neutral drape",
  relaxed:   "softer waist line with mild drape",
  loose:     "loose flowing waist with deep folds",
};
const SHOULDER_HINT: Record<ShoulderFit, string> = {
  pulled:     "shoulder seams pulled tight against deltoids",
  structured: "structured shoulder seams sitting cleanly on the shoulder point",
  natural:    "shoulder seams sitting just past the natural shoulder",
  dropped:    "pronounced dropped shoulder line falling onto upper arm",
};
const LENGTH_HINT: Record<LengthFit, string> = {
  short:          "noticeably short hem above the natural waist",
  slightly_short: "slightly shorter hem sitting above the waistband",
  regular:        "regular hem length sitting at the hip",
  slightly_long:  "slightly longer hem covering the waistband",
  long:           "longer hem extending past the hip",
};
const SLEEVE_HINT: Record<SleeveFit, string> = {
  tight:   "tight sleeves close to the arm",
  trim:    "trim sleeves with minimal volume",
  regular: "natural sleeve volume with light drape",
  loose:   "looser dropped sleeves with visible folds",
};

// ── Body bias on length (torso vs garment) ─────────────────────────────────

function bodyLengthBias(body: BodyProfile, baseDelta: number): number {
  // Longer torso vs reference → garment feels shorter.
  const torsoExtra = body.torsoRatio - 1;
  return baseDelta - torsoExtra * 0.5;
}

// ── Sleeve volume bias from arm scale ──────────────────────────────────────

function sleeveVolumeAdjusted(body: BodyProfile, baseVolume: number): number {
  const armExtra = (body.armScale ?? 1) - 1;
  return Math.max(0, baseVolume - Math.max(0, armExtra) * 0.4);
}

// ── Score → recommendation tier ───────────────────────────────────────────

function recommendationFromScore(score: number): Recommendation {
  if (score >= 86) return "best";
  if (score >= 74) return "good";
  if (score >= 62) return "acceptable";
  return "not_recommended";
}

// ── Public API ─────────────────────────────────────────────────────────────

export function solveFit(args: {
  body: BodyProfile;
  fit: GarmentFitMap;
  category: GarmentCategory;
  selectedSize: string;
}): SolverResult {
  const { body, fit, category, selectedSize } = args;
  const isBottom = category === "bottom";

  // Resolve region labels from the GarmentFitMap eases (already body-biased).
  const chestFit    = classifyChest(fit.chestEase);
  const waistFit    = classifyWaist(fit.waistEase);
  const shoulderFit = isBottom ? "structured" as ShoulderFit : classifyShoulder(fit.shoulderDrop);
  const lengthFit   = classifyLength(bodyLengthBias(body, fit.bodyLengthDelta));
  const sleeveFit   = isBottom ? "regular" as SleeveFit : classifySleeve(sleeveVolumeAdjusted(body, fit.sleeveVolume));

  // Weighted score — tops vs bottoms
  let score: number;
  if (isBottom) {
    score =
      0.35 * WAIST_SCORE[waistFit] +
      0.30 * CHEST_SCORE[chestFit] + // hip ease ≈ chest ease for bottoms
      0.25 * LENGTH_SCORE[lengthFit] +
      0.10 * 90; // neutral shoulder/sleeve placeholder
  } else {
    score =
      0.32 * CHEST_SCORE[chestFit] +
      0.22 * WAIST_SCORE[waistFit] +
      0.22 * SHOULDER_SCORE[shoulderFit] +
      0.14 * LENGTH_SCORE[lengthFit] +
      0.10 * SLEEVE_SCORE[sleeveFit];
  }
  const overallScore = Math.max(0, Math.min(100, Math.round(score)));

  // Map silhouette → fitType (UI-friendly)
  const fitTypeMap: Record<SilhouetteType, FitTypeLabel> = {
    trim: "trim", fitted: "trim", regular: "regular",
    relaxed: "relaxed", oversized: "oversized",
  };
  const fitType = fitTypeMap[fit.silhouetteType] ?? "regular";

  // Build visual hints — only the meaningful ones (skip `regular`/neutral).
  const hints: string[] = [];
  if (!isBottom) hints.push(CHEST_HINT[chestFit]);
  hints.push(WAIST_HINT[waistFit]);
  if (!isBottom) hints.push(SHOULDER_HINT[shoulderFit]);
  hints.push(LENGTH_HINT[lengthFit]);
  if (!isBottom) hints.push(SLEEVE_HINT[sleeveFit]);

  // Human summary
  const recommendation = recommendationFromScore(overallScore);
  const summary = buildSummary({
    size: selectedSize, fitType, chestFit, waistFit, shoulderFit, lengthFit, sleeveFit, isBottom,
  });

  // Confidence is driven by how many real body fields the user provided.
  // Required fields differ by category so we don't penalize bottoms for missing chest.
  const required = isBottom
    ? ["height", "waist", "hip", "inseam"]
    : ["height", "shoulder", "chest", "waist"];
  const fieldsUsed = required.filter((f) => body.providedFields.includes(f));
  const ratio = fieldsUsed.length / required.length;
  const confidence: FitConfidence =
    ratio >= 0.9 ? "high" : ratio >= 0.5 ? "medium" : "low";
  const approximation = ratio < 1;

  return {
    overallScore,
    fitType,
    silhouette: fit.silhouetteType,
    recommendation,
    regions: {
      chest:    { delta: fit.chestEase,        fit: chestFit },
      waist:    { delta: fit.waistEase,        fit: waistFit },
      shoulder: { delta: fit.shoulderDrop,     fit: shoulderFit },
      length:   { delta: fit.bodyLengthDelta,  fit: lengthFit },
      sleeve:   { delta: fit.sleeveVolume,     fit: sleeveFit },
    },
    summary,
    visualPromptHints: hints,
    confidence,
    approximation,
    fieldsUsed,
  };
}

// ── Summary text ──────────────────────────────────────────────────────────

function buildSummary(args: {
  size: string; fitType: FitTypeLabel;
  chestFit: RegionFit; waistFit: WaistFit;
  shoulderFit: ShoulderFit; lengthFit: LengthFit; sleeveFit: SleeveFit;
  isBottom: boolean;
}): string {
  const { size, fitType, chestFit, waistFit, shoulderFit, lengthFit, sleeveFit, isBottom } = args;
  const verb = fitType === "trim" ? "creates a trimmer line"
    : fitType === "relaxed" ? "adds visible room"
    : fitType === "oversized" ? "reads clearly oversized"
    : "balances proportions";

  const detailParts: string[] = [];
  if (!isBottom) {
    if (chestFit === "snug" || chestFit === "balanced") detailParts.push(`a ${chestFit === "snug" ? "closer" : "natural"} chest line`);
    if (chestFit === "roomy" || chestFit === "oversized") detailParts.push(`${chestFit === "oversized" ? "generous" : "visible"} chest room`);
  }
  if (waistFit === "clean" || waistFit === "balanced") detailParts.push(`a ${waistFit === "clean" ? "clean" : "natural"} waist line`);
  if (waistFit === "relaxed" || waistFit === "loose") detailParts.push(`a ${waistFit === "loose" ? "loose" : "softer"} waist line`);
  if (!isBottom && (shoulderFit === "dropped")) detailParts.push("a dropped shoulder line");
  if (!isBottom && shoulderFit === "structured") detailParts.push("structured shoulders");
  if (lengthFit === "slightly_short" || lengthFit === "short") detailParts.push("a shorter body");
  if (lengthFit === "slightly_long" || lengthFit === "long") detailParts.push("a longer hem");
  if (!isBottom && sleeveFit === "loose") detailParts.push("looser sleeves");
  if (!isBottom && sleeveFit === "tight") detailParts.push("tighter sleeves");

  const joined = detailParts.length === 0
    ? "with a balanced overall silhouette."
    : detailParts.length === 1
      ? `with ${detailParts[0]}.`
      : `with ${detailParts.slice(0, -1).join(", ")} and ${detailParts.slice(-1)}.`;

  return `Size ${size} ${verb} ${joined}`;
}

// ── Friendly UI labels ─────────────────────────────────────────────────────

export const FIT_TYPE_LABEL: Record<FitTypeLabel, string> = {
  trim: "Trim fit",
  regular: "Regular fit",
  relaxed: "Relaxed fit",
  oversized: "Oversized fit",
};

export const REGION_LABEL: {
  chest: Record<RegionFit, string>;
  waist: Record<WaistFit, string>;
  shoulder: Record<ShoulderFit, string>;
  length: Record<LengthFit, string>;
  sleeve: Record<SleeveFit, string>;
} = {
  chest:    { tight: "Tight", snug: "Snug", balanced: "Balanced", roomy: "Roomy", oversized: "Oversized" },
  waist:    { tight: "Tight", clean: "Clean", balanced: "Balanced", relaxed: "Relaxed", loose: "Loose" },
  shoulder: { pulled: "Pulled", structured: "Structured", natural: "Natural", dropped: "Dropped" },
  length:   { short: "Short", slightly_short: "Slightly short", regular: "Regular", slightly_long: "Slightly long", long: "Long" },
  sleeve:   { tight: "Tight", trim: "Trim", regular: "Regular", loose: "Loose" },
};
