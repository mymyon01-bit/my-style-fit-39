// ─── BRAND CALIBRATION LAYER ────────────────────────────────────────────────
// Loads admin-curated brand_fit_profiles + community fit_feedback aggregates
// and produces a per-region cm offset to apply on top of the garment chart.
//
// Hard rules (per spec [9] + [13]):
//   • Adjustments shift garment numbers ONLY — never the body.
//   • Per-region cap of ±5cm to prevent runaway noise from tipping a chart.
//   • Learning loop requires ≥5 feedback rows before it can move a number.
//
// This module is read-only against the DB and safe to call from the client.

import { supabase } from "@/integrations/supabase/client";
import type { Region, SizingCategory } from "./types";

export interface CalibrationOffset {
  /** cm to ADD to the garment chart for this region. Can be negative. */
  shoulder: number;
  chest: number;
  waist: number;
  hip: number;
  inseam: number;
  /** Source breakdown so the UI can be honest about what was applied. */
  sources: {
    brandRule: boolean;
    communityFeedback: boolean;
    feedbackSampleSize: number;
  };
}

const ZERO: CalibrationOffset = {
  shoulder: 0, chest: 0, waist: 0, hip: 0, inseam: 0,
  sources: { brandRule: false, communityFeedback: false, feedbackSampleSize: 0 },
};

const MAX_ADJ_CM = 5;          // spec rule: per-region max ±5cm
const MIN_FEEDBACK_SAMPLES = 5; // spec rule: min 5 data points before learning fires

function clampAdj(v: number): number {
  if (!isFinite(v)) return 0;
  return Math.max(-MAX_ADJ_CM, Math.min(MAX_ADJ_CM, v));
}

/** Normalize a brand string into the lookup key used in brand_fit_profiles. */
function normBrand(b: string | null | undefined): string | null {
  const v = (b || "").trim().toLowerCase();
  return v || null;
}

interface BrandRow {
  brand: string;
  chest_adjustment_cm: number;
  waist_adjustment_cm: number;
  hip_adjustment_cm: number;
  shoulder_adjustment_cm: number;
  inseam_adjustment_cm: number;
  length_adjustment_cm: number;
  fit_bias: string;
  category_overrides: any;
  is_active: boolean;
}

/** Fetch the active calibration row for this brand. */
async function loadBrandRule(brand: string | null): Promise<BrandRow | null> {
  if (!brand) return null;
  try {
    const { data } = await supabase
      .from("brand_fit_profiles")
      .select("brand, chest_adjustment_cm, waist_adjustment_cm, hip_adjustment_cm, shoulder_adjustment_cm, inseam_adjustment_cm, length_adjustment_cm, fit_bias, category_overrides, is_active")
      .ilike("brand", brand)
      .eq("is_active", true)
      .maybeSingle();
    return (data as BrandRow | null) ?? null;
  } catch (e) {
    console.warn("[sizing/calibration] brand rule fetch failed", e);
    return null;
  }
}

interface FeedbackRow {
  feedback_type: string;
  feedback_areas: string[] | null;
}

/**
 * Aggregate community feedback for this brand × category. Each "too_small"
 * row pushes the offset POSITIVE (need more room), each "too_large" pushes
 * NEGATIVE. "perfect" votes pull toward zero. Per-area flags drive per-region
 * offsets so a brand that runs tight in the chest doesn't also widen the hip.
 */
async function loadFeedbackOffset(
  brand: string | null,
  category: SizingCategory | null,
): Promise<{ offset: Partial<Record<Region, number>>; samples: number }> {
  if (!brand) return { offset: {}, samples: 0 };
  try {
    const q = supabase
      .from("fit_feedback")
      .select("feedback_type, feedback_areas")
      .ilike("brand", brand)
      .limit(500);
    if (category) q.eq("category", category);
    const { data } = await q;
    const rows = (data as FeedbackRow[] | null) ?? [];
    if (rows.length < MIN_FEEDBACK_SAMPLES) return { offset: {}, samples: rows.length };

    // Count overall direction + per-area direction.
    const REGIONS: Region[] = ["shoulder", "chest", "waist", "hip", "inseam"];
    const overall: Record<string, number> = { too_small: 0, perfect: 0, too_large: 0 };
    const perRegion: Record<Region, { tight: number; loose: number }> = {
      shoulder: { tight: 0, loose: 0 },
      chest:    { tight: 0, loose: 0 },
      waist:    { tight: 0, loose: 0 },
      hip:      { tight: 0, loose: 0 },
      thigh:    { tight: 0, loose: 0 },
      sleeve:   { tight: 0, loose: 0 },
      length:   { tight: 0, loose: 0 },
      inseam:   { tight: 0, loose: 0 },
    };

    for (const r of rows) {
      const t = (r.feedback_type || "").toLowerCase();
      if (t in overall) overall[t]++;
      const areas = Array.isArray(r.feedback_areas) ? r.feedback_areas : [];
      for (const a of areas) {
        const region = a.toLowerCase() as Region;
        if (region in perRegion) {
          if (t === "too_small") perRegion[region].tight++;
          else if (t === "too_large") perRegion[region].loose++;
        }
      }
    }

    // Convert votes → cm offset. Each net vote moves by ~0.4cm; cap at ±5cm.
    const PER_VOTE_CM = 0.4;
    const offset: Partial<Record<Region, number>> = {};
    for (const region of REGIONS) {
      const net = perRegion[region].tight - perRegion[region].loose;
      if (net !== 0) offset[region] = clampAdj(net * PER_VOTE_CM);
    }
    // If no per-area signal but the overall votes are lopsided, apply a
    // gentle whole-garment shift on chest+waist (the dominant regions).
    const overallNet = overall.too_small - overall.too_large;
    if (Object.keys(offset).length === 0 && Math.abs(overallNet) >= 2) {
      const shift = clampAdj(overallNet * PER_VOTE_CM * 0.6);
      offset.chest = shift;
      offset.waist = shift;
    }

    return { offset, samples: rows.length };
  } catch (e) {
    console.warn("[sizing/calibration] feedback fetch failed", e);
    return { offset: {}, samples: 0 };
  }
}

/**
 * Resolve the final calibration offset = admin brand rule + community feedback.
 * Per-region caps applied after summing so the combined adjustment stays within
 * ±5cm, in line with the spec's "small shifts only" rule.
 */
export async function loadBrandCalibration(args: {
  brand: string | null | undefined;
  category: SizingCategory;
}): Promise<CalibrationOffset> {
  const brand = normBrand(args.brand);
  if (!brand) return ZERO;

  const [rule, feedback] = await Promise.all([
    loadBrandRule(brand),
    loadFeedbackOffset(brand, args.category),
  ]);

  // Pick category-specific override from the brand rule if present.
  const cat = args.category;
  let ruleOffsets = {
    chest:    rule?.chest_adjustment_cm ?? 0,
    waist:    rule?.waist_adjustment_cm ?? 0,
    hip:      rule?.hip_adjustment_cm ?? 0,
    shoulder: rule?.shoulder_adjustment_cm ?? 0,
    inseam:   rule?.inseam_adjustment_cm ?? 0,
  };
  const overrides = (rule?.category_overrides as Record<string, any> | null | undefined)?.[cat];
  if (overrides && typeof overrides === "object") {
    ruleOffsets = {
      chest:    Number(overrides.chest_adjustment_cm    ?? ruleOffsets.chest)    || ruleOffsets.chest,
      waist:    Number(overrides.waist_adjustment_cm    ?? ruleOffsets.waist)    || ruleOffsets.waist,
      hip:      Number(overrides.hip_adjustment_cm      ?? ruleOffsets.hip)      || ruleOffsets.hip,
      shoulder: Number(overrides.shoulder_adjustment_cm ?? ruleOffsets.shoulder) || ruleOffsets.shoulder,
      inseam:   Number(overrides.inseam_adjustment_cm   ?? ruleOffsets.inseam)   || ruleOffsets.inseam,
    };
  }

  const fb = feedback.offset;
  const out: CalibrationOffset = {
    shoulder: clampAdj(ruleOffsets.shoulder + (fb.shoulder ?? 0)),
    chest:    clampAdj(ruleOffsets.chest    + (fb.chest    ?? 0)),
    waist:    clampAdj(ruleOffsets.waist    + (fb.waist    ?? 0)),
    hip:      clampAdj(ruleOffsets.hip      + (fb.hip      ?? 0)),
    inseam:   clampAdj(ruleOffsets.inseam   + (fb.inseam   ?? 0)),
    sources: {
      brandRule: !!rule,
      communityFeedback: feedback.samples >= MIN_FEEDBACK_SAMPLES,
      feedbackSampleSize: feedback.samples,
    },
  };
  return out;
}

/** Apply the calibration offset to a measurements object (immutable). */
export function applyCalibration<T extends Partial<Record<Region, number>>>(
  measurements: T,
  offset: CalibrationOffset,
): T {
  const next = { ...measurements } as any;
  const map: Array<[Region, number]> = [
    ["shoulder", offset.shoulder],
    ["chest",    offset.chest],
    ["waist",    offset.waist],
    ["hip",      offset.hip],
    ["inseam",   offset.inseam],
  ];
  for (const [region, delta] of map) {
    if (delta === 0) continue;
    const cur = next[region];
    if (typeof cur === "number" && isFinite(cur)) {
      next[region] = Math.round((cur + delta) * 10) / 10;
    }
  }
  return next as T;
}
