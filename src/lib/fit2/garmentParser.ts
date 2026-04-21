// ─── Module B — GarmentMeasurementParser ─────────────────────────────────────
// Pure deterministic estimator for when we don't (yet) have real merchant data.
// Per-category baselines: each clothing category has its OWN size table.
//
// The async AI extractor (edge function `garment-extract-measurements`) will
// upgrade these to real merchant numbers in the background; the rest of the
// pipeline doesn't care which source produced the values — only `confidence`
// and `source` change.

import type {
  GarmentCategoryV2,
  GarmentMeasurementProfile,
  PreferredFit,
} from "./types";

export interface RawGarmentInput {
  title: string;
  brand: string;
  category: string; // raw category from product_cache
  productImageUrl: string | null;
  sourceUrl: string | null;
  fitType?: string | null;
}

export const SIZE_LABELS_TOP = ["XS", "S", "M", "L", "XL", "XXL"];
export const SIZE_LABELS_BOTTOM = ["28", "30", "32", "34", "36", "38"];

export function normalizeCategory(raw: string): GarmentCategoryV2 {
  const l = (raw || "").toLowerCase();
  if (l.includes("dress")) return "dress";
  if (l.includes("skirt")) return "skirt";
  if (l.includes("jean")) return "jeans";
  if (l.includes("pant") || l.includes("trouser") || l.includes("short")) return "pants";
  if (l.includes("hood")) return "hoodie";
  if (l.includes("coat") || l.includes("parka")) return "coat";
  if (l.includes("jacket") || l.includes("blazer") || l.includes("bomber")) return "jacket";
  if (l.includes("shirt") || l.includes("blouse")) return "shirt";
  return "top";
}

export function isBottom(c: GarmentCategoryV2): boolean {
  return c === "pants" || c === "jeans" || c === "skirt";
}

export function defaultSizeLabels(c: GarmentCategoryV2): string[] {
  return isBottom(c) ? SIZE_LABELS_BOTTOM : SIZE_LABELS_TOP;
}

const FIT_OFFSET: Record<PreferredFit, number> = { slim: 0, regular: 4, relaxed: 8, oversized: 14 };

function normalizeFitType(raw?: string | null): PreferredFit {
  const l = (raw || "regular").toLowerCase();
  if (l.includes("slim") || l.includes("fitted")) return "slim";
  if (l.includes("relax")) return "relaxed";
  if (l.includes("over")) return "oversized";
  return "regular";
}

// ──────────────────────────────────────────────────────────────────────────
// Per-category size tables. Numbers are baseline torso/leg measurements for
// the median of each size; offset added based on fit type.
// ──────────────────────────────────────────────────────────────────────────

interface BaselineTopRow { shoulder: number; chest: number; waist: number; sleeve: number; length: number }
interface BaselineBottomRow { waist: number; hip: number; thigh: number; inseam: number; rise: number; length: number }

const TOP_TABLE: Record<string, BaselineTopRow> = {
  XS: { shoulder: 41, chest: 90,  waist: 84,  sleeve: 59, length: 65 },
  S:  { shoulder: 43, chest: 96,  waist: 90,  sleeve: 61, length: 67 },
  M:  { shoulder: 45, chest: 102, waist: 96,  sleeve: 63, length: 69 },
  L:  { shoulder: 47, chest: 108, waist: 102, sleeve: 65, length: 71 },
  XL: { shoulder: 49, chest: 114, waist: 108, sleeve: 67, length: 73 },
  XXL:{ shoulder: 51, chest: 120, waist: 114, sleeve: 69, length: 75 },
};

const BOTTOM_TABLE: Record<string, BaselineBottomRow> = {
  "28": { waist: 74, hip: 92,  thigh: 54, inseam: 78, rise: 25, length: 100 },
  "30": { waist: 78, hip: 96,  thigh: 57, inseam: 79, rise: 26, length: 102 },
  "32": { waist: 82, hip: 100, thigh: 60, inseam: 80, rise: 27, length: 104 },
  "34": { waist: 86, hip: 104, thigh: 63, inseam: 81, rise: 28, length: 106 },
  "36": { waist: 90, hip: 108, thigh: 66, inseam: 82, rise: 29, length: 108 },
  "38": { waist: 94, hip: 112, thigh: 69, inseam: 83, rise: 30, length: 110 },
};

// Per-category modifiers — jackets/coats have wider shoulders, hoodies are
// boxier, dresses are longer, jeans are denser etc. Multipliers/additions to
// the baseline.
interface CategoryMod {
  shoulderAdd?: number;
  chestAdd?: number;
  lengthAdd?: number;
  sleeveAdd?: number;
  thighAdd?: number;
  inseamAdd?: number;
  stretch?: number;
}
const CATEGORY_MODS: Record<GarmentCategoryV2, CategoryMod> = {
  top:    { stretch: 0.15 },
  shirt:  { sleeveAdd: 1, stretch: 0.05 },
  jacket: { shoulderAdd: 2, chestAdd: 4, lengthAdd: 2, sleeveAdd: 2, stretch: 0.05 },
  coat:   { shoulderAdd: 3, chestAdd: 6, lengthAdd: 14, sleeveAdd: 3, stretch: 0.02 },
  hoodie: { shoulderAdd: 1, chestAdd: 4, lengthAdd: 1, stretch: 0.30 },
  pants:  { stretch: 0.10 },
  jeans:  { stretch: 0.03 },
  skirt:  { lengthAdd: -10, stretch: 0.05 },
  dress:  { lengthAdd: 30, stretch: 0.10 },
};

export function estimateGarmentMeasurements(
  input: RawGarmentInput,
): GarmentMeasurementProfile[] {
  const category = normalizeCategory(input.category);
  const fit = normalizeFitType(input.fitType);
  const offset = FIT_OFFSET[fit];
  const mod = CATEGORY_MODS[category];
  const sizes = defaultSizeLabels(category);

  return sizes.map<GarmentMeasurementProfile>((size) => {
    if (isBottom(category)) {
      const row = BOTTOM_TABLE[size];
      return {
        category,
        brand: input.brand,
        title: input.title,
        productImageUrl: input.productImageUrl,
        sourceUrl: input.sourceUrl,
        sizeLabel: size,
        shoulderCm: null,
        chestCm: null,
        waistCm: row.waist + offset,
        hipCm: row.hip + offset,
        sleeveCm: null,
        totalLengthCm: row.length + (mod.lengthAdd ?? 0),
        thighCm: row.thigh + (mod.thighAdd ?? 0) + offset / 2,
        inseamCm: row.inseam + (mod.inseamAdd ?? 0),
        riseCm: row.rise,
        stretchFactor: mod.stretch ?? 0.05,
        fitType: fit,
        source: "estimator",
        confidence: "low",
      };
    }
    const row = TOP_TABLE[size];
    return {
      category,
      brand: input.brand,
      title: input.title,
      productImageUrl: input.productImageUrl,
      sourceUrl: input.sourceUrl,
      sizeLabel: size,
      shoulderCm: row.shoulder + (mod.shoulderAdd ?? 0) + offset / 2,
      chestCm: row.chest + (mod.chestAdd ?? 0) + offset,
      waistCm: row.waist + offset,
      hipCm: null,
      sleeveCm: row.sleeve + (mod.sleeveAdd ?? 0),
      totalLengthCm: row.length + (mod.lengthAdd ?? 0),
      thighCm: null,
      inseamCm: null,
      riseCm: null,
      stretchFactor: mod.stretch ?? 0.05,
      fitType: fit,
      source: "estimator",
      confidence: "low",
    };
  });
}
