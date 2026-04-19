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
  if (bmi < 21) return "slim";       // 170/60 → 20.8 → slim
  if (bmi >= 25) return "broad";     // 180/85 → 26.2 → broad
  return "regular";                  // 175/70 → 22.9 → regular
}

export function normalizeBodyProfile(input: {
  heightCm: number;
  weightKg?: number | null;
  shoulderWidthCm?: number | null;
  waistCm?: number | null;
  chestCm?: number | null;
  inseamCm?: number | null;
}): NormalizedBodyProfile {
  const weightKg = input.weightKg ?? null;
  const bmi = computeBmi(input.heightCm, weightKg);
  const frame = computeFrame(bmi);

  // Diagnostic log — height/weight/bmi/frame, every normalization
  if (typeof console !== "undefined") {
    console.debug("[fit/bodyProfile]", {
      height: input.heightCm,
      weight: weightKg,
      bmi,
      frame,
    });
  }

  return {
    heightCm: input.heightCm,
    weightKg,
    bmi,
    frame,
    hasManualShoulder: !!input.shoulderWidthCm,
    hasManualWaist: !!input.waistCm,
    hasManualChest: !!input.chestCm,
    hasManualInseam: !!input.inseamCm,
  };
}

/** Validate weight is in plausible adult range. */
export function isValidWeight(weightKg: number | null | undefined): boolean {
  return typeof weightKg === "number" && weightKg >= 40 && weightKg <= 120;
}
