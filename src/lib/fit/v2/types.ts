// Strict types for the rebuilt measurement-first FIT pipeline.
// This module is the single source of truth for v2 fit logic.

export type BodyMeasurements = {
  height: number;      // cm
  weight: number;      // kg
  chest: number;       // cm
  waist: number;       // cm
  hips: number;        // cm
  shoulder: number;    // cm
  armLength: number;   // cm
};

export type GarmentMeasurements = {
  chest: number;       // cm (pit-to-pit doubled)
  length: number;      // cm (total length)
  shoulder: number;    // cm
  sleeve: number;      // cm
};

export type FitResult = {
  chestDiff: number;
  lengthDiff: number;
  shoulderDiff: number;
  sleeveDiff: number;
};

export type ChestFit = "tight" | "regular" | "loose";
export type LengthFit = "short" | "perfect" | "long";
export type ShoulderFit = "tight" | "perfect" | "dropped";
export type SleeveFit = "short" | "perfect" | "long";
export type OverallFit = "tight" | "regular" | "relaxed" | "oversized";

export type FitAnalysis = {
  chestFit: ChestFit;
  lengthFit: LengthFit;
  shoulderFit: ShoulderFit;
  sleeveFit: SleeveFit;
  overall: OverallFit;
};

export type FitGenerationStatus = "success" | "partial" | "pending" | "error";

export type FitGenerationResponse = {
  status: FitGenerationStatus;
  fitResult: FitResult;
  fitAnalysis: FitAnalysis;
  prompt: string;
  imageUrl: string | null;
  message?: string;
};
