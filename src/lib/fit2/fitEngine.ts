// ─── Module C — FitEngine ────────────────────────────────────────────────────
// Compares user body to garment measurements, region by region, and produces
// FitComputationResult. Deterministic, measurement-driven, no AI guessing.

import type {
  FitComputationResult,
  FitLabel,
  FitRegionResult,
  GarmentMeasurementProfile,
  UserBodyProfile,
  Confidence,
} from "./types";
import { isBottom } from "./garmentParser";

// Each region has its own "ease" expectation — i.e. how much extra room
// beyond the body the garment should provide for an "ideal" fit. Stretch
// factor reduces effective tightness.
interface RegionSpec {
  bodyCm: (b: UserBodyProfile) => number | null;
  garmentCm: (g: GarmentMeasurementProfile) => number | null;
  idealEase: number;
  // ±cm tolerance band around ideal that still counts as "ideal"
  tolerance: number;
  // delta thresholds for labels
  tightAt: number;     // delta < this → tight (or below this → too short for length-y regions)
  closeAt: number;
  relaxedAt: number;
  oversizedAt: number;
  isLengthRegion?: boolean;
}

const REGION_SPECS: Record<FitRegionResult["region"], RegionSpec> = {
  shoulder: { bodyCm: b => b.shoulderCm, garmentCm: g => g.shoulderCm, idealEase: 1,  tolerance: 1.5, tightAt: -1, closeAt: 0, relaxedAt: 4,  oversizedAt: 7 },
  chest:    { bodyCm: b => b.chestCm,    garmentCm: g => g.chestCm,    idealEase: 6,  tolerance: 3,   tightAt: 0,  closeAt: 3, relaxedAt: 12, oversizedAt: 18 },
  waist:    { bodyCm: b => b.waistCm,    garmentCm: g => g.waistCm,    idealEase: 4,  tolerance: 3,   tightAt: -1, closeAt: 1, relaxedAt: 10, oversizedAt: 16 },
  hip:      { bodyCm: b => b.hipCm,      garmentCm: g => g.hipCm,      idealEase: 4,  tolerance: 3,   tightAt: -1, closeAt: 1, relaxedAt: 10, oversizedAt: 16 },
  sleeve:   { bodyCm: b => b.armLengthCm,garmentCm: g => g.sleeveCm,   idealEase: 0,  tolerance: 2,   tightAt: -3, closeAt: -1,relaxedAt: 2,  oversizedAt: 4,  isLengthRegion: true },
  length:   { bodyCm: b => Math.round(b.heightCm * 0.40), garmentCm: g => g.totalLengthCm, idealEase: 0, tolerance: 3, tightAt: -5, closeAt: -2, relaxedAt: 3, oversizedAt: 6, isLengthRegion: true },
  thigh:    { bodyCm: b => Math.round((b.hipCm * 0.6 + b.waistCm * 0.05)), garmentCm: g => g.thighCm, idealEase: 4, tolerance: 2.5, tightAt: 0, closeAt: 2, relaxedAt: 8, oversizedAt: 12 },
  inseam:   { bodyCm: b => b.inseamCm,   garmentCm: g => g.inseamCm,   idealEase: 0,  tolerance: 2,   tightAt: -4, closeAt: -2,relaxedAt: 2,  oversizedAt: 4,  isLengthRegion: true },
  rise:     { bodyCm: () => 27,          garmentCm: g => g.riseCm,     idealEase: 0,  tolerance: 1.5, tightAt: -2, closeAt: -1,relaxedAt: 2,  oversizedAt: 4,  isLengthRegion: true },
};

const REGIONS_TOP: Array<FitRegionResult["region"]> = ["shoulder", "chest", "waist", "sleeve", "length"];
const REGIONS_BOTTOM: Array<FitRegionResult["region"]> = ["waist", "hip", "thigh", "inseam", "rise"];

function classify(spec: RegionSpec, deltaWithoutEase: number, stretch: number): FitLabel {
  // For length-style regions, "delta" is garment length - expected length.
  if (spec.isLengthRegion) {
    if (deltaWithoutEase <= spec.tightAt) return "too-short";
    if (deltaWithoutEase <= spec.closeAt) return "slightly-short";
    if (Math.abs(deltaWithoutEase) <= spec.tolerance) return "ideal";
    if (deltaWithoutEase >= spec.oversizedAt) return "too-long";
    if (deltaWithoutEase >= spec.relaxedAt) return "slightly-long";
    return "ideal";
  }
  // For girth regions: ease beyond body. Stretch effectively lets us subtract
  // a few cm from a tight reading.
  const stretchBuffer = stretch * 4; // up to ~4cm of forgiveness for full stretch
  const adj = deltaWithoutEase - spec.idealEase;
  const cushioned = adj < 0 ? Math.min(0, adj + stretchBuffer) : adj;
  if (cushioned <= spec.tightAt) return "tight";
  if (cushioned <= spec.closeAt) return "close";
  if (Math.abs(cushioned) <= spec.tolerance) return "ideal";
  if (cushioned >= spec.oversizedAt) return "oversized";
  if (cushioned >= spec.relaxedAt) return "relaxed";
  return "ideal";
}

const VISUAL_EFFECT_BY_LABEL: Record<FitLabel, Record<string, string>> = {
  tight:           { shoulder: "garment narrows over the shoulder line", chest: "fabric pulls across the chest", waist: "waistband sits snug", hip: "hip line shows tension", thigh: "thigh hugs the leg" },
  close:           { shoulder: "shoulder seam sits clean and close", chest: "garment lays close against the chest", waist: "waist follows the body line", hip: "hip line is neat and close", thigh: "thigh is close-cut" },
  ideal:           { shoulder: "shoulder seam falls naturally on the shoulder", chest: "chest has a natural amount of room", waist: "waist drapes comfortably", hip: "hip area sits balanced", thigh: "thigh has clean ease", sleeve: "sleeve ends right at the wrist", length: "hem hits at the natural point", inseam: "inseam ends right at the ankle", rise: "rise sits right" },
  relaxed:         { shoulder: "shoulder seam drops a little past the shoulder", chest: "chest has gentle volume", waist: "waist has noticeable ease", hip: "hip sits relaxed", thigh: "thigh is relaxed-cut", length: "hem sits a little long", sleeve: "sleeve covers the wrist slightly", inseam: "inseam stacks slightly at the shoe" },
  oversized:       { shoulder: "shoulder visibly drops beyond the natural line", chest: "chest is visibly oversized and boxy", waist: "waist has bold drape", hip: "hip is loose and flowing", thigh: "thigh is wide-leg", length: "hem hangs long", sleeve: "sleeve clearly extends past the hand", inseam: "inseam stacks heavily" },
  "slightly-short":{ sleeve: "sleeve ends just above the wrist", length: "hem hits a touch above the natural point", inseam: "inseam ends slightly above the ankle (cropped)", rise: "rise sits a little low" },
  "too-short":     { sleeve: "sleeve is clearly too short — wrist exposed", length: "hem is noticeably cropped", inseam: "inseam is clearly cropped", rise: "rise is too low" },
  "slightly-long": { sleeve: "sleeve covers part of the hand", length: "hem hangs slightly long", inseam: "inseam covers the shoe top", rise: "rise sits a touch high" },
  "too-long":      { sleeve: "sleeve completely covers the hand", length: "hem hangs significantly past the natural point", inseam: "inseam pools heavily over the shoe", rise: "rise sits very high" },
  "n/a":           {},
};

function visualEffect(region: FitRegionResult["region"], label: FitLabel): string {
  return VISUAL_EFFECT_BY_LABEL[label]?.[region] ?? `${region} fits ${label}`;
}

const LABEL_SCORE: Record<FitLabel, number> = {
  ideal: 100, close: 88, relaxed: 78, "slightly-long": 78, "slightly-short": 70,
  oversized: 60, tight: 55, "too-long": 45, "too-short": 40, "n/a": 75,
};

export function computeFitV2(
  body: UserBodyProfile,
  garment: GarmentMeasurementProfile,
): FitComputationResult {
  const regionList = isBottom(garment.category) ? REGIONS_BOTTOM : REGIONS_TOP;
  const regions: FitRegionResult[] = regionList.map((r) => {
    const spec = REGION_SPECS[r];
    const bodyCm = spec.bodyCm(body);
    const garmentCm = spec.garmentCm(garment);
    if (bodyCm == null || garmentCm == null) {
      return { region: r, garmentCm, bodyCm, deltaCm: null, label: "n/a", visualEffect: "" };
    }
    const delta = +(garmentCm - bodyCm).toFixed(1);
    const label = classify(spec, delta, garment.stretchFactor);
    return {
      region: r,
      bodyCm,
      garmentCm,
      deltaCm: delta,
      label,
      visualEffect: visualEffect(r, label),
    };
  });

  const scored = regions.filter(r => r.label !== "n/a");
  const overallScore = scored.length
    ? Math.round(scored.reduce((a, r) => a + LABEL_SCORE[r.label], 0) / scored.length)
    : 70;

  const labels = new Set(scored.map(r => r.label));
  const overallFit: FitComputationResult["overallFit"] =
    labels.has("oversized") && !labels.has("tight") ? "oversized"
    : labels.has("tight") || labels.has("too-short") ? "tight"
    : labels.has("relaxed") || labels.has("slightly-long") ? "relaxed"
    : labels.size === 1 && labels.has("ideal") ? "ideal"
    : labels.has("ideal") ? "ideal"
    : "mixed";

  const confidence: Confidence =
    garment.confidence === "high" ? "high"
    : garment.confidence === "medium" ? "medium"
    : "low";

  const summary = buildSummary(regions, overallFit, garment.sizeLabel);

  return {
    overallFit,
    overallScore,
    confidence,
    selectedSize: garment.sizeLabel,
    regions,
    summary,
    approximationUsed: garment.source === "estimator",
    garmentSource: garment.source,
  };
}

function buildSummary(regions: FitRegionResult[], overall: FitComputationResult["overallFit"], size: string): string {
  const notable = regions.filter(r => r.label !== "ideal" && r.label !== "n/a").slice(0, 2);
  if (overall === "ideal" || notable.length === 0) {
    return `Size ${size} fits true to your measurements across all regions.`;
  }
  const phrases = notable.map(r => `${r.region} runs ${r.label.replace("-", " ")}`);
  return `Size ${size} ${overall === "tight" ? "is on the tight side" : overall === "relaxed" ? "wears relaxed" : overall === "oversized" ? "wears oversized" : "has a mixed fit"} — ${phrases.join(", ")}.`;
}

/** Pick the best size from a list of garment profiles. */
export function recommendSize(
  body: UserBodyProfile,
  garments: GarmentMeasurementProfile[],
): { recommended: FitComputationResult; all: FitComputationResult[] } {
  const all = garments.map(g => computeFitV2(body, g));
  const sorted = [...all].sort((a, b) => b.overallScore - a.overallScore);
  return { recommended: sorted[0], all };
}
