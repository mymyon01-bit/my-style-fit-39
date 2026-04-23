// ─── CATEGORY-AWARE FIT RULES ───────────────────────────────────────────────
// Per-category ease (extra cm beyond body), region weights, region thresholds
// and category-default chart used when no scraped chart exists.
//
// Ease is the wearer's required slack. A perfect "regular" t-shirt at 96cm
// chest body should measure 96 + ease.regular.chest in the garment chest
// (pit-to-pit × 2). Less ease → tighter than intended; more ease → looser.

import type {
  RegionStatus,
  SizingCategory,
  Region,
  Gender,
} from "./types";

export interface EasePerRegion {
  shoulder?: number;
  chest?: number;
  waist?: number;
  hip?: number;
  thigh?: number;
}

export interface CategoryRule {
  /** Regions this category should be evaluated on. */
  regions: Region[];
  /** Required ease for the user's stated style preference. */
  ease: {
    fitted: EasePerRegion;
    regular: EasePerRegion;
    relaxed: EasePerRegion;
    oversized: EasePerRegion;
  };
  /** Per-region weight in the score (sum should be ~1.0 within active regions). */
  weights: Partial<Record<Region, number>>;
  /** Length tolerance: cropped/short categories don't get penalized. */
  lengthMode: "strict" | "lenient" | "ignore";
  /** Category defaults — used when no scraped chart exists. */
  defaultChart: Record<string, Partial<Record<Region, number>>>;
  /**
   * OPTIONAL gender-specific default charts (per the strict FIT spec
   * standard size tables). When present, `getDefaultChartForGender` will
   * pick this over `defaultChart`.
   */
  defaultChartByGender?: Partial<Record<Gender, Record<string, Partial<Record<Region, number>>>>>;
}

/** Pick the right default chart for a gender, falling back to the unisex one. */
export function getDefaultChartForGender(
  rule: CategoryRule,
  gender: Gender,
): Record<string, Partial<Record<Region, number>>> {
  return rule.defaultChartByGender?.[gender] ?? rule.defaultChart;
}

/** Map a free-text category to a normalized SizingCategory. */
export function normalizeSizingCategory(raw?: string | null, name?: string | null): SizingCategory {
  const c = `${raw || ""} ${name || ""}`.toLowerCase();
  if (/(crop)/.test(c)) return "cropped";
  if (/(jean|denim)/.test(c)) return "denim";
  if (/(short)/.test(c) && !/shirt/.test(c)) return "shorts";
  if (/(pant|trouser|chino|legging|cargo)/.test(c)) return "pants";
  if (/(skirt)/.test(c)) return "skirt";
  if (/(dress|gown|jumpsuit|romper)/.test(c)) return "dress";
  if (/(coat|parka|trench|overcoat|puffer)/.test(c)) return "coat";
  if (/(jacket|blazer|bomber)/.test(c)) return "jacket";
  if (/(hood)/.test(c)) return "hoodie";
  if (/(knit|sweater|cardigan|jumper|pullover)/.test(c)) return "knit";
  if (/(shirt|blouse|polo|button)/.test(c)) return "shirt";
  if (/(tee|t-shirt|tshirt|tank|top)/.test(c)) return "tshirt";
  if (/(top|outerwear)/.test(c)) return "tshirt";
  return "other";
}

/**
 * Infer the audience gender of a product from free-text fields.
 * Returns null when no strong signal — never guesses.
 */
export function inferProductGender(args: {
  category?: string | null;
  name?: string | null;
  brand?: string | null;
  breadcrumb?: string | string[] | null;
  explicit?: string | null; // already-known value if any
}): import("./types").Gender | null {
  const explicit = (args.explicit || "").toLowerCase().trim();
  if (explicit) {
    if (/^(female|women|woman|wmn|ladies|girl|f|w)$/.test(explicit) || /\bwomen\b|\bfemale\b/.test(explicit)) return "female";
    if (/^(male|men|man|mens|boy|guy|m)$/.test(explicit) || /\bmen\b|\bmale\b/.test(explicit)) return "male";
    if (/(unisex|neutral|all)/.test(explicit)) return "neutral";
  }
  const bc = Array.isArray(args.breadcrumb) ? args.breadcrumb.join(" ") : (args.breadcrumb || "");
  const text = `${args.category || ""} ${args.name || ""} ${args.brand || ""} ${bc}`.toLowerCase();
  if (/\b(unisex|gender[- ]?neutral)\b/.test(text)) return "neutral";
  const femaleHits =
    /\b(women|woman|ladies|female|girl|womens)\b/.test(text) ||
    /\b(dress|skirt|blouse|bra|leggings|tights|gown|bodycon|bodysuit)\b/.test(text);
  const maleHits =
    /\b(men|man|mens|male|boys|gentlemen)\b/.test(text);
  if (femaleHits && !maleHits) return "female";
  if (maleHits && !femaleHits) return "male";
  if (femaleHits && maleHits) return "neutral";
  return null;
}

/** Helper — common upper-body weight set. */
const TOP_WEIGHTS = { shoulder: 0.40, chest: 0.30, waist: 0.15, sleeve: 0.075, length: 0.075 };
const PANT_WEIGHTS = { waist: 0.35, hip: 0.25, thigh: 0.20, inseam: 0.15, length: 0.05 };

// ─── STANDARD SIZE TABLES (per the strict FIT spec) ────────────────────────
// Flat chest width is given in the spec (e.g. M men 53cm). Garment chest
// circumference = flat × 2. Shoulder & sleeve are estimated proportionally.
// These are ONLY used when no real product chart is available.

// Male tops — chest circumference (cm) = flat × 2
const MALE_TOP_DEFAULT = {
  XS: { shoulder: 42, chest:  96, waist:  90, sleeve: 60, length: 66 }, // flat 48
  S:  { shoulder: 44, chest: 100, waist:  94, sleeve: 61, length: 68 }, // flat 50
  M:  { shoulder: 46, chest: 106, waist: 100, sleeve: 62, length: 70 }, // flat 53
  L:  { shoulder: 48, chest: 112, waist: 106, sleeve: 63, length: 72 }, // flat 56
  XL: { shoulder: 50, chest: 120, waist: 114, sleeve: 64, length: 74 }, // flat 60
};

// Female tops — chest circumference (cm) = flat × 2
const FEMALE_TOP_DEFAULT = {
  XS: { shoulder: 36, chest:  84, waist:  68, sleeve: 56, length: 60 }, // flat 42
  S:  { shoulder: 37, chest:  88, waist:  72, sleeve: 57, length: 62 }, // flat 44
  M:  { shoulder: 38, chest:  94, waist:  76, sleeve: 58, length: 64 }, // flat 47
  L:  { shoulder: 39, chest: 100, waist:  82, sleeve: 59, length: 66 }, // flat 50
  XL: { shoulder: 40, chest: 108, waist:  90, sleeve: 60, length: 68 }, // flat 54
};

// Male pants — waist circumference per spec
const MALE_PANT_DEFAULT = {
  S:  { waist: 76, hip:  94, thigh: 56, inseam: 80, length: 105 },
  M:  { waist: 81, hip:  99, thigh: 58, inseam: 81, length: 106 },
  L:  { waist: 86, hip: 104, thigh: 60, inseam: 82, length: 107 },
  XL: { waist: 91, hip: 109, thigh: 62, inseam: 82, length: 108 },
};

// Female pants — waist circumference per spec
const FEMALE_PANT_DEFAULT = {
  XS: { waist: 64, hip:  88, thigh: 52, inseam: 78, length: 102 },
  S:  { waist: 68, hip:  92, thigh: 54, inseam: 78, length: 103 },
  M:  { waist: 72, hip:  96, thigh: 56, inseam: 79, length: 104 },
  L:  { waist: 76, hip: 100, thigh: 58, inseam: 79, length: 105 },
  XL: { waist: 80, hip: 104, thigh: 60, inseam: 80, length: 106 },
};

// Ease bands per the strict FIT spec
//   TOPS:    fitted +4, regular +8, relaxed +12, oversized +18
//   BOTTOMS: fitted +2, regular +4, relaxed +6,  oversized +10
const TOP_EASE = {
  fitted:    { shoulder: 1, chest: 4,  waist: 4 },
  regular:   { shoulder: 2, chest: 8,  waist: 8 },
  relaxed:   { shoulder: 4, chest: 12, waist: 12 },
  oversized: { shoulder: 7, chest: 18, waist: 18 },
};
const PANT_EASE = {
  fitted:    { waist: 2, hip: 2, thigh: 2 },
  regular:   { waist: 4, hip: 4, thigh: 4 },
  relaxed:   { waist: 6, hip: 6, thigh: 6 },
  oversized: { waist: 10, hip: 10, thigh: 10 },
};

export const CATEGORY_RULES: Record<SizingCategory, CategoryRule> = {
  tshirt: {
    regions: ["shoulder", "chest", "waist", "sleeve", "length"],
    ease: TOP_EASE,
    weights: TOP_WEIGHTS,
    lengthMode: "lenient",
    defaultChart: MALE_TOP_DEFAULT,
    defaultChartByGender: { male: MALE_TOP_DEFAULT, female: FEMALE_TOP_DEFAULT },
  },
  shirt: {
    regions: ["shoulder", "chest", "waist", "sleeve", "length"],
    ease: TOP_EASE,
    weights: TOP_WEIGHTS,
    lengthMode: "strict",
    defaultChart: MALE_TOP_DEFAULT,
    defaultChartByGender: { male: MALE_TOP_DEFAULT, female: FEMALE_TOP_DEFAULT },
  },
  hoodie: {
    regions: ["shoulder", "chest", "waist", "sleeve", "length"],
    // Hoodies wear roomier than the spec base — keep larger ease but match shape.
    ease: {
      fitted:    { shoulder: 3, chest: 8,  waist: 8 },
      regular:   { shoulder: 5, chest: 14, waist: 14 },
      relaxed:   { shoulder: 7, chest: 20, waist: 20 },
      oversized: { shoulder: 10, chest: 28, waist: 28 },
    },
    weights: { ...TOP_WEIGHTS, shoulder: 0.30, chest: 0.35 },
    lengthMode: "lenient",
    defaultChart: {
      XS: { shoulder: 48, chest: 108, waist: 100, sleeve: 60, length: 66 },
      S:  { shoulder: 50, chest: 114, waist: 106, sleeve: 61, length: 68 },
      M:  { shoulder: 52, chest: 120, waist: 112, sleeve: 62, length: 70 },
      L:  { shoulder: 54, chest: 126, waist: 118, sleeve: 63, length: 72 },
      XL: { shoulder: 56, chest: 132, waist: 124, sleeve: 64, length: 74 },
    },
  },
  knit: {
    regions: ["shoulder", "chest", "waist", "sleeve", "length"],
    ease: TOP_EASE,
    weights: TOP_WEIGHTS,
    lengthMode: "lenient",
    defaultChart: MALE_TOP_DEFAULT,
    defaultChartByGender: { male: MALE_TOP_DEFAULT, female: FEMALE_TOP_DEFAULT },
  },
  jacket: {
    regions: ["shoulder", "chest", "waist", "sleeve", "length"],
    // Jackets need slightly more ease than tops (worn over layers).
    ease: {
      fitted:    { shoulder: 2, chest: 8,  waist: 8 },
      regular:   { shoulder: 4, chest: 14, waist: 14 },
      relaxed:   { shoulder: 6, chest: 20, waist: 18 },
      oversized: { shoulder: 9, chest: 26, waist: 24 },
    },
    weights: { shoulder: 0.45, chest: 0.30, waist: 0.10, sleeve: 0.10, length: 0.05 },
    lengthMode: "strict",
    defaultChart: {
      XS: { shoulder: 44, chest: 104, waist:  98, sleeve: 60, length: 64 },
      S:  { shoulder: 46, chest: 110, waist: 104, sleeve: 61, length: 66 },
      M:  { shoulder: 48, chest: 116, waist: 110, sleeve: 62, length: 68 },
      L:  { shoulder: 50, chest: 122, waist: 116, sleeve: 63, length: 70 },
      XL: { shoulder: 52, chest: 128, waist: 122, sleeve: 64, length: 72 },
    },
  },
  coat: {
    regions: ["shoulder", "chest", "waist", "sleeve", "length"],
    ease: {
      fitted:    { shoulder: 4, chest: 16, waist: 14 },
      regular:   { shoulder: 6, chest: 22, waist: 20 },
      relaxed:   { shoulder: 8, chest: 28, waist: 26 },
      oversized: { shoulder: 12, chest: 36, waist: 32 },
    },
    weights: { shoulder: 0.45, chest: 0.30, waist: 0.10, sleeve: 0.10, length: 0.05 },
    lengthMode: "strict",
    defaultChart: {
      XS: { shoulder: 46, chest: 110, waist: 104, sleeve: 62, length: 100 },
      S:  { shoulder: 48, chest: 116, waist: 110, sleeve: 63, length: 102 },
      M:  { shoulder: 50, chest: 122, waist: 116, sleeve: 64, length: 104 },
      L:  { shoulder: 52, chest: 128, waist: 122, sleeve: 65, length: 106 },
      XL: { shoulder: 54, chest: 134, waist: 128, sleeve: 66, length: 108 },
    },
  },
  pants: {
    regions: ["waist", "hip", "thigh", "inseam", "length"],
    ease: PANT_EASE,
    weights: PANT_WEIGHTS,
    lengthMode: "strict",
    defaultChart: {
      ...MALE_PANT_DEFAULT,
      "28": { waist: 72, hip:  92, thigh: 54, inseam: 80, length: 104 },
      "30": { waist: 76, hip:  96, thigh: 56, inseam: 80, length: 105 },
      "32": { waist: 81, hip:  99, thigh: 58, inseam: 81, length: 106 },
      "34": { waist: 86, hip: 104, thigh: 60, inseam: 82, length: 107 },
      "36": { waist: 91, hip: 109, thigh: 62, inseam: 82, length: 108 },
    },
    defaultChartByGender: { male: MALE_PANT_DEFAULT, female: FEMALE_PANT_DEFAULT },
  },
  denim: {
    regions: ["waist", "hip", "thigh", "inseam", "length"],
    // Denim has minimal stretch — slightly tighter than the spec base.
    ease: {
      fitted:    { waist: 0, hip: 1, thigh: 1 },
      regular:   { waist: 2, hip: 3, thigh: 3 },
      relaxed:   { waist: 4, hip: 5, thigh: 5 },
      oversized: { waist: 8, hip: 8, thigh: 8 },
    },
    weights: PANT_WEIGHTS,
    lengthMode: "strict",
    defaultChart: {
      "28": { waist: 72, hip:  92, thigh: 56, inseam: 80, length: 104 },
      "30": { waist: 76, hip:  96, thigh: 58, inseam: 80, length: 105 },
      "32": { waist: 81, hip: 100, thigh: 60, inseam: 81, length: 106 },
      "34": { waist: 86, hip: 104, thigh: 62, inseam: 82, length: 107 },
      "36": { waist: 91, hip: 109, thigh: 64, inseam: 82, length: 108 },
      ...MALE_PANT_DEFAULT,
    },
    defaultChartByGender: { male: MALE_PANT_DEFAULT, female: FEMALE_PANT_DEFAULT },
  },
  shorts: {
    regions: ["waist", "hip", "thigh", "length"],
    ease: {
      fitted:    { waist: 0, hip: 2, thigh: 2 },
      regular:   { waist: 1, hip: 4, thigh: 5 },
      relaxed:   { waist: 2, hip: 8, thigh: 7 },
      oversized: { waist: 3, hip: 14, thigh: 10 },
    },
    weights: { waist: 0.40, hip: 0.30, thigh: 0.20, length: 0.10 },
    lengthMode: "ignore", // shorts length is intentional
    defaultChart: {
      S:  { waist: 76, hip:  96, thigh: 58, length: 42 },
      M:  { waist: 82, hip: 100, thigh: 62, length: 44 },
      L:  { waist: 86, hip: 104, thigh: 66, length: 46 },
      XL: { waist: 92, hip: 110, thigh: 70, length: 48 },
    },
  },
  dress: {
    regions: ["shoulder", "chest", "waist", "hip", "length"],
    ease: {
      fitted:    { shoulder: 1, chest: 4,  waist: 2,  hip: 4 },
      regular:   { shoulder: 2, chest: 8,  waist: 6,  hip: 8 },
      relaxed:   { shoulder: 4, chest: 14, waist: 12, hip: 12 },
      oversized: { shoulder: 6, chest: 20, waist: 18, hip: 18 },
    },
    weights: { shoulder: 0.20, chest: 0.30, waist: 0.20, hip: 0.20, length: 0.10 },
    lengthMode: "lenient",
    defaultChart: {
      XS: { shoulder: 36, chest:  84, waist:  68, hip:  92, length:  90 },
      S:  { shoulder: 37, chest:  88, waist:  72, hip:  96, length:  92 },
      M:  { shoulder: 38, chest:  94, waist:  78, hip: 102, length:  94 },
      L:  { shoulder: 39, chest: 100, waist:  84, hip: 108, length:  96 },
      XL: { shoulder: 40, chest: 106, waist:  90, hip: 114, length:  98 },
    },
  },
  skirt: {
    regions: ["waist", "hip", "length"],
    ease: {
      fitted:    { waist: 0, hip: 2 },
      regular:   { waist: 1, hip: 4 },
      relaxed:   { waist: 2, hip: 8 },
      oversized: { waist: 3, hip: 12 },
    },
    weights: { waist: 0.50, hip: 0.40, length: 0.10 },
    lengthMode: "lenient",
    defaultChart: {
      XS: { waist: 64, hip:  88, length: 60 },
      S:  { waist: 68, hip:  92, length: 62 },
      M:  { waist: 72, hip:  98, length: 64 },
      L:  { waist: 78, hip: 104, length: 66 },
      XL: { waist: 84, hip: 110, length: 68 },
    },
  },
  cropped: {
    regions: ["shoulder", "chest", "waist", "sleeve"],
    ease: {
      fitted:    { shoulder: 1, chest: 4,  waist: 4 },
      regular:   { shoulder: 2, chest: 8,  waist: 8 },
      relaxed:   { shoulder: 4, chest: 14, waist: 12 },
      oversized: { shoulder: 8, chest: 22, waist: 20 },
    },
    weights: { shoulder: 0.40, chest: 0.35, waist: 0.20, sleeve: 0.05 },
    lengthMode: "ignore", // cropped length is intentional
    defaultChart: {
      XS: { shoulder: 42, chest:  92, waist:  88, sleeve: 18, length: 48 },
      S:  { shoulder: 44, chest:  96, waist:  92, sleeve: 19, length: 50 },
      M:  { shoulder: 46, chest: 102, waist:  98, sleeve: 20, length: 52 },
      L:  { shoulder: 48, chest: 108, waist: 104, sleeve: 21, length: 54 },
    },
  },
  other: {
    regions: ["chest", "length"],
    ease: {
      fitted:    { chest: 4 },
      regular:   { chest: 8 },
      relaxed:   { chest: 14 },
      oversized: { chest: 22 },
    },
    weights: { chest: 0.6, length: 0.4 },
    lengthMode: "lenient",
    defaultChart: {
      S:  { chest:  96, length: 68 },
      M:  { chest: 102, length: 70 },
      L:  { chest: 108, length: 72 },
      XL: { chest: 114, length: 74 },
    },
  },
};

/** Tolerance bands per region (cm). Within ±tol = "regular". */
export const REGION_TOLERANCE: Record<Region, number> = {
  shoulder: 1.5,
  chest: 3,
  waist: 3,
  hip: 3,
  thigh: 2,
  sleeve: 2,
  length: 3,
  inseam: 3,
};

/** Map a delta vs ideal-ease into a region status. */
export function classifyRegion(diff: number, easeForPref: number, region: Region): RegionStatus {
  const tol = REGION_TOLERANCE[region];
  // diff = (garment - body) - easeForPref. Negative → tighter than expected.
  if (Math.abs(diff) <= tol) return "regular";
  if (diff < -2 * tol) return "tooTight";
  if (diff < -tol)     return "slightlyTight";
  if (diff > 3 * tol)  return "oversized";
  if (diff > 2 * tol)  return "loose";
  return "slightlyLoose";
}

/** Friendly EN labels for region statuses. */
export const REGION_STATUS_LABEL: Record<RegionStatus, string> = {
  tooTight: "Too tight",
  slightlyTight: "Slightly tight",
  regular: "Regular",
  slightlyLoose: "Slightly loose",
  loose: "Loose",
  oversized: "Oversized",
};
