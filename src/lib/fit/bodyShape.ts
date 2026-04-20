// ─── BODY SHAPE INPUTS ──────────────────────────────────────────────────────
// Simplified user-facing selections (no raw cm). Each maps to a normalized
// scale (clamped 0.85–1.15) that biases the BodyProfile and GarmentFitMap.

export type ShoulderType = "narrow" | "average" | "wide";
export type ChestBuild  = "flat" | "normal" | "full";
export type WaistShape  = "slim" | "straight" | "thick";
export type ArmThickness = "thin" | "normal" | "thick";
export type LegBuild    = "slim" | "normal" | "thick";

export interface BodyShapeInput {
  shoulderType?: ShoulderType;
  chestBuild?: ChestBuild;
  waistShape?: WaistShape;
  armThickness?: ArmThickness;
  legBuild?: LegBuild;
}

export interface BodyShapeScales {
  shoulderWidthScale: number;
  chestScale: number;
  waistScale: number;
  armScale: number;
  legScale: number;
}

const clamp = (n: number) => Math.max(0.85, Math.min(1.15, n));

const SHOULDER: Record<ShoulderType, number> = { narrow: 0.93, average: 1.0,  wide: 1.07 };
const CHEST:    Record<ChestBuild,   number> = { flat: 0.95,    normal: 1.0,  full: 1.06 };
const WAIST:    Record<WaistShape,   number> = { slim: 0.92,    straight: 1.0, thick: 1.08 };
const ARM:      Record<ArmThickness, number> = { thin: 0.94,    normal: 1.0,  thick: 1.08 };
const LEG:      Record<LegBuild,     number> = { slim: 0.95,    normal: 1.0,  thick: 1.08 };

/**
 * Convert simple shape selections into normalized scales (0.85–1.15).
 * Missing fields default to 1.0 (neutral).
 */
export function buildBodyShapeScales(input: BodyShapeInput | null | undefined): BodyShapeScales {
  return {
    shoulderWidthScale: clamp(SHOULDER[input?.shoulderType ?? "average"]),
    chestScale:         clamp(CHEST[input?.chestBuild     ?? "normal"]),
    waistScale:         clamp(WAIST[input?.waistShape     ?? "straight"]),
    armScale:           clamp(ARM[input?.armThickness     ?? "normal"]),
    legScale:           clamp(LEG[input?.legBuild         ?? "normal"]),
  };
}
