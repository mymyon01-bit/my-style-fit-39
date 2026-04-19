// ─── VISUAL FIT ENGINE ──────────────────────────────────────────────────────
// "Fake 3D but looks real" — pure CSS transform values driven by garment vs
// body deltas. NO heavy rendering, NO uncanny human models. Smooth, fast.
//
// Each region of a SizeFitResult exposes a `delta` (garment cm - body cm).
// We translate deltas → scaleX (chest/waist), translateY (length), rotate
// (taper) into a single `Transform` object the VisualFitCard can apply.

import type { SizeFitResult, RegionFit } from "@/lib/fitEngine";
import type { NormalizedBodyProfile } from "@/lib/fit/bodyProfile";

export interface VisualTransform {
  /** garment width scale — 1.0 = neutral, >1 looser, <1 tighter */
  scaleX: number;
  /** garment height scale — small range; longer hem makes garment slightly taller */
  scaleY: number;
  /** vertical drop in px — positive = hem hangs lower */
  translateY: number;
  /** subtle taper at waist via skewY-like rotation in deg */
  waistTaper: number;
  /** mannequin shoulder width factor based on body frame & ratio */
  bodyShoulderScale: number;
  /** mannequin torso height factor */
  bodyTorsoScale: number;
  /** label of fit feel — drives style context bullet */
  feel: "tight" | "snug" | "true-to-size" | "relaxed" | "oversized" | "loose";
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function findRegion(regions: RegionFit[], name: string): RegionFit | undefined {
  return regions.find(r => r.region === name);
}

/**
 * Compute a visual transform for a chosen size against a normalized body.
 * - Width is driven by chest/waist deltas (positive delta = looser → wider).
 * - Length is driven by Length/Inseam deltas (positive = longer hem).
 * - Taper comes from chest vs waist delta differential.
 */
export function computeVisualTransform(
  size: SizeFitResult,
  profile: NormalizedBodyProfile | null,
): VisualTransform {
  const chest = findRegion(size.regions, "Chest");
  const waist = findRegion(size.regions, "Waist");
  const hip = findRegion(size.regions, "Hip");
  const length = findRegion(size.regions, "Length") ?? findRegion(size.regions, "Inseam");

  // Width driver: average of chest/waist (or hip for bottoms). Each ±10cm ≈ ±10% scale.
  const widthDeltas = [chest?.delta, waist?.delta, hip?.delta].filter(
    (v): v is number => typeof v === "number",
  );
  const widthDelta = widthDeltas.length
    ? widthDeltas.reduce((a, b) => a + b, 0) / widthDeltas.length
    : 0;
  const scaleX = clamp(1 + widthDelta * 0.012, 0.86, 1.22);

  // Length driver: Length/Inseam delta. Each +4cm ≈ +6px hem drop, +2% scaleY.
  const lengthDelta = length?.delta ?? 0;
  const translateY = clamp(lengthDelta * 1.6, -14, 22);
  const scaleY = clamp(1 + lengthDelta * 0.008, 0.94, 1.10);

  // Taper: if chest looser than waist by a lot → strong taper (fitted shape).
  // If both equally loose → boxy (no taper).
  const taperRaw = (chest?.delta ?? 0) - (waist?.delta ?? 0);
  const waistTaper = clamp(taperRaw * 0.25, -3, 3); // small degrees

  // Body proportions from frame
  const frame = profile?.frame ?? "regular";
  const bodyShoulderScale =
    frame === "broad" ? 1.08 : frame === "slim" ? 0.94 : 1.00;
  const bodyTorsoScale =
    frame === "broad" ? 1.04 : frame === "slim" ? 0.97 : 1.00;

  // Feel label
  let feel: VisualTransform["feel"] = "true-to-size";
  if (widthDelta < -4) feel = "tight";
  else if (widthDelta < -1) feel = "snug";
  else if (widthDelta > 12) feel = "oversized";
  else if (widthDelta > 7) feel = "loose";
  else if (widthDelta > 3) feel = "relaxed";

  return {
    scaleX,
    scaleY,
    translateY,
    waistTaper,
    bodyShoulderScale,
    bodyTorsoScale,
    feel,
  };
}

/**
 * Generate a styling context line — what this fit is best for.
 * Differentiator: WARDROBE explains *style use*, not just measurements.
 */
export function buildStyleContext(
  feel: VisualTransform["feel"],
  category: string,
): { tone: "good" | "warn" | "neutral"; line: string } {
  const isTop = category === "tops" || category === "outerwear";
  switch (feel) {
    case "tight":
      return {
        tone: "warn",
        line: isTop
          ? "May feel restrictive — better suited for layering pieces a size up."
          : "Runs tight — consider sizing up if you prefer mobility.",
      };
    case "snug":
      return {
        tone: "neutral",
        line: isTop
          ? "Fitted silhouette — works for tucked-in, minimal looks."
          : "Body-skimming cut — pairs well with fitted tops.",
      };
    case "true-to-size":
      return {
        tone: "good",
        line: isTop
          ? "Balanced shape — versatile for everyday and smart casual."
          : "True to size — works across casual and dressed-up looks.",
      };
    case "relaxed":
      return {
        tone: "good",
        line: isTop
          ? "Easy relaxed line — great for clean casual and layered street."
          : "Relaxed cut — pairs naturally with sneakers or chunky shoes.",
      };
    case "loose":
      return {
        tone: "neutral",
        line: isTop
          ? "Loose drop — best for minimal street or oversized layered styling."
          : "Loose silhouette — best for street-leaning looks.",
      };
    case "oversized":
      return {
        tone: "warn",
        line: isTop
          ? "Strong oversized drop — may feel too loose for formal contexts."
          : "Wide silhouette — leans into bold, intentional oversized styling.",
      };
  }
}
