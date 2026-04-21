// ─── Module shared types — measurement-first FIT pipeline (v2) ────────────────
// These are the SOLE source of truth for the new pipeline. Older fitEngine
// types continue to exist for backwards-compat with existing UI, but anything
// in fit2/* speaks ONLY in these structures.

export type GenderPresentation = "feminine" | "masculine" | "neutral";
export type PreferredFit = "slim" | "regular" | "relaxed" | "oversized";
export type GarmentCategoryV2 =
  | "top"
  | "shirt"
  | "jacket"
  | "coat"
  | "hoodie"
  | "pants"
  | "jeans"
  | "skirt"
  | "dress";

export type Confidence = "high" | "medium" | "low";

export interface UserBodyProfile {
  genderPresentation: GenderPresentation;
  heightCm: number;
  weightKg: number;
  shoulderCm: number;
  chestCm: number;
  waistCm: number;
  hipCm: number;
  armLengthCm: number;
  inseamCm: number;
  preferredFit: PreferredFit;
  bodyShape?: string | null;
  postureNotes?: string | null;
  fitNotes?: string | null;
  frontImageUrl?: string | null;
  sideImageUrl?: string | null;
}

export interface GarmentMeasurementProfile {
  category: GarmentCategoryV2;
  brand: string;
  title: string;
  productImageUrl: string | null;
  sourceUrl: string | null;
  sizeLabel: string;
  shoulderCm: number | null;
  chestCm: number | null;
  waistCm: number | null;
  hipCm: number | null;
  sleeveCm: number | null;
  totalLengthCm: number | null;
  thighCm: number | null;
  inseamCm: number | null;
  riseCm: number | null;
  stretchFactor: number; // 0..1 (0 = rigid, 1 = full stretch knit)
  fitType: PreferredFit | null;
  source: "merchant" | "ai" | "estimator";
  confidence: Confidence;
}

export type FitLabel =
  | "tight"
  | "close"
  | "ideal"
  | "relaxed"
  | "oversized"
  | "slightly-short"
  | "too-short"
  | "slightly-long"
  | "too-long"
  | "n/a";

export interface FitRegionResult {
  region:
    | "shoulder"
    | "chest"
    | "waist"
    | "hip"
    | "sleeve"
    | "length"
    | "thigh"
    | "inseam"
    | "rise";
  garmentCm: number | null;
  bodyCm: number | null;
  deltaCm: number | null;
  label: FitLabel;
  visualEffect: string; // human-readable hint used by the prompt builder
}

export interface FitComputationResult {
  overallFit: "tight" | "ideal" | "relaxed" | "oversized" | "mixed";
  overallScore: number; // 0..100
  confidence: Confidence;
  selectedSize: string;
  regions: FitRegionResult[];
  summary: string;
  approximationUsed: boolean;
  garmentSource: GarmentMeasurementProfile["source"];
}

export interface FitVisualPrompt {
  subjectDescription: string;
  garmentDescription: string;
  fitDescription: string;
  renderingStyle: string;
  finalPrompt: string;
}

export type GenerationStage =
  | "idle"
  | "no-data"
  | "computing-fit"
  | "generating-image"
  | "ready"
  | "approximate"
  | "error";

export interface FitGenerationState {
  stage: GenerationStage;
  fit: FitComputationResult | null;
  prompt: FitVisualPrompt | null;
  imageUrl: string | null;
  error: string | null;
}
