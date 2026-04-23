// ─── BRAND CALIBRATION LAYER ────────────────────────────────────────────────
// Correction layer on top of the base sizing engine. Adjusts garment
// measurements (cm) per brand-specific real-world tendencies (e.g. Zara
// runs small, Nike runs large) AND optionally shifts the recommendation by
// one size when the chart is weak/borderline.
//
// HARD RULES (failsafes):
//   1. Adjustments are SMALL (≤ ±3 cm per region).
//   2. Brand bias NEVER jumps multiple sizes — only one neighbour, ever.
//   3. The bias-shift only applies when chart confidence is low/medium AND
//      the primary's overall fit is borderline. Strong measurement data wins.
//   4. Unknown brand → no-op (return chart untouched, no confidence bump).
//   5. Per-category overrides apply only when category matches.
//
// This is a CORRECTION layer, not a replacement. Final sizing =
//   body calculation + product data + brand adjustment.
//
// NOTE: Future extension — feed user feedback ("felt tight", "too big") into
// a per-brand learned offset stored in DB. Out of scope for this revision.

import type { SizingCategory } from "./types";
import type { GarmentChart, SizeMeasurements } from "./garmentChart";

export type FitBias = "runs_small" | "true_to_size" | "runs_large";

export interface BrandFitProfile {
  /** Canonical brand name (matched case-insensitively after trim). */
  brand: string;
  /** Adjustments in cm applied to the GARMENT side before comparison. */
  chestAdjustment?: number;
  waistAdjustment?: number;
  shoulderAdjustment?: number;
  hipAdjustment?: number;
  /** Overall directional tendency. Drives the optional ±1-size shift. */
  fitBias: FitBias;
  /** Optional category-specific overrides. Apply ONLY for that category. */
  categoryOverrides?: Partial<Record<SizingCategory, Partial<Omit<BrandFitProfile, "brand" | "categoryOverrides">>>>;
}

// Per-region cm cap — stops bad data turning into wild swings.
const MAX_ADJ_CM = 3;

const clampAdj = (n: number | undefined | null): number =>
  typeof n === "number" && isFinite(n) ? Math.max(-MAX_ADJ_CM, Math.min(MAX_ADJ_CM, n)) : 0;

// ─── BRAND PROFILE TABLE ────────────────────────────────────────────────────
// Real-world reputations. Conservative numbers — we'd rather under-correct
// than mislead. Add more as we collect feedback.
const BRAND_PROFILES: BrandFitProfile[] = [
  {
    brand: "Zara",
    chestAdjustment: -2,
    waistAdjustment: -2,
    shoulderAdjustment: -1,
    fitBias: "runs_small",
    categoryOverrides: {
      jacket: { shoulderAdjustment: -2 }, // Zara jackets: tighter shoulders
    },
  },
  {
    brand: "Nike",
    chestAdjustment: 2,
    waistAdjustment: 1,
    fitBias: "runs_large",
    categoryOverrides: {
      hoodie: { chestAdjustment: 3, waistAdjustment: 2 }, // Nike hoodies: oversized tendency
    },
  },
  { brand: "Adidas", chestAdjustment: 1, fitBias: "runs_large" },
  { brand: "Uniqlo", fitBias: "true_to_size" },
  { brand: "H&M", fitBias: "true_to_size" },
  { brand: "Muji", fitBias: "true_to_size" },
  { brand: "Cos", fitBias: "runs_large", chestAdjustment: 1 },
  { brand: "Mango", chestAdjustment: -1, waistAdjustment: -1, fitBias: "runs_small" },
  { brand: "Massimo Dutti", fitBias: "true_to_size" },
  { brand: "Asos", fitBias: "runs_large", chestAdjustment: 1 },
  { brand: "Gap", chestAdjustment: 1, fitBias: "runs_large" },
  { brand: "Levi's", fitBias: "true_to_size" },
  { brand: "Lululemon", chestAdjustment: -1, waistAdjustment: -1, fitBias: "runs_small" },
  { brand: "Supreme", chestAdjustment: 2, fitBias: "runs_large" },
  { brand: "Stussy", chestAdjustment: 2, fitBias: "runs_large" },
  { brand: "Champion", chestAdjustment: 2, fitBias: "runs_large" },
  { brand: "Carhartt", chestAdjustment: 2, waistAdjustment: 1, fitBias: "runs_large" },
  { brand: "Patagonia", fitBias: "true_to_size" },
  { brand: "The North Face", chestAdjustment: 1, fitBias: "runs_large" },
  // Korean brands (skewed slightly small vs western charts).
  { brand: "Musinsa", chestAdjustment: -1, fitBias: "runs_small" },
  { brand: "Ader Error", chestAdjustment: -1, fitBias: "runs_small" },
  { brand: "Mardi Mercredi", chestAdjustment: -1, waistAdjustment: -1, fitBias: "runs_small" },
];

const NORMALIZED_PROFILES: Map<string, BrandFitProfile> = new Map(
  BRAND_PROFILES.map((p) => [normalizeBrand(p.brand), p]),
);

function normalizeBrand(brand: string | null | undefined): string {
  return (brand || "").toLowerCase().replace(/[^a-z0-9]+/g, "").trim();
}

/** Look up a brand profile (case/punctuation-insensitive). Null if unknown. */
export function getBrandProfile(brand: string | null | undefined): BrandFitProfile | null {
  const key = normalizeBrand(brand);
  if (!key) return null;
  return NORMALIZED_PROFILES.get(key) ?? null;
}

/** Effective profile = base brand profile merged with the category override. */
function effectiveProfile(profile: BrandFitProfile, category: SizingCategory): {
  chest: number;
  waist: number;
  shoulder: number;
  hip: number;
  fitBias: FitBias;
} {
  const ov = profile.categoryOverrides?.[category];
  return {
    chest:    clampAdj(ov?.chestAdjustment    ?? profile.chestAdjustment),
    waist:    clampAdj(ov?.waistAdjustment    ?? profile.waistAdjustment),
    shoulder: clampAdj(ov?.shoulderAdjustment ?? profile.shoulderAdjustment),
    hip:      clampAdj(ov?.hipAdjustment      ?? profile.hipAdjustment),
    fitBias:  ov?.fitBias ?? profile.fitBias,
  };
}

export interface CalibrationApplied {
  brand: string;
  fitBias: FitBias;
  /** Resolved adjustments after category override + clamping (cm). */
  adjustments: { chest: number; waist: number; shoulder: number; hip: number };
  /** True if any adjustment was non-zero (so we actually changed the chart). */
  modifiedChart: boolean;
}

/**
 * Apply brand calibration to a GarmentChart in-place-style (returns a new
 * chart). Adjusts only existing measurement values — never invents new ones.
 * Unknown brand → returns chart untouched and `applied = null`.
 */
export function applyBrandCalibration(
  chart: GarmentChart,
  brand: string | null | undefined,
): { chart: GarmentChart; applied: CalibrationApplied | null } {
  const profile = getBrandProfile(brand);
  if (!profile) return { chart, applied: null };

  const eff = effectiveProfile(profile, chart.category);
  const anyAdj =
    eff.chest !== 0 || eff.waist !== 0 || eff.shoulder !== 0 || eff.hip !== 0;

  // Even when fitBias has no cm adjustments (true_to_size), we still report
  // back so the UI can show "calibrated for {brand}" and confidence can bump.
  if (!anyAdj) {
    return {
      chart,
      applied: {
        brand: profile.brand,
        fitBias: eff.fitBias,
        adjustments: { chest: 0, waist: 0, shoulder: 0, hip: 0 },
        modifiedChart: false,
      },
    };
  }

  const next: Record<string, SizeMeasurements> = {};
  for (const [label, m] of Object.entries(chart.sizes)) {
    next[label] = {
      ...m,
      // Only mutate values that actually exist — never fabricate.
      chest:    typeof m.chest    === "number" ? round1(m.chest    + eff.chest)    : m.chest,
      waist:    typeof m.waist    === "number" ? round1(m.waist    + eff.waist)    : m.waist,
      shoulder: typeof m.shoulder === "number" ? round1(m.shoulder + eff.shoulder) : m.shoulder,
      hip:      typeof m.hip      === "number" ? round1(m.hip      + eff.hip)      : m.hip,
    };
  }

  return {
    chart: { ...chart, sizes: next },
    applied: {
      brand: profile.brand,
      fitBias: eff.fitBias,
      adjustments: eff,
      modifiedChart: true,
    },
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
