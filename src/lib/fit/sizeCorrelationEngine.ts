// ─── SIZE CORRELATION ENGINE — V3.8 ────────────────────────────────────────
// The numeric "will this size actually fit?" layer that sits between the
// measurement sizing engine (src/lib/sizing) and the visual try-on prompt.
//
// Pure / deterministic. Consumes per-size garment cm (already resolved by
// the sizing pipeline), body cm, GarmentDNA and an intendedFit/preference,
// and returns:
//   • per-size fit scores + labels
//   • recommended size + reason
//   • a focused analysis of the user's currently selected size
//   • generationDirectives (lines the visual prompt can drop in directly)
//
// Designed to layer on top of the existing engine without breaking it.

import type { GarmentDNA, IntendedFit, Level3 } from "./garmentDNA";

// ─── Types ─────────────────────────────────────────────────────────────────

export type CorrelationRegion =
  | "shoulder" | "chest" | "waist" | "hip" | "sleeve"
  | "torsoLength" | "upperArm" | "thigh" | "rise" | "inseam"
  | "legOpening" | "length";

export type CorrelationFitLabel =
  | "Best Fit" | "Good Fit" | "Tight Fit" | "Relaxed Fit"
  | "Oversized Fit" | "Risky Fit" | "Not Recommended";

export type WarningLevel = "none" | "info" | "caution" | "high";

export type MeasurementConfidenceLabel = "Exact size data" | "Estimated size data" | "Default size model";

export interface SizeMeasurementInput {
  size: string;
  /** Garment measurements in cm. Missing regions are skipped. */
  measurements: Partial<Record<CorrelationRegion, number | null>>;
  /** Where the numbers came from. */
  source: "exact" | "graded" | "categoryDefault" | "missing";
}

export interface BodyInput {
  gender?: "male" | "female" | "neutral" | null;
  heightCm?: number | null;
  weightKg?: number | null;
  shoulderCm?: number | null;
  chestCm?: number | null;
  waistCm?: number | null;
  hipCm?: number | null;
  sleeveCm?: number | null;
  inseamCm?: number | null;
  thighCm?: number | null;
  /** Estimated upper arm circumference. Optional. */
  upperArmCm?: number | null;
}

export interface RegionComparison {
  region: CorrelationRegion;
  bodyCm: number | null;
  garmentCm: number | null;
  /** garment − body. Negative = compressed; positive = ease. */
  deltaCm: number | null;
  /** Fabric/intent-adjusted classification. */
  fitClass:
    | "impossible" | "veryTight" | "tight" | "regular"
    | "relaxed" | "oversized" | "veryOversized" | "unknown";
  /** Visual instruction line for this region (empty string when balanced/unknown). */
  visualInstruction: string;
}

export interface SizeAnalysis {
  size: string;
  fitScore: number;            // 0–100
  fitLabel: CorrelationFitLabel;
  warningLevel: WarningLevel;
  regionComparisons: RegionComparison[];
  /** One-line numeric copy: "M is 3cm smaller than your chest…" */
  copy: string;
  /** Source confidence label for this size's chart row. */
  confidenceLabel: MeasurementConfidenceLabel;
}

export interface CorrelationResult {
  selectedSize: string;
  selectedAnalysis: SizeAnalysis;
  recommendedSize: string;
  recommendationReason: string;
  alternativeSizes: string[];
  allSizes: SizeAnalysis[];
  warningLevel: WarningLevel;
  /** Plain-English visual instructions for the AI prompt. */
  generationDirectives: string[];
  confidence: "high" | "medium" | "low";
  confidenceLabel: MeasurementConfidenceLabel;
}

export interface CorrelationInput {
  body: BodyInput;
  garmentDNA: GarmentDNA;
  sizes: SizeMeasurementInput[];
  selectedSize: string;
  preference?: IntendedFit;
}

// ─── Thresholds + modifiers ────────────────────────────────────────────────

interface ClassThresholds {
  impossible: number;   // delta below this → impossible
  veryTight: number;
  tight: number;
  regular: number;      // upper bound of "regular" delta
  relaxed: number;
  oversized: number;
  // anything beyond `oversized` is veryOversized
}

/** Base thresholds in cm — circumferential regions. */
const BASE_THRESHOLDS: ClassThresholds = {
  impossible: -8,
  veryTight: -4,
  tight: 0,
  regular: 4,
  relaxed: 8,
  oversized: 14,
};

function elasticityShift(level: Level3): number {
  // elastic fabric tolerates more compression — shift tight thresholds DOWN.
  if (level === "high") return -3;
  if (level === "medium") return -1;
  return 0;
}
function stiffnessShift(level: Level3): number {
  // stiff fabric needs more ease — shift regular/relaxed thresholds UP.
  if (level === "high") return 2;
  if (level === "medium") return 0;
  return -1;
}
function intentShift(intent: IntendedFit): number {
  // oversized garments expect bigger positive delta as "regular".
  if (intent === "oversized") return 6;
  if (intent === "relaxed") return 3;
  if (intent === "slim") return -2;
  return 0;
}

function thresholdsFor(dna: GarmentDNA, preference?: IntendedFit): ClassThresholds {
  const intent = preference ?? dna.intendedFit;
  const e = elasticityShift(dna.elasticity);
  const s = stiffnessShift(dna.stiffness);
  const i = intentShift(intent);
  return {
    impossible: BASE_THRESHOLDS.impossible + e,
    veryTight:  BASE_THRESHOLDS.veryTight + e,
    tight:      BASE_THRESHOLDS.tight + e,
    regular:    BASE_THRESHOLDS.regular + s + i,
    relaxed:    BASE_THRESHOLDS.relaxed + s + i,
    oversized:  BASE_THRESHOLDS.oversized + s + i,
  };
}

function classify(deltaCm: number, t: ClassThresholds): RegionComparison["fitClass"] {
  if (deltaCm < t.impossible) return "impossible";
  if (deltaCm < t.veryTight) return "veryTight";
  if (deltaCm < t.tight) return "tight";
  if (deltaCm <= t.regular) return "regular";
  if (deltaCm <= t.relaxed) return "relaxed";
  if (deltaCm <= t.oversized) return "oversized";
  return "veryOversized";
}

// ─── Body lookup ───────────────────────────────────────────────────────────

function bodyValue(body: BodyInput, region: CorrelationRegion): number | null {
  switch (region) {
    case "shoulder":    return body.shoulderCm ?? null;
    case "chest":       return body.chestCm ?? null;
    case "waist":       return body.waistCm ?? null;
    case "hip":         return body.hipCm ?? null;
    case "sleeve":      return body.sleeveCm ?? null;
    case "thigh":       return body.thighCm ?? null;
    case "inseam":      return body.inseamCm ?? null;
    case "upperArm":    return body.upperArmCm ?? null;
    case "torsoLength": return body.heightCm ? Math.round(body.heightCm * 0.32) : null;
    case "rise":        return body.heightCm ? Math.round(body.heightCm * 0.16) : null;
    case "legOpening":  return null; // garment-only — compared loosely
    case "length":      return null; // garment absolute — compared loosely
  }
}

// ─── Visual instructions per region/class ──────────────────────────────────

function visualInstruction(
  region: CorrelationRegion,
  cls: RegionComparison["fitClass"],
  dna: GarmentDNA,
): string {
  if (cls === "regular" || cls === "unknown") return "";

  const tightWord =
    dna.elasticity === "high"
      ? "snug body-hugging stretch"
      : dna.stiffness === "high"
      ? "sharp pulling tension creases"
      : "visible horizontal stretch lines";

  const looseWord =
    dna.drapeLevel === "high"
      ? "flowing folds and gravity-driven drape"
      : dna.stiffness === "high"
      ? "structured boxy volume"
      : "soft folds and relaxed drape";

  const map: Record<CorrelationRegion, { tight: string; loose: string }> = {
    shoulder:    { tight: `shoulder seam pulls inward and sits high on the natural shoulder`, loose: `shoulder seam drops past the natural shoulder line` },
    chest:       { tight: `chest shows ${tightWord} with fabric pulled across the bust`,       loose: `chest area shows extra room with ${looseWord}` },
    waist:       { tight: `waist compresses against the body with visible cinching`,           loose: `waist area shows ${looseWord} without changing body size` },
    hip:         { tight: `hips show fabric stretched tight around the seat`,                  loose: `hips show extra fabric ease and ${looseWord}` },
    sleeve:      { tight: `sleeve hem rides up the wrist, exposing skin`,                      loose: `sleeve stacks softly near the wrist` },
    upperArm:    { tight: `upper arm shows compression and fabric tension at the bicep`,       loose: `upper arm shows relaxed fabric without tension` },
    torsoLength: { tight: `hem rides up above the hipline`,                                    loose: `hem extends well below the hip` },
    thigh:       { tight: `thighs show ${tightWord} and fabric compression at the upper leg`,  loose: `thighs show ${looseWord}` },
    rise:        { tight: `rise pulls upward, sitting higher than intended`,                   loose: `rise sits lower with relaxed waistband drape` },
    inseam:      { tight: `pant leg ends above the ankle, exposing more skin`,                 loose: `pant leg stacks at the ankle with extra length` },
    legOpening:  { tight: `leg opening hugs the ankle tightly`,                                loose: `leg opening flares with extra volume` },
    length:      { tight: `garment length is short for your frame`,                            loose: `garment length is long and extends past the intended hemline` },
  };

  const entry = map[region];
  switch (cls) {
    case "impossible":   return `${entry.tight} — fabric is at structural limit`;
    case "veryTight":    return entry.tight;
    case "tight":        return entry.tight;
    case "relaxed":      return entry.loose;
    case "oversized":    return entry.loose;
    case "veryOversized":return `${entry.loose} — clearly oversized`;
  }
  return "";
}

// ─── Scoring ───────────────────────────────────────────────────────────────

const REGION_WEIGHTS: Partial<Record<CorrelationRegion, number>> = {
  shoulder: 0.22,
  chest:    0.24,
  waist:    0.18,
  hip:      0.12,
  sleeve:   0.08,
  upperArm: 0.06,
  thigh:    0.06,
  inseam:   0.06,
  torsoLength: 0.06,
  rise:     0.04,
  length:   0.04,
  legOpening: 0.02,
};

function classScore(cls: RegionComparison["fitClass"], intent: IntendedFit): number {
  // Score relative to user's intent. e.g. someone who wants "oversized" scores
  // an "oversized" region as PERFECT, not as a flaw.
  const base: Record<RegionComparison["fitClass"], number> = {
    impossible: 5, veryTight: 25, tight: 65, regular: 100,
    relaxed: 88, oversized: 70, veryOversized: 35, unknown: 70,
  };
  let s = base[cls];
  if (intent === "slim" && (cls === "tight" || cls === "regular")) s = Math.min(100, s + 8);
  if (intent === "oversized" && (cls === "oversized" || cls === "relaxed")) s = Math.min(100, s + 12);
  if (intent === "relaxed" && cls === "relaxed") s = Math.min(100, s + 6);
  return s;
}

function pickLabel(score: number, dominantClass: RegionComparison["fitClass"]): CorrelationFitLabel {
  if (dominantClass === "impossible") return "Not Recommended";
  if (score >= 90) return "Best Fit";
  if (score >= 80) return "Good Fit";
  if (dominantClass === "tight" || dominantClass === "veryTight") {
    return score >= 60 ? "Tight Fit" : "Risky Fit";
  }
  if (dominantClass === "oversized") return "Oversized Fit";
  if (dominantClass === "relaxed") return "Relaxed Fit";
  if (score >= 60) return "Good Fit";
  if (score >= 40) return "Risky Fit";
  return "Not Recommended";
}

function pickWarning(dominantClass: RegionComparison["fitClass"], score: number): WarningLevel {
  if (dominantClass === "impossible") return "high";
  if (dominantClass === "veryTight" && score < 55) return "high";
  if (dominantClass === "veryOversized" && score < 55) return "caution";
  if (score < 60) return "caution";
  if (score < 80) return "info";
  return "none";
}

function dominantClass(regions: RegionComparison[]): RegionComparison["fitClass"] {
  // Worst-case wins — heavy regions bias toward themselves.
  const order: RegionComparison["fitClass"][] = [
    "impossible", "veryTight", "veryOversized", "tight", "oversized", "relaxed", "regular", "unknown",
  ];
  for (const cls of order) {
    if (regions.some((r) => r.fitClass === cls && (REGION_WEIGHTS[r.region] ?? 0) >= 0.15)) return cls;
  }
  for (const cls of order) {
    if (regions.some((r) => r.fitClass === cls)) return cls;
  }
  return "unknown";
}

// ─── Copy ──────────────────────────────────────────────────────────────────

function summarizeNumbers(size: string, regions: RegionComparison[]): string {
  const named = regions
    .filter((r) => r.deltaCm != null && r.region !== "length" && r.region !== "legOpening")
    .sort((a, b) => Math.abs((b.deltaCm ?? 0)) - Math.abs((a.deltaCm ?? 0)))
    .slice(0, 2);
  if (named.length === 0) return `Size ${size} fit cannot be calculated from available data.`;
  const parts = named.map((r) => {
    const d = r.deltaCm!;
    const word = d >= 0 ? `${d.toFixed(1)} cm of ease at the ${r.region}` : `${Math.abs(d).toFixed(1)} cm tighter than your ${r.region}`;
    return word;
  });
  return `Size ${size} is ${parts.join(" and ")}.`;
}

function confidenceLabelFor(source: SizeMeasurementInput["source"]): MeasurementConfidenceLabel {
  if (source === "exact") return "Exact size data";
  if (source === "graded") return "Estimated size data";
  return "Default size model";
}

// ─── Main entry ────────────────────────────────────────────────────────────

export function computeSizeCorrelation(input: CorrelationInput): CorrelationResult {
  const { body, garmentDNA, sizes, selectedSize } = input;
  const intent: IntendedFit = input.preference ?? garmentDNA.intendedFit;
  const thresholds = thresholdsFor(garmentDNA, intent);

  const allSizes: SizeAnalysis[] = sizes.map((s) => analyzeSize(s, body, garmentDNA, intent, thresholds));

  // recommended = highest score among non-impossible.
  const ranked = [...allSizes].sort((a, b) => b.fitScore - a.fitScore);
  const recommended = ranked.find((a) => a.warningLevel !== "high") ?? ranked[0];
  const alternatives = ranked.filter((a) => a.size !== recommended.size).slice(0, 2).map((a) => a.size);

  const selected = allSizes.find((a) => a.size === selectedSize) ?? recommended;

  const directives = selected.regionComparisons
    .map((r) => r.visualInstruction)
    .filter((s) => !!s);

  const reason = buildReason(recommended, selected);

  // overall data confidence
  const exactCount = sizes.filter((s) => s.source === "exact").length;
  const overallConfidence: CorrelationResult["confidence"] =
    exactCount >= sizes.length * 0.8 ? "high" : exactCount > 0 ? "medium" : "low";
  const overallConfidenceLabel = confidenceLabelFor(
    exactCount === sizes.length ? "exact" : exactCount > 0 ? "graded" : "categoryDefault",
  );

  return {
    selectedSize: selected.size,
    selectedAnalysis: selected,
    recommendedSize: recommended.size,
    recommendationReason: reason,
    alternativeSizes: alternatives,
    allSizes,
    warningLevel: selected.warningLevel,
    generationDirectives: directives,
    confidence: overallConfidence,
    confidenceLabel: overallConfidenceLabel,
  };
}

function analyzeSize(
  size: SizeMeasurementInput,
  body: BodyInput,
  dna: GarmentDNA,
  intent: IntendedFit,
  thresholds: ClassThresholds,
): SizeAnalysis {
  const regions: RegionComparison[] = [];
  const allRegions: CorrelationRegion[] = Object.keys(size.measurements) as CorrelationRegion[];
  for (const region of allRegions) {
    const garmentCm = size.measurements[region] ?? null;
    const bodyCm = bodyValue(body, region);
    let deltaCm: number | null = null;
    let cls: RegionComparison["fitClass"] = "unknown";
    if (typeof garmentCm === "number" && typeof bodyCm === "number") {
      deltaCm = Math.round((garmentCm - bodyCm) * 10) / 10;
      cls = classify(deltaCm, thresholds);
    } else if (typeof garmentCm === "number") {
      cls = "regular";
    }
    regions.push({
      region,
      bodyCm: bodyCm ?? null,
      garmentCm: garmentCm ?? null,
      deltaCm,
      fitClass: cls,
      visualInstruction: visualInstruction(region, cls, dna),
    });
  }

  // weighted score
  let totalW = 0, weighted = 0;
  for (const r of regions) {
    const w = REGION_WEIGHTS[r.region] ?? 0.05;
    totalW += w;
    weighted += w * classScore(r.fitClass, intent);
  }
  const fitScore = totalW > 0 ? Math.round(weighted / totalW) : 60;
  const dom = dominantClass(regions);
  const fitLabel = pickLabel(fitScore, dom);
  const warningLevel = pickWarning(dom, fitScore);

  return {
    size: size.size,
    fitScore,
    fitLabel,
    warningLevel,
    regionComparisons: regions,
    copy: summarizeNumbers(size.size, regions),
    confidenceLabel: confidenceLabelFor(size.source),
  };
}

function buildReason(recommended: SizeAnalysis, selected: SizeAnalysis): string {
  if (recommended.size === selected.size) {
    return `Size ${recommended.size} matches your body best (${recommended.fitScore}/100). ${recommended.copy}`;
  }
  const tightOrLoose = selected.fitLabel.toLowerCase().includes("tight")
    ? "tighter than ideal" : selected.fitLabel.toLowerCase().includes("oversized")
    ? "more oversized than your typical fit" : "less balanced";
  return `Size ${selected.size} reads ${tightOrLoose} (${selected.fitScore}/100). Size ${recommended.size} would give you a better balance — ${recommended.copy}`;
}

// ─── Convenience adaptors ──────────────────────────────────────────────────

/**
 * Adapter from the existing sizing engine's `SizeOutcome[]` (region cm only
 * via the legacy chart) into the engine's `SizeMeasurementInput[]`. Callers
 * that already have a `GarmentChart` can use this to wire things up quickly.
 */
export function sizesFromGarmentChart(chart: {
  sizeOrder: string[];
  sizes: Record<string, Record<string, number | undefined>>;
  sources: Record<string, "exact" | "graded" | "categoryDefault" | "missing">;
}): SizeMeasurementInput[] {
  return chart.sizeOrder.map((size) => {
    const row = chart.sizes[size] ?? {};
    const measurements: SizeMeasurementInput["measurements"] = {};
    const map: Record<string, CorrelationRegion> = {
      shoulder: "shoulder", chest: "chest", waist: "waist", hip: "hip",
      sleeve: "sleeve", thigh: "thigh", inseam: "inseam", length: "length",
    };
    for (const [k, v] of Object.entries(row)) {
      const r = map[k];
      if (r && typeof v === "number") measurements[r] = v;
    }
    return { size, measurements, source: chart.sources[size] ?? "categoryDefault" };
  });
}
