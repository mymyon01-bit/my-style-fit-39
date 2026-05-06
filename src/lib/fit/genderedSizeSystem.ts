// ─── GENDERED SIZE SYSTEM — V3.9 ──────────────────────────────────────────
// Men's S ≠ Women's S. The size LABEL is never trusted alone.
// This module:
//   1. Detects garment target gender (menswear / womenswear / unisex / kidswear)
//   2. Normalizes a selected size label into approximate cm measurements
//      using gender-aware default tables (when no exact size chart exists)
//   3. Produces a cross-gender warning + helper copy
//   4. Emits a single-line generation directive for the AI prompt
//
// Pure / deterministic. No I/O. Safe for web + edge runtimes.

import type { GarmentMacroCategory, GarmentType } from "./garmentDNA";
import type { CorrelationRegion, SizeMeasurementInput } from "./sizeCorrelationEngine";

// ─── Types ─────────────────────────────────────────────────────────────────

export type TargetGender = "menswear" | "womenswear" | "unisex" | "kidswear" | "unknown";
export type BodyGender   = "male" | "female" | "neutral" | null | undefined;

export interface GenderDetectionInput {
  name?: string | null;
  brand?: string | null;
  category?: string | null;
  description?: string | null;
  breadcrumb?: string | null;
  url?: string | null;
  /** Hints from the size chart labels themselves (e.g. ["XS","S","M","L"]). */
  sizeLabels?: string[] | null;
  /** Whether retailer metadata explicitly tagged the gender. */
  metadataGender?: string | null;
}

export interface GenderedSizeContext {
  userBodyGender: BodyGender;
  garmentTargetGender: TargetGender;
  selectedSizeLabel: string;
  normalizedSizeKey: string;            // "M-women-tops" etc.
  sizeSystem: "exact" | "gender-default" | "unisex-default" | "fallback";
  /** True when body gender ≠ garment target gender (and both are known). */
  isCrossGender: boolean;
  /** Short helper line for the UI. Empty when nothing notable. */
  genderSizeWarning: string;
  /** Approximate equivalence on the OTHER gender system (or "" if not useful). */
  equivalentApproximation: string;
  /** Confidence in the gender detection itself. */
  confidence: "high" | "medium" | "low";
}

// ─── Detection ─────────────────────────────────────────────────────────────

const MEN_PATTERNS = [
  /\b(men'?s?|mens|menswear|male|man|guys?)\b/i,
  /\bfor men\b/i,
  /\/men[\/-]/i,
];
const WOMEN_PATTERNS = [
  /\b(women'?s?|womens|womenswear|female|ladies|lady|girls?)\b/i,
  /\bfor women\b/i,
  /\/women[\/-]/i,
  /\b(dress|gown|blouse|skirt|bodycon|bra|lingerie)\b/i,
];
const UNISEX_PATTERNS = [
  /\b(unisex|gender[\s-]?neutral|all[\s-]?gender)\b/i,
];
const KIDS_PATTERNS = [
  /\b(kid'?s?|kids|child|children|toddler|baby|youth|junior)\b/i,
];

export function detectTargetGender(input: GenderDetectionInput): { gender: TargetGender; confidence: "high" | "medium" | "low" } {
  const meta = (input.metadataGender ?? "").toLowerCase().trim();
  if (meta) {
    if (/men|male/.test(meta) && !/women|female/.test(meta)) return { gender: "menswear",   confidence: "high" };
    if (/women|female/.test(meta))                            return { gender: "womenswear", confidence: "high" };
    if (/unisex|neutral/.test(meta))                          return { gender: "unisex",     confidence: "high" };
    if (/kid|child|baby|youth/.test(meta))                    return { gender: "kidswear",   confidence: "high" };
  }

  const blob = [input.name, input.breadcrumb, input.category, input.description, input.url]
    .filter(Boolean).join(" ");

  if (KIDS_PATTERNS.some((re) => re.test(blob)))    return { gender: "kidswear",   confidence: "high" };
  if (UNISEX_PATTERNS.some((re) => re.test(blob)))  return { gender: "unisex",     confidence: "high" };

  const isWomen = WOMEN_PATTERNS.some((re) => re.test(blob));
  const isMen   = MEN_PATTERNS.some((re) => re.test(blob));
  if (isWomen && !isMen) return { gender: "womenswear", confidence: "high" };
  if (isMen && !isWomen) return { gender: "menswear",   confidence: "high" };

  // Size label heuristic — numeric womenswear sizes (0/2/4/6/8) are a strong signal.
  const labels = (input.sizeLabels ?? []).map((s) => s.toLowerCase().trim());
  if (labels.length) {
    if (labels.some((l) => /^(0|2|4|6|8|10|12|14|16)$/.test(l))) return { gender: "womenswear", confidence: "medium" };
    if (labels.some((l) => /^\d{2}$/.test(l) && parseInt(l, 10) >= 28 && parseInt(l, 10) <= 44)) {
      return { gender: "menswear", confidence: "medium" };
    }
  }

  return { gender: "unknown", confidence: "low" };
}

// ─── Default measurement tables (cm) ───────────────────────────────────────
// Highly approximate. Only used when no exact size chart was resolved.
// Numbers represent BODY-FACING garment cm (chest = chest circumference, etc.).

type DefaultRow = Partial<Record<CorrelationRegion, number>>;
type DefaultTable = Record<string, DefaultRow>;

// Menswear tops (chest circumference + shoulder + sleeve + length)
const MEN_TOPS: DefaultTable = {
  XS: { chest: 92,  shoulder: 42, sleeve: 60, length: 66, waist: 78 },
  S:  { chest: 96,  shoulder: 44, sleeve: 61, length: 68, waist: 82 },
  M:  { chest: 100, shoulder: 46, sleeve: 62, length: 70, waist: 86 },
  L:  { chest: 106, shoulder: 48, sleeve: 63, length: 72, waist: 92 },
  XL: { chest: 112, shoulder: 50, sleeve: 64, length: 74, waist: 98 },
  XXL:{ chest: 118, shoulder: 52, sleeve: 65, length: 76, waist: 104 },
};

// Womenswear tops — narrower shoulder, shorter torso, more waist shaping
const WOMEN_TOPS: DefaultTable = {
  XS: { chest: 82,  shoulder: 36, sleeve: 56, length: 58, waist: 64 },
  S:  { chest: 86,  shoulder: 37, sleeve: 57, length: 60, waist: 68 },
  M:  { chest: 90,  shoulder: 38, sleeve: 58, length: 62, waist: 72 },
  L:  { chest: 96,  shoulder: 40, sleeve: 59, length: 64, waist: 78 },
  XL: { chest: 102, shoulder: 42, sleeve: 60, length: 66, waist: 84 },
  XXL:{ chest: 108, shoulder: 44, sleeve: 61, length: 68, waist: 90 },
};

const MEN_BOTTOMS: DefaultTable = {
  XS: { waist: 72,  hip: 90,  thigh: 54, inseam: 79, rise: 26 },
  S:  { waist: 76,  hip: 94,  thigh: 56, inseam: 80, rise: 27 },
  M:  { waist: 82,  hip: 100, thigh: 58, inseam: 81, rise: 28 },
  L:  { waist: 88,  hip: 106, thigh: 60, inseam: 82, rise: 29 },
  XL: { waist: 94,  hip: 112, thigh: 62, inseam: 83, rise: 30 },
  XXL:{ waist: 100, hip: 118, thigh: 64, inseam: 84, rise: 31 },
};

const WOMEN_BOTTOMS: DefaultTable = {
  XS: { waist: 62, hip: 86,  thigh: 50, inseam: 76, rise: 24 },
  S:  { waist: 66, hip: 90,  thigh: 52, inseam: 76, rise: 25 },
  M:  { waist: 70, hip: 94,  thigh: 54, inseam: 77, rise: 26 },
  L:  { waist: 76, hip: 100, thigh: 56, inseam: 77, rise: 27 },
  XL: { waist: 82, hip: 106, thigh: 58, inseam: 78, rise: 28 },
  XXL:{ waist: 88, hip: 112, thigh: 60, inseam: 78, rise: 29 },
};

const WOMEN_DRESSES: DefaultTable = {
  XS: { chest: 82, waist: 64, hip: 88,  length: 90 },
  S:  { chest: 86, waist: 68, hip: 92,  length: 92 },
  M:  { chest: 90, waist: 72, hip: 96,  length: 94 },
  L:  { chest: 96, waist: 78, hip: 102, length: 96 },
  XL: { chest:102, waist: 84, hip: 108, length: 98 },
};

const UNISEX_TOPS: DefaultTable = {
  XS: { chest: 96,  shoulder: 46, sleeve: 60, length: 68 },
  S:  { chest: 102, shoulder: 48, sleeve: 61, length: 70 },
  M:  { chest: 108, shoulder: 50, sleeve: 62, length: 72 },
  L:  { chest: 116, shoulder: 53, sleeve: 63, length: 74 },
  XL: { chest: 124, shoulder: 56, sleeve: 64, length: 76 },
  XXL:{ chest: 132, shoulder: 58, sleeve: 65, length: 78 },
};

function pickTable(target: TargetGender, macro: GarmentMacroCategory, type?: GarmentType): DefaultTable | null {
  if (target === "womenswear") {
    if (macro === "dress") return WOMEN_DRESSES;
    if (macro === "bottom") return WOMEN_BOTTOMS;
    return WOMEN_TOPS;
  }
  if (target === "menswear") {
    if (macro === "bottom") return MEN_BOTTOMS;
    return MEN_TOPS;
  }
  if (target === "unisex") {
    return UNISEX_TOPS; // unisex bottoms are rare; tops dominate
  }
  return null;
}

// ─── Normalization ────────────────────────────────────────────────────────

const SIZE_ALIASES: Record<string, string> = {
  "XXS": "XS", "XS": "XS", "S": "S", "SM": "S", "SMALL": "S",
  "M": "M", "MD": "M", "MED": "M", "MEDIUM": "M",
  "L": "L", "LG": "L", "LARGE": "L",
  "XL": "XL", "X-LARGE": "XL", "XLARGE": "XL",
  "XXL": "XXL", "2XL": "XXL", "XXXL": "XXL", "3XL": "XXL",
};

function normalizeLabel(label: string): string {
  const k = (label ?? "").toUpperCase().trim();
  return SIZE_ALIASES[k] ?? k;
}

/** Build defaulted measurements for a single size label. */
export function defaultMeasurementsForSize(args: {
  targetGender: TargetGender;
  macro: GarmentMacroCategory;
  type?: GarmentType;
  sizeLabel: string;
}): SizeMeasurementInput | null {
  const tbl = pickTable(args.targetGender, args.macro, args.type);
  if (!tbl) return null;
  const key = normalizeLabel(args.sizeLabel);
  const row = tbl[key];
  if (!row) return null;
  return { size: args.sizeLabel, measurements: row, source: "categoryDefault" };
}

/** Build defaulted measurements for ALL sizes of a target gender + category. */
export function defaultMeasurementsForAllSizes(args: {
  targetGender: TargetGender;
  macro: GarmentMacroCategory;
  type?: GarmentType;
  sizeOrder?: string[];
}): SizeMeasurementInput[] {
  const tbl = pickTable(args.targetGender, args.macro, args.type);
  if (!tbl) return [];
  const order = args.sizeOrder?.length ? args.sizeOrder : Object.keys(tbl);
  return order
    .map((label) => {
      const key = normalizeLabel(label);
      const row = tbl[key];
      if (!row) return null;
      return { size: label, measurements: row, source: "categoryDefault" as const };
    })
    .filter(Boolean) as SizeMeasurementInput[];
}

// ─── Cross-gender approximation copy ──────────────────────────────────────

function approxOtherGender(target: TargetGender, sizeLabel: string, macro: GarmentMacroCategory): string {
  const k = normalizeLabel(sizeLabel);
  if (macro === "dress" || macro === "footwear" || macro === "accessory") return "";
  // Womenswear → Menswear: typically one to two sizes smaller in men's.
  if (target === "womenswear") {
    const map: Record<string, string> = { XS: "men's XXS", S: "men's XS", M: "men's S", L: "men's S/M", XL: "men's M", XXL: "men's L" };
    return map[k] ? `closer to ${map[k]} on a male frame` : "";
  }
  if (target === "menswear") {
    const map: Record<string, string> = { XS: "women's S", S: "women's M", M: "women's L", L: "women's XL", XL: "women's XXL", XXL: "women's XXL+" };
    return map[k] ? `closer to ${map[k]} on a female frame` : "";
  }
  return "";
}

// ─── Public entry ─────────────────────────────────────────────────────────

export interface BuildContextInput {
  body: { gender?: BodyGender };
  detection: GenderDetectionInput;
  macro: GarmentMacroCategory;
  type?: GarmentType;
  selectedSizeLabel: string;
  /** Whether an exact size chart was already resolved. */
  hasExactChart?: boolean;
}

export function buildGenderedSizeContext(input: BuildContextInput): GenderedSizeContext {
  const { gender: target, confidence } = detectTargetGender(input.detection);
  const userBodyGender = input.body.gender ?? null;
  const normSize = normalizeLabel(input.selectedSizeLabel || "");

  const isCrossGender =
    !!userBodyGender && userBodyGender !== "neutral" &&
    ((userBodyGender === "male"   && target === "womenswear") ||
     (userBodyGender === "female" && target === "menswear"));

  let genderSizeWarning = "";
  if (input.hasExactChart) {
    // exact chart already trumps everything — only flag truly relevant context
    if (target === "womenswear" && userBodyGender === "male") {
      genderSizeWarning = "Womenswear sizing — measurements normalized before fit analysis.";
    } else if (target === "menswear" && userBodyGender === "female") {
      genderSizeWarning = "Menswear sizing — shoulder and chest ease weighted higher.";
    } else if (target === "unisex") {
      genderSizeWarning = "Unisex sizing — oversized tolerance applied.";
    }
  } else {
    if (target === "womenswear") genderSizeWarning = "Women's sizing detected — measurements normalized before fit analysis.";
    else if (target === "menswear") genderSizeWarning = "Men's sizing detected — shoulder and chest ease weighted higher.";
    else if (target === "unisex") genderSizeWarning = "Unisex sizing detected — oversized tolerance applied.";
    else if (target === "kidswear") genderSizeWarning = "Kidswear sizing detected — adult body fit may be unreliable.";
  }

  if (isCrossGender) {
    genderSizeWarning = `Cross-gender fit: this ${target.replace("wear", "'s")} size label may not match your usual size.`;
  }

  const equivalentApproximation = isCrossGender ? approxOtherGender(target, normSize, input.macro) : "";

  const sizeSystem: GenderedSizeContext["sizeSystem"] = input.hasExactChart
    ? "exact"
    : target === "unisex" ? "unisex-default"
    : target === "menswear" || target === "womenswear" ? "gender-default"
    : "fallback";

  const normalizedSizeKey = `${normSize}-${target}-${input.macro}`;

  return {
    userBodyGender,
    garmentTargetGender: target,
    selectedSizeLabel: input.selectedSizeLabel,
    normalizedSizeKey,
    sizeSystem,
    isCrossGender,
    genderSizeWarning,
    equivalentApproximation,
    confidence,
  };
}

// ─── Generation directive ─────────────────────────────────────────────────

/** Single-line directive consumed by fit-generate-v2 prompt builder. */
export function buildGenderDirective(ctx: GenderedSizeContext, body: { gender?: BodyGender }): string {
  const target = ctx.garmentTargetGender;
  const userG = body.gender ?? ctx.userBodyGender;
  if (target === "unknown") return "";

  if (ctx.isCrossGender) {
    if (target === "womenswear" && userG === "male") {
      return `Garment target gender: womenswear. Selected size: ${ctx.selectedSizeLabel}. Preserve the male body silhouette and render the garment as physically fitted to the body — do not resize the body to a female mannequin. Expect tighter shoulder and chest ease.`;
    }
    if (target === "menswear" && userG === "female") {
      return `Garment target gender: menswear. Selected size: ${ctx.selectedSizeLabel}. Preserve the female body silhouette. Show natural oversized shoulder width and longer sleeve length without changing body proportions.`;
    }
  }
  if (target === "unisex") {
    return `Garment target gender: unisex. Selected size: ${ctx.selectedSizeLabel}. Apply oversized tolerance with relaxed shoulder seam and longer body length.`;
  }
  return `Garment target gender: ${target}. Selected size: ${ctx.selectedSizeLabel}. Use ${target} cut conventions for shoulder, chest and length.`;
}
