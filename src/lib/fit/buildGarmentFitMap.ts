// ─── GARMENT FIT MAP ────────────────────────────────────────────────────────
// Compute relative fit coordinates (eases, drops, drape) for the selected
// garment + size + body profile. Output is unitless and drives prompts.

import type { BodyProfile } from "./buildBodyProfile";

export type GarmentCategory =
  | "top"
  | "outerwear"
  | "bottom"
  | "dress"
  | "fullbody"
  | "accessory";

export type SilhouetteType =
  | "trim"
  | "fitted"
  | "regular"
  | "relaxed"
  | "oversized";

export interface GarmentFitMap {
  category: GarmentCategory;
  size: string;
  chestEase: number;
  waistEase: number;
  hemEase: number;
  shoulderDrop: number;
  bodyLengthDelta: number;
  sleeveVolume: number;
  sleeveLengthDelta: number;
  drapeDepth: number;
  silhouetteType: SilhouetteType;
}

function categoryFromString(c?: string | null): GarmentCategory {
  const v = (c || "").toLowerCase();
  if (/(pant|jean|trouser|short|skirt|legging)/.test(v)) return "bottom";
  if (/(dress|gown)/.test(v)) return "dress";
  if (/(jumpsuit|overall|romper)/.test(v)) return "fullbody";
  if (/(jacket|coat|blazer|parka|trench|outer)/.test(v)) return "outerwear";
  if (/(hat|bag|belt|scarf|sock|sunglasses)/.test(v)) return "accessory";
  return "top";
}

// Base size table (M = 0). Values are relative — dimensionless.
const SIZE_BASE: Record<
  string,
  Pick<
    GarmentFitMap,
    | "chestEase"
    | "waistEase"
    | "hemEase"
    | "shoulderDrop"
    | "bodyLengthDelta"
    | "sleeveVolume"
    | "sleeveLengthDelta"
    | "drapeDepth"
    | "silhouetteType"
  >
> = {
  XS: {
    chestEase: 0.02, waistEase: 0.01, hemEase: 0.02, shoulderDrop: 0.0,
    bodyLengthDelta: -0.03, sleeveVolume: 0.02, sleeveLengthDelta: -0.02,
    drapeDepth: 0.02, silhouetteType: "trim",
  },
  S: {
    chestEase: 0.04, waistEase: 0.03, hemEase: 0.04, shoulderDrop: 0.01,
    bodyLengthDelta: -0.01, sleeveVolume: 0.03, sleeveLengthDelta: -0.01,
    drapeDepth: 0.03, silhouetteType: "fitted",
  },
  M: {
    chestEase: 0.07, waistEase: 0.06, hemEase: 0.07, shoulderDrop: 0.02,
    bodyLengthDelta: 0.0, sleeveVolume: 0.05, sleeveLengthDelta: 0.0,
    drapeDepth: 0.05, silhouetteType: "regular",
  },
  L: {
    chestEase: 0.11, waistEase: 0.09, hemEase: 0.11, shoulderDrop: 0.04,
    bodyLengthDelta: 0.03, sleeveVolume: 0.08, sleeveLengthDelta: 0.02,
    drapeDepth: 0.07, silhouetteType: "relaxed",
  },
  XL: {
    chestEase: 0.16, waistEase: 0.14, hemEase: 0.15, shoulderDrop: 0.06,
    bodyLengthDelta: 0.06, sleeveVolume: 0.12, sleeveLengthDelta: 0.04,
    drapeDepth: 0.1, silhouetteType: "oversized",
  },
  XXL: {
    chestEase: 0.2, waistEase: 0.18, hemEase: 0.18, shoulderDrop: 0.08,
    bodyLengthDelta: 0.09, sleeveVolume: 0.15, sleeveLengthDelta: 0.06,
    drapeDepth: 0.12, silhouetteType: "oversized",
  },
};

// Brand fit_type bias — applied as additive eases.
function fitTypeBias(fitType?: string | null): Partial<GarmentFitMap> {
  const v = (fitType || "").toLowerCase();
  if (/slim|skinny|fitted/.test(v)) {
    return { chestEase: -0.02, waistEase: -0.02, silhouetteType: "fitted" };
  }
  if (/relax|loose|baggy/.test(v)) {
    return { chestEase: 0.03, waistEase: 0.03, silhouetteType: "relaxed" };
  }
  if (/oversize|over-size/.test(v)) {
    return {
      chestEase: 0.05, waistEase: 0.05, shoulderDrop: 0.02, sleeveVolume: 0.04,
      silhouetteType: "oversized",
    };
  }
  return {};
}

// Body bias — broader shoulders consume some chest ease, fuller waist tightens.
function bodyBias(body: BodyProfile, base: GarmentFitMap): Partial<GarmentFitMap> {
  const out: Partial<GarmentFitMap> = {};
  const shoulderExtra = body.shoulderRatio - 1;
  const waistExtra = body.waistRatio - 1;
  out.chestEase = Math.max(-0.02, base.chestEase - shoulderExtra * 0.6);
  out.waistEase = Math.max(-0.02, base.waistEase - waistExtra * 0.5);
  out.shoulderDrop = Math.max(0, base.shoulderDrop - Math.max(0, shoulderExtra) * 0.5);
  return out;
}

export function buildGarmentFitMap(args: {
  category?: string | null;
  selectedSize: string;
  fitType?: string | null;
  body: BodyProfile;
}): GarmentFitMap {
  const cat = categoryFromString(args.category);
  const sizeKey = (args.selectedSize || "M").toUpperCase();
  const base = SIZE_BASE[sizeKey] ?? SIZE_BASE.M;

  const initial: GarmentFitMap = {
    category: cat,
    size: sizeKey,
    ...base,
  };

  const withFit = { ...initial, ...fitTypeBias(args.fitType) } as GarmentFitMap;
  const final = { ...withFit, ...bodyBias(args.body, withFit) } as GarmentFitMap;

  // Bottoms don't have sleeves — clamp.
  if (final.category === "bottom") {
    final.sleeveVolume = 0;
    final.sleeveLengthDelta = 0;
    final.shoulderDrop = 0;
  }
  // Round to keep the prompt clean.
  const r2 = (n: number) => Math.round(n * 100) / 100;
  return {
    ...final,
    chestEase: r2(final.chestEase),
    waistEase: r2(final.waistEase),
    hemEase: r2(final.hemEase),
    shoulderDrop: r2(final.shoulderDrop),
    bodyLengthDelta: r2(final.bodyLengthDelta),
    sleeveVolume: r2(final.sleeveVolume),
    sleeveLengthDelta: r2(final.sleeveLengthDelta),
    drapeDepth: r2(final.drapeDepth),
  };
}
