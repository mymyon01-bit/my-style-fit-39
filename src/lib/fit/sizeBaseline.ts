// ─── DEFAULT SIZE BASELINE ───────────────────────────────────────────────────
// Pure baseline: maps gender + weight → expected garment size when the product
// has NO measurement data. This is NOT a recommendation — it's the comparison
// reference used by the prompt builder + the unrealistic-rec guard.
//
// Source: spec from product brief.
//   MALE   XS 50–60 / S 60–70 / M 70–80 / L 80–90 / XL 90–105 / XXL 105+
//   FEMALE XS 40–50 / S 50–58 / M 58–65 / L 65–75 / XL 75–90 / XXL 90+
//
// Weights outside the table extend monotonically (very low → XS, very high →
// XXL+). NEVER clamps — a 130kg user gets XXL, a 35kg user gets XS.

export type BaselineSize = "XS" | "S" | "M" | "L" | "XL" | "XXL";
export type BaselineGender = "male" | "female" | "neutral";

const MALE_RANGES: Array<{ size: BaselineSize; max: number }> = [
  { size: "XS", max: 60 },
  { size: "S",  max: 70 },
  { size: "M",  max: 80 },
  { size: "L",  max: 90 },
  { size: "XL", max: 105 },
  { size: "XXL", max: Infinity },
];

const FEMALE_RANGES: Array<{ size: BaselineSize; max: number }> = [
  { size: "XS", max: 50 },
  { size: "S",  max: 58 },
  { size: "M",  max: 65 },
  { size: "L",  max: 75 },
  { size: "XL", max: 90 },
  { size: "XXL", max: Infinity },
];

const NEUTRAL_RANGES: Array<{ size: BaselineSize; max: number }> = [
  { size: "XS", max: 55 },
  { size: "S",  max: 64 },
  { size: "M",  max: 73 },
  { size: "L",  max: 83 },
  { size: "XL", max: 98 },
  { size: "XXL", max: Infinity },
];

const ORDER: BaselineSize[] = ["XS", "S", "M", "L", "XL", "XXL"];

function normalizeGender(g?: string | null): BaselineGender {
  const v = (g || "").toLowerCase();
  if (v.startsWith("m") || v === "man" || v === "men") return "male";
  if (v.startsWith("f") || v === "woman" || v === "women") return "female";
  return "neutral";
}

/** Baseline garment size expected for this body (no product data needed). */
export function baselineSizeForBody(weightKg: number | null | undefined, gender: string | null | undefined): BaselineSize {
  if (weightKg == null || !Number.isFinite(weightKg) || weightKg <= 0) return "M";
  const g = normalizeGender(gender);
  const ranges = g === "male" ? MALE_RANGES : g === "female" ? FEMALE_RANGES : NEUTRAL_RANGES;
  for (const r of ranges) {
    if (weightKg <= r.max) return r.size;
  }
  return "XXL";
}

/** -3..+3 distance from baseline, e.g. 100kg male wearing S → +3 (way too small). */
export function sizeOffsetFromBaseline(currentSize: string, baseline: BaselineSize): number {
  const cur = (currentSize || "M").toUpperCase().trim();
  const i = ORDER.indexOf(cur as BaselineSize);
  const j = ORDER.indexOf(baseline);
  if (i < 0 || j < 0) return 0;
  return j - i; // positive = current size is smaller than baseline
}

export type BaselineFitVerdict =
  | "way-too-tight"  // offset >= +2
  | "tight"          // offset == +1
  | "matches"        // offset == 0
  | "loose"          // offset == -1
  | "blanket";       // offset <= -2

export function baselineFitVerdict(currentSize: string, weightKg: number | null | undefined, gender: string | null | undefined): {
  baseline: BaselineSize;
  offset: number;
  verdict: BaselineFitVerdict;
  isUnrealistic: boolean;
} {
  const baseline = baselineSizeForBody(weightKg, gender);
  const offset = sizeOffsetFromBaseline(currentSize, baseline);
  const verdict: BaselineFitVerdict =
    offset >= 2 ? "way-too-tight" :
    offset === 1 ? "tight" :
    offset === 0 ? "matches" :
    offset === -1 ? "loose" : "blanket";
  const isUnrealistic = Math.abs(offset) >= 2;
  return { baseline, offset, verdict, isUnrealistic };
}

/** Short physical-consequence sentence — fed straight into the image prompt. */
export function describeBaselineConsequence(args: {
  weightKg: number | null | undefined;
  gender: string | null | undefined;
  currentSize: string;
  category?: string | null;
}): string {
  const { baseline, offset, verdict } = baselineFitVerdict(args.currentSize, args.weightKg, args.gender);
  const cat = (args.category || "").toLowerCase();
  const isBag = /bag|backpack|tote|purse|clutch/.test(cat);
  const isPants = /pant|trouser|jean|short|skirt|legging/.test(cat);
  const isOuter = /coat|jacket|outer|parka|puffer/.test(cat);

  if (isBag) {
    // Bags scale relative to body, not size letter.
    if (offset >= 2) return "the bag looks small and dwarfed against the body, straps short, body towers over it";
    if (offset <= -2) return "the bag looks oversized relative to the body, almost luggage-like, straps long";
    return "the bag is naturally proportioned to the body, worn over the shoulder or held";
  }

  switch (verdict) {
    case "way-too-tight":
      return isPants
        ? "fabric stretched at thigh and waist, visible tension lines, waistband digging in, hems riding high"
        : isOuter
        ? "outerwear strains across shoulders and chest, sleeves stop short of wrists, cannot zip closed comfortably"
        : "fabric pulled taut across chest, shoulders and arms, visible stress folds, garment looks compressed and undersized";
    case "tight":
      return "garment sits snug against the body, mild fabric tension at chest and shoulders, slightly shortened look";
    case "matches":
      return "garment drapes naturally with correct ease for this body, no tension, no excess fabric";
    case "loose":
      return "extra ease around the body, soft folds at the waist and sleeves, slightly relaxed silhouette";
    case "blanket":
      return isPants
        ? "waistband sags, fabric pools at ankles, excess width at thighs, sliding off the hips"
        : isOuter
        ? "outerwear hangs off the shoulders like a blanket, sleeves cover the hands, hem near the knees"
        : "garment drapes off the body like a blanket, dropped shoulders well past the natural shoulder line, sleeves past the hands, hem extended well past the hip";
  }

  // typescript exhaustiveness fallthrough
  return "garment fits with natural ease";
}

export const BASELINE_RANGES_HUMAN = {
  male:   "XS 50–60kg, S 60–70kg, M 70–80kg, L 80–90kg, XL 90–105kg, XXL 105kg+",
  female: "XS 40–50kg, S 50–58kg, M 58–65kg, L 65–75kg, XL 75–90kg, XXL 90kg+",
};
