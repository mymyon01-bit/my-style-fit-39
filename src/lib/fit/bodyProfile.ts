// ─── BODY PROFILE NORMALIZATION ─────────────────────────────────────────────
// Honest, deterministic. Never invents chest/waist if not provided.
// Only derives high-level signals (BMI, frame) from height + weight.

export type FrameType = "slim" | "regular" | "broad";

export interface NormalizedBodyProfile {
  heightCm: number;
  weightKg: number | null;
  bmi: number | null;
  frame: FrameType;
  // What the user actually provided (vs estimated)
  hasManualShoulder: boolean;
  hasManualWaist: boolean;
  hasManualChest: boolean;
  hasManualInseam: boolean;
}

export function computeBmi(heightCm: number, weightKg: number | null): number | null {
  if (!weightKg || !heightCm) return null;
  const m = heightCm / 100;
  return Math.round((weightKg / (m * m)) * 10) / 10;
}

export function computeFrame(bmi: number | null): FrameType {
  if (bmi == null) return "regular";
  if (bmi < 20) return "slim";
  if (bmi >= 26) return "broad";
  return "regular";
}

export function normalizeBodyProfile(input: {
  heightCm: number;
  weightKg?: number | null;
  shoulderWidthCm?: number | null;
  waistCm?: number | null;
  chestCm?: number | null;
  inseamCm?: number | null;
}): NormalizedBodyProfile {
  const bmi = computeBmi(input.heightCm, input.weightKg ?? null);
  return {
    heightCm: input.heightCm,
    weightKg: input.weightKg ?? null,
    bmi,
    frame: computeFrame(bmi),
    hasManualShoulder: !!input.shoulderWidthCm,
    hasManualWaist: !!input.waistCm,
    hasManualChest: !!input.chestCm,
    hasManualInseam: !!input.inseamCm,
  };
}
