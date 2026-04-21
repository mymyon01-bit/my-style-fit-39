// ─── Module A — UserBodyProfile ───────────────────────────────────────────────
// Thin module: validates / merges measurements + preference into a clean
// UserBodyProfile that the rest of the pipeline can rely on.

import type { UserBodyProfile, PreferredFit, GenderPresentation } from "./types";

export const DEFAULT_BODY_PROFILE: UserBodyProfile = {
  genderPresentation: "neutral",
  heightCm: 175,
  weightKg: 70,
  shoulderCm: 45,
  chestCm: 96,
  waistCm: 80,
  hipCm: 96,
  armLengthCm: 60,
  inseamCm: 80,
  preferredFit: "regular",
  bodyShape: null,
};

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export function buildUserBodyProfile(input: Partial<UserBodyProfile>): UserBodyProfile {
  const merged: UserBodyProfile = { ...DEFAULT_BODY_PROFILE, ...input };
  // sanity bounds — refuse impossible values silently rather than throwing
  merged.heightCm = clamp(merged.heightCm, 130, 220);
  merged.weightKg = clamp(merged.weightKg, 35, 180);
  merged.shoulderCm = clamp(merged.shoulderCm, 30, 60);
  merged.chestCm = clamp(merged.chestCm, 70, 150);
  merged.waistCm = clamp(merged.waistCm, 55, 140);
  merged.hipCm = clamp(merged.hipCm, 70, 160);
  merged.armLengthCm = clamp(merged.armLengthCm, 45, 80);
  merged.inseamCm = clamp(merged.inseamCm, 60, 100);
  return merged;
}

export function bodySignature(b: UserBodyProfile): string {
  // 1cm-rounded fingerprint used by the generation cache key.
  const r = (n: number) => Math.round(n);
  return [
    b.genderPresentation,
    b.preferredFit,
    r(b.heightCm),
    r(b.weightKg),
    r(b.shoulderCm),
    r(b.chestCm),
    r(b.waistCm),
    r(b.hipCm),
    r(b.armLengthCm),
    r(b.inseamCm),
  ].join("|");
}

export function describeBuild(b: UserBodyProfile): string {
  const bmi = b.weightKg / Math.pow(b.heightCm / 100, 2);
  const tone =
    bmi < 19 ? "slim"
    : bmi < 23 ? "lean"
    : bmi < 27 ? "average"
    : bmi < 31 ? "stocky"
    : "broad";
  const heightTone = b.heightCm < 165 ? "shorter" : b.heightCm > 185 ? "tall" : "average-height";
  const gender =
    b.genderPresentation === "feminine" ? "feminine"
    : b.genderPresentation === "masculine" ? "masculine"
    : "neutral";
  return `${heightTone} ${tone} ${gender} build`;
}

export const FIT_PREFERENCE_LABEL: Record<PreferredFit, string> = {
  slim: "fitted",
  regular: "true-to-size",
  relaxed: "relaxed",
  oversized: "oversized",
};

export const GENDER_LABEL: Record<GenderPresentation, string> = {
  feminine: "feminine",
  masculine: "masculine",
  neutral: "androgynous",
};
