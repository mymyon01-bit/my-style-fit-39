// ─── FIT ENGINE: Types, Scoring, & Measurement Logic ────────────────────────

export interface BodyMeasurements {
  heightCm: number;
  shoulderWidthCm: number;
  chestCm: number;
  waistCm: number;
  hipCm: number;
  inseamCm: number;
  outseamCm: number;
  torsoLengthCm: number;
  legLengthCm: number;
  sleeveCm: number;
  neckCm: number;
  thighCm: number;
  calfCm: number;
}

export type ConfidenceLevel = "high" | "medium" | "low";

export interface MeasurementWithConfidence {
  value: number;
  confidence: ConfidenceLevel;
  source: "scan" | "manual" | "estimated";
}

export interface BodyProfile {
  measurements: Record<keyof BodyMeasurements, MeasurementWithConfidence>;
  silhouetteType: string;
  shoulderCategory: string;
  torsoToLegRatio: number;
  scanQualityScore: number;
  scanConfidence: ConfidenceLevel;
}

export type FitClassification =
  | "too-tight" | "slightly-tight" | "fitted" | "balanced"
  | "relaxed" | "oversized" | "too-loose";

export type LengthClassification =
  | "too-short" | "slightly-short" | "good-length" | "slightly-long" | "too-long";

export interface RegionFit {
  region: string;
  fit: FitClassification | LengthClassification;
  delta: number; // garment - body (+ = room, - = tight)
}

export interface SizeFitResult {
  size: string;
  fitScore: number;
  regions: RegionFit[];
  recommended: boolean;
  alternate: boolean;
}

export interface GarmentMeasurements {
  shoulder?: number;
  chest?: number;
  waist?: number;
  hip?: number;
  sleeveLength?: number;
  bodyLength?: number;
  inseam?: number;
  rise?: number;
  thigh?: number;
  hemWidth?: number;
}

export interface ProductFitData {
  category: "tops" | "bottoms" | "outerwear" | "shoes" | "accessories";
  fitType: "slim" | "regular" | "relaxed" | "oversized";
  hasStretch: boolean;
  sizes: Record<string, GarmentMeasurements>;
  dataQualityScore: number;
}

export interface FitResult {
  productDataQuality: number;
  scanQuality: number;
  sizeResults: SizeFitResult[];
  recommendedSize: string;
  alternateSize: string;
  summary: string;
  confidenceModifier: number;
}

// ─── Ease Allowances (cm) by fit type ────────────────────────────────────────

const EASE: Record<string, Record<string, number>> = {
  slim:     { chest: 4, waist: 2, hip: 2, shoulder: 0.5, thigh: 2 },
  regular:  { chest: 8, waist: 5, hip: 5, shoulder: 1,   thigh: 4 },
  relaxed:  { chest: 14, waist: 10, hip: 8, shoulder: 2,  thigh: 6 },
  oversized:{ chest: 20, waist: 16, hip: 12, shoulder: 4, thigh: 10 },
};

// ─── Classification helpers ──────────────────────────────────────────────────

function classifyFit(delta: number, ease: number): FitClassification {
  const ratio = delta / Math.max(ease, 1);
  if (ratio < -0.3) return "too-tight";
  if (ratio < 0) return "slightly-tight";
  if (ratio < 0.5) return "fitted";
  if (ratio < 1.0) return "balanced";
  if (ratio < 1.5) return "relaxed";
  if (ratio < 2.0) return "oversized";
  return "too-loose";
}

function classifyLength(delta: number): LengthClassification {
  if (delta < -4) return "too-short";
  if (delta < -1) return "slightly-short";
  if (delta <= 2) return "good-length";
  if (delta <= 5) return "slightly-long";
  return "too-long";
}

function fitToScore(fit: FitClassification | LengthClassification): number {
  const map: Record<string, number> = {
    "too-tight": 20, "slightly-tight": 55, "fitted": 90, "balanced": 100,
    "relaxed": 85, "oversized": 60, "too-loose": 25,
    "too-short": 20, "slightly-short": 60, "good-length": 100,
    "slightly-long": 65, "too-long": 20,
  };
  return map[fit] ?? 50;
}

// ─── Tops Scoring ────────────────────────────────────────────────────────────

function scoreTopSize(
  body: BodyMeasurements,
  garment: GarmentMeasurements,
  fitType: string
): { score: number; regions: RegionFit[] } {
  const ease = EASE[fitType] || EASE.regular;
  const regions: RegionFit[] = [];

  const shoulderDelta = (garment.shoulder ?? body.shoulderWidthCm + ease.shoulder) - body.shoulderWidthCm;
  const chestDelta = (garment.chest ?? body.chestCm + ease.chest) - body.chestCm;
  const waistDelta = (garment.waist ?? body.waistCm + ease.waist) - body.waistCm;
  const sleeveDelta = (garment.sleeveLength ?? body.sleeveCm) - body.sleeveCm;
  const lengthDelta = (garment.bodyLength ?? body.torsoLengthCm + 10) - (body.torsoLengthCm + 10);

  regions.push({ region: "Shoulder", fit: classifyFit(shoulderDelta, ease.shoulder), delta: shoulderDelta });
  regions.push({ region: "Chest", fit: classifyFit(chestDelta, ease.chest), delta: chestDelta });
  regions.push({ region: "Waist", fit: classifyFit(waistDelta, ease.waist), delta: waistDelta });
  regions.push({ region: "Sleeve", fit: classifyLength(sleeveDelta), delta: sleeveDelta });
  regions.push({ region: "Length", fit: classifyLength(lengthDelta), delta: lengthDelta });

  const weights = { Shoulder: 0.30, Chest: 0.22, Waist: 0.14, Sleeve: 0.12, Length: 0.12 };
  let score = 0;
  for (const r of regions) {
    const w = weights[r.region as keyof typeof weights] ?? 0.10;
    score += w * fitToScore(r.fit);
  }

  return { score: Math.round(score), regions };
}

// ─── Pants Scoring ───────────────────────────────────────────────────────────

function scorePantsSize(
  body: BodyMeasurements,
  garment: GarmentMeasurements,
  fitType: string
): { score: number; regions: RegionFit[] } {
  const ease = EASE[fitType] || EASE.regular;
  const regions: RegionFit[] = [];

  const waistDelta = (garment.waist ?? body.waistCm + ease.waist) - body.waistCm;
  const hipDelta = (garment.hip ?? body.hipCm + ease.hip) - body.hipCm;
  const thighDelta = (garment.thigh ?? body.thighCm + ease.thigh) - body.thighCm;
  const inseamDelta = (garment.inseam ?? body.inseamCm) - body.inseamCm;
  const riseDelta = (garment.rise ?? 26) - 26; // neutral rise

  regions.push({ region: "Waist", fit: classifyFit(waistDelta, ease.waist), delta: waistDelta });
  regions.push({ region: "Hip", fit: classifyFit(hipDelta, ease.hip), delta: hipDelta });
  regions.push({ region: "Thigh", fit: classifyFit(thighDelta, ease.thigh), delta: thighDelta });
  regions.push({ region: "Inseam", fit: classifyLength(inseamDelta), delta: inseamDelta });
  regions.push({ region: "Rise", fit: classifyLength(riseDelta), delta: riseDelta });

  const weights = { Waist: 0.24, Hip: 0.20, Thigh: 0.18, Inseam: 0.14, Rise: 0.12 };
  let score = 0;
  for (const r of regions) {
    const w = weights[r.region as keyof typeof weights] ?? 0.12;
    score += w * fitToScore(r.fit);
  }

  return { score: Math.round(score), regions };
}

// ─── Main Fit Engine ─────────────────────────────────────────────────────────

export function computeFit(
  body: BodyMeasurements,
  product: ProductFitData,
  scanQuality: number
): FitResult {
  const sizeEntries = Object.entries(product.sizes);
  const confidenceModifier = Math.min(1, (product.dataQualityScore / 100) * (scanQuality / 100) * 1.2);

  const sizeResults: SizeFitResult[] = sizeEntries.map(([size, garment]) => {
    const scorer = product.category === "bottoms" ? scorePantsSize : scoreTopSize;
    const { score, regions } = scorer(body, garment, product.fitType);
    const adjusted = Math.round(score * confidenceModifier);
    return { size, fitScore: adjusted, regions, recommended: false, alternate: false };
  });

  sizeResults.sort((a, b) => b.fitScore - a.fitScore);
  if (sizeResults.length > 0) sizeResults[0].recommended = true;
  if (sizeResults.length > 1) sizeResults[1].alternate = true;

  const rec = sizeResults[0];
  const alt = sizeResults[1];

  const tightRegions = rec?.regions.filter(r => r.fit.includes("tight")).map(r => r.region) ?? [];
  const looseRegions = rec?.regions.filter(r => r.fit.includes("loose") || r.fit === "oversized").map(r => r.region) ?? [];

  let summary = `${rec?.size} is the best fit.`;
  if (tightRegions.length) summary += ` May feel snug at ${tightRegions.join(", ").toLowerCase()}.`;
  if (looseRegions.length) summary += ` Extra room at ${looseRegions.join(", ").toLowerCase()}.`;
  if (alt) summary += ` ${alt.size} is a close alternative.`;

  return {
    productDataQuality: product.dataQualityScore,
    scanQuality,
    sizeResults,
    recommendedSize: rec?.size ?? "N/A",
    alternateSize: alt?.size ?? "N/A",
    summary,
    confidenceModifier,
  };
}

// ─── Mock product fit data for demo ──────────────────────────────────────────

export const mockProductFitData: Record<string, ProductFitData> = {
  "3": {
    category: "tops",
    fitType: "oversized",
    hasStretch: false,
    dataQualityScore: 88,
    sizes: {
      XS: { shoulder: 42, chest: 96, waist: 90, sleeveLength: 58, bodyLength: 68 },
      S:  { shoulder: 44, chest: 102, waist: 96, sleeveLength: 60, bodyLength: 70 },
      M:  { shoulder: 46, chest: 108, waist: 102, sleeveLength: 62, bodyLength: 72 },
      L:  { shoulder: 48, chest: 114, waist: 108, sleeveLength: 64, bodyLength: 74 },
      XL: { shoulder: 50, chest: 120, waist: 114, sleeveLength: 66, bodyLength: 76 },
    },
  },
  "5": {
    category: "tops",
    fitType: "slim",
    hasStretch: true,
    dataQualityScore: 92,
    sizes: {
      S:  { shoulder: 42, chest: 92, waist: 86, sleeveLength: 60, bodyLength: 66 },
      M:  { shoulder: 44, chest: 98, waist: 92, sleeveLength: 62, bodyLength: 68 },
      L:  { shoulder: 46, chest: 104, waist: 98, sleeveLength: 64, bodyLength: 70 },
      XL: { shoulder: 48, chest: 110, waist: 104, sleeveLength: 66, bodyLength: 72 },
    },
  },
  "2": {
    category: "bottoms",
    fitType: "regular",
    hasStretch: false,
    dataQualityScore: 85,
    sizes: {
      "30": { waist: 78, hip: 96, thigh: 56, inseam: 80, rise: 26 },
      "32": { waist: 82, hip: 100, thigh: 60, inseam: 81, rise: 27 },
      "34": { waist: 86, hip: 104, thigh: 64, inseam: 82, rise: 28 },
      "36": { waist: 90, hip: 108, thigh: 68, inseam: 83, rise: 29 },
    },
  },
  "6": {
    category: "bottoms",
    fitType: "relaxed",
    hasStretch: false,
    dataQualityScore: 72,
    sizes: {
      S:  { waist: 76, hip: 100, thigh: 62, inseam: 76, rise: 30 },
      M:  { waist: 80, hip: 104, thigh: 66, inseam: 78, rise: 31 },
      L:  { waist: 84, hip: 108, thigh: 70, inseam: 80, rise: 32 },
      XL: { waist: 88, hip: 112, thigh: 74, inseam: 82, rise: 33 },
    },
  },
};

// ─── Body Type & Hint System ─────────────────────────────────────────────────

export type BodyTypeKey = "slim" | "regular" | "solid" | "heavy";
export type BodyHint =
  | "broad-shoulders" | "narrow-shoulders"
  | "long-legs" | "short-legs"
  | "short-torso" | "long-torso"
  | "thick-thighs" | "slim-legs";

// Statistical estimation from height + weight + body type + hints
export function estimateBodyFromProfile(
  heightCm: number,
  weightKg: number,
  bodyType: BodyTypeKey,
  hints: BodyHint[]
): Partial<Record<keyof BodyMeasurements, number>> {
  // BMI-adjusted base ratios
  const bmi = weightKg / ((heightCm / 100) ** 2);

  // Base shoulder from height ratio (0.24-0.27 of height typical)
  const shoulderRatio = bodyType === "slim" ? 0.245 : bodyType === "regular" ? 0.255 : bodyType === "solid" ? 0.265 : 0.27;
  let shoulder = heightCm * shoulderRatio;

  // Chest from weight/height correlation
  const chestBase = bodyType === "slim" ? 86 : bodyType === "regular" ? 94 : bodyType === "solid" ? 102 : 110;
  let chest = chestBase + (bmi - 22) * 1.8;

  // Waist from BMI
  const waistBase = bodyType === "slim" ? 72 : bodyType === "regular" ? 80 : bodyType === "solid" ? 88 : 96;
  let waist = waistBase + (bmi - 22) * 2.2;

  // Hip from weight
  const hipBase = bodyType === "slim" ? 88 : bodyType === "regular" ? 96 : bodyType === "solid" ? 104 : 112;
  let hip = hipBase + (bmi - 22) * 1.5;

  // Inseam from height (typically 0.44-0.46 of height)
  let inseam = heightCm * 0.45;
  let torso = heightCm * 0.29;
  let leg = heightCm * 0.48;
  let thigh = bodyType === "slim" ? 50 : bodyType === "regular" ? 56 : bodyType === "solid" ? 62 : 68;
  thigh += (bmi - 22) * 1.0;

  // Apply hints
  for (const hint of hints) {
    switch (hint) {
      case "broad-shoulders": shoulder += 3; break;
      case "narrow-shoulders": shoulder -= 3; break;
      case "long-legs": inseam += 4; leg += 4; torso -= 2; break;
      case "short-legs": inseam -= 4; leg -= 4; torso += 2; break;
      case "short-torso": torso -= 3; leg += 2; break;
      case "long-torso": torso += 3; leg -= 2; break;
      case "thick-thighs": thigh += 5; hip += 3; break;
      case "slim-legs": thigh -= 4; break;
    }
  }

  return {
    heightCm,
    shoulderWidthCm: Math.round(shoulder * 10) / 10,
    chestCm: Math.round(chest),
    waistCm: Math.round(waist),
    hipCm: Math.round(hip),
    inseamCm: Math.round(inseam),
    outseamCm: Math.round(inseam + 26),
    torsoLengthCm: Math.round(torso),
    legLengthCm: Math.round(leg),
    sleeveCm: Math.round(heightCm * 0.35),
    thighCm: Math.round(thigh),
    neckCm: Math.round(36 + (bmi - 22) * 0.5),
    calfCm: Math.round(34 + (bmi - 22) * 0.6),
  };
}

// ─── Default body for demo ───────────────────────────────────────────────────

export const defaultBodyMeasurements: BodyMeasurements = {
  heightCm: 175,
  shoulderWidthCm: 45,
  chestCm: 94,
  waistCm: 80,
  hipCm: 96,
  inseamCm: 79,
  outseamCm: 105,
  torsoLengthCm: 46,
  legLengthCm: 84,
  sleeveCm: 61,
  neckCm: 37,
  thighCm: 56,
  calfCm: 36,
};
