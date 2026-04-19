// Map user body profile fields to avatar mesh morph values.
// All outputs are dimensionless scene-unit multipliers (~around 1.0).

export interface UserBody {
  heightCm?: number | null;
  weightKg?: number | null;
  shoulderWidthCm?: number | null;
  chestCm?: number | null;
  waistCm?: number | null;
  inseamCm?: number | null;
}

export interface AvatarMorph {
  heightScale: number;   // overall vertical scale
  torsoWidth: number;    // chest barrel width
  shoulderWidth: number; // shoulder span
  waistWidth: number;    // waist taper
  hipWidth: number;
  legLength: number;     // leg vertical scale
}

const DEFAULT: AvatarMorph = {
  heightScale: 1,
  torsoWidth: 1,
  shoulderWidth: 1,
  waistWidth: 1,
  hipWidth: 1,
  legLength: 1,
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function bodyToAvatar(body?: UserBody | null): AvatarMorph {
  if (!body) return DEFAULT;

  const height = body.heightCm ?? 172;
  const weight = body.weightKg ?? 68;
  const shoulder = body.shoulderWidthCm ?? 44;
  const chest = body.chestCm ?? 96;
  const waist = body.waistCm ?? 80;
  const inseam = body.inseamCm ?? 78;

  // Reference body: 172 cm, 68 kg, 44 cm shoulder, 96 cm chest, 80 cm waist, 78 cm inseam
  const heightScale = clamp(height / 172, 0.9, 1.12);
  const shoulderWidth = clamp(shoulder / 44, 0.85, 1.18);
  const torsoWidth = clamp((chest / 96) * (1 + (weight - 68) / 220), 0.85, 1.25);
  const waistWidth = clamp(waist / 80, 0.82, 1.28);
  const hipWidth = clamp((waist / 80) * 1.04, 0.85, 1.28);
  const legLength = clamp(inseam / 78, 0.9, 1.12);

  return { heightScale, torsoWidth, shoulderWidth, waistWidth, hipWidth, legLength };
}
