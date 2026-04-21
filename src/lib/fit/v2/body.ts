import type { BodyMeasurements } from "./types";

// Estimate ideal garment length for a given body height.
// Rough heuristic: a t-shirt/top sits at ~40% of body height.
export function idealLength(heightCm: number): number {
  return Math.round(heightCm * 0.4);
}

export function describeBuild(b: BodyMeasurements): string {
  const bmi = b.weight / Math.pow(b.height / 100, 2);
  if (bmi < 19) return "slim";
  if (bmi < 24) return "regular";
  if (bmi < 28) return "athletic";
  return "broad";
}

export function validateBody(b: Partial<BodyMeasurements>): b is BodyMeasurements {
  return (
    typeof b.height === "number" && b.height > 0 &&
    typeof b.weight === "number" && b.weight > 0 &&
    typeof b.chest === "number" && b.chest > 0 &&
    typeof b.waist === "number" && b.waist > 0 &&
    typeof b.hips === "number" && b.hips > 0 &&
    typeof b.shoulder === "number" && b.shoulder > 0 &&
    typeof b.armLength === "number" && b.armLength > 0
  );
}

export const DEFAULT_BODY: BodyMeasurements = {
  height: 175,
  weight: 70,
  chest: 94,
  waist: 80,
  hips: 96,
  shoulder: 45,
  armLength: 61,
};
