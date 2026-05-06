// ─── FIT PHYSICS — V3.6 ────────────────────────────────────────────────────
// Combines Body DNA + Garment DNA + per-region delta into a structured set
// of "visual instructions" the AI prompt layer can drop in directly.
//
// FIT DELTA = GARMENT MEASUREMENT - BODY MEASUREMENT
//   negative → tension (fabric pulled, stretched)
//   positive → drape  (fabric loose, folds, gravity)
//
// All thresholds in cm.

import type { GarmentDNA, Level3 } from "./garmentDNA";

export type FitLabel =
  | "too-tight" | "tight" | "regular" | "relaxed" | "oversized" | "too-oversized";

export interface RegionDeltaInput {
  region: string;        // "chest" | "waist" | "hip" | "shoulder" | "sleeve" | "thigh" | "inseam" | "rise" | ...
  bodyCm: number | null;
  garmentCm: number | null;
}

export interface RegionPhysics {
  region: string;
  deltaCm: number | null;
  fitLabel: FitLabel;
  /** 0–100 — higher = more fabric tension (negative delta → high). */
  tensionScore: number;
  /** Plain-English instruction tuned by garment fabric/stiffness. */
  visualInstruction: string;
}

function classify(deltaCm: number | null): FitLabel {
  if (deltaCm == null) return "regular";
  if (deltaCm < -4) return "too-tight";
  if (deltaCm < 0)  return "tight";
  if (deltaCm <= 4) return "regular";
  if (deltaCm <= 9) return "relaxed";
  if (deltaCm <= 16) return "oversized";
  return "too-oversized";
}

function scoreTension(deltaCm: number | null): number {
  if (deltaCm == null) return 50;
  // -8cm → 100, +16cm → 0, linear in between.
  const clamped = Math.max(-8, Math.min(16, deltaCm));
  return Math.round(((-clamped + 16) / 24) * 100);
}

const LEVEL_TO_WORD: Record<Level3, string> = {
  low: "soft", medium: "natural", high: "pronounced",
};

function wrinkleWord(d: GarmentDNA): string {
  if (d.stiffness === "high") return "sharp folds";
  if (d.elasticity === "high") return "smooth body-following stretch";
  if (d.drapeLevel === "high") return "flowing folds";
  return "soft wrinkles";
}

function tightInstruction(region: string, d: GarmentDNA): string {
  if (d.elasticity === "high") {
    return `${region}: fabric stretches snugly across the body with smooth body-hugging tension and no folds`;
  }
  if (d.stiffness === "high") {
    return `${region}: visible pulling and sharp tension creases — fabric resists stretching`;
  }
  return `${region}: visible horizontal stretch lines and fabric pulled tight against the body`;
}

function looseInstruction(region: string, d: GarmentDNA, magnitude: "relaxed" | "oversized"): string {
  const folds = wrinkleWord(d);
  const dropped = d.shoulderStructure === "dropped" || magnitude === "oversized"
    ? " with shoulder seams sitting past the natural shoulder"
    : "";
  if (magnitude === "oversized") {
    return `${region}: roomy silhouette with extra fabric, ${folds}, gravity-driven drape${dropped}`;
  }
  return `${region}: small amount of extra room with ${folds} and balanced drape`;
}

function instruction(region: string, label: FitLabel, d: GarmentDNA): string {
  switch (label) {
    case "too-tight":      return tightInstruction(region, d) + " — fabric is at its limit";
    case "tight":          return tightInstruction(region, d);
    case "regular":        return `${region}: clean balanced fit with ${LEVEL_TO_WORD[d.drapeLevel]} drape and no tension`;
    case "relaxed":        return looseInstruction(region, d, "relaxed");
    case "oversized":      return looseInstruction(region, d, "oversized");
    case "too-oversized":  return looseInstruction(region, d, "oversized") + " — clearly too large";
  }
}

export function computeRegionPhysics(input: RegionDeltaInput, dna: GarmentDNA): RegionPhysics {
  const delta = (input.bodyCm != null && input.garmentCm != null)
    ? Math.round((input.garmentCm - input.bodyCm) * 10) / 10
    : null;
  const fitLabel = classify(delta);
  return {
    region: input.region,
    deltaCm: delta,
    fitLabel,
    tensionScore: scoreTension(delta),
    visualInstruction: instruction(input.region, fitLabel, dna),
  };
}

/** Build a compact ordered list of instructions for the prompt. */
export function buildVisualInstructionLines(
  regions: RegionPhysics[],
  dna: GarmentDNA,
): string[] {
  const lines = regions
    .filter((r) => r.fitLabel !== "regular")
    .map((r) => `• ${r.visualInstruction}`);
  if (lines.length === 0) {
    lines.push(`• overall: balanced ${dna.intendedFit} fit with ${LEVEL_TO_WORD[dna.drapeLevel]} drape`);
  }
  return lines;
}

/** A single high-level analysis sentence per size — used by the result page. */
export function describeOverallFit(label: FitLabel, dna: GarmentDNA, sizeLabel: string): string {
  const fabric = dna.fabricType !== "unknown" ? dna.fabricType : "fabric";
  switch (label) {
    case "too-tight":
      return `Size ${sizeLabel} creates high chest and waist tension. Shoulder seams pull outward. Recommended only if you specifically want a compressed fit.`;
    case "tight":
      return `Size ${sizeLabel} reads as a snug fit with mild stretch lines across the chest. Wearable, but not relaxed.`;
    case "regular":
      return `Size ${sizeLabel} gives a balanced fit with clean shoulder alignment and comfortable torso room.`;
    case "relaxed":
      return `Size ${sizeLabel} creates a relaxed silhouette with extra room across the chest and waist; ${fabric} drapes naturally.`;
    case "oversized":
      return `Size ${sizeLabel} reads oversized — extra sleeve volume, dropped shoulder line, and visible torso drape.`;
    case "too-oversized":
      return `Size ${sizeLabel} is clearly too large — fabric pools at the hem and shoulders sit well past the natural line.`;
  }
}
