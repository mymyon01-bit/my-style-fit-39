import type { BodyMeasurements, GarmentMeasurements, FitResult } from "./types";
import { idealLength } from "./body";

// Pure deterministic math. No AI. No randomness.
export function calculateFit(
  body: BodyMeasurements,
  garment: GarmentMeasurements
): FitResult {
  return {
    chestDiff: round(garment.chest - body.chest),
    shoulderDiff: round(garment.shoulder - body.shoulder),
    lengthDiff: round(garment.length - idealLength(body.height)),
    sleeveDiff: round(garment.sleeve - body.armLength),
  };
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}
