// ─── BUILD FIT EXPLANATION ──────────────────────────────────────────────────
// Size-aware, deterministic, human-readable. Different per size.
//
// Returns a short headline + one-paragraph explanation that visibly
// changes between S / M / L / XL based on the GarmentFitMap silhouette
// and ease coordinates.

import type { GarmentFitMap } from "./buildGarmentFitMap";
import type { BodyProfile } from "./buildBodyProfile";

export interface FitExplanationOut {
  headline: string;        // e.g. "Trim fit through chest and waist"
  paragraph: string;       // 1–2 sentences, size-explicit
  silhouetteLabel: string; // TRIM | FITTED | REGULAR | RELAXED | OVERSIZED
}

const SILHOUETTE_LABEL: Record<string, string> = {
  trim: "TRIM",
  fitted: "FITTED",
  regular: "REGULAR",
  relaxed: "RELAXED",
  oversized: "OVERSIZED",
};

const HEADLINES: Record<string, string> = {
  trim:      "Trim, body-skimming silhouette",
  fitted:    "Clean fitted silhouette",
  regular:   "Balanced regular fit",
  relaxed:   "Relaxed fit with soft volume",
  oversized: "Oversized drop-shoulder silhouette",
};

function chestPhrase(e: number, isBottom: boolean) {
  if (isBottom) return "";
  if (e <= 0.03) return "closer through the chest";
  if (e <= 0.07) return "natural room through the chest";
  if (e <= 0.12) return "visible chest room";
  return "generous chest volume";
}

function waistPhrase(e: number) {
  if (e <= 0.03) return "tighter at the waist";
  if (e <= 0.07) return "clean waist line";
  if (e <= 0.12) return "softer waist line";
  return "loose, flowing waist";
}

function shoulderPhrase(d: number, isBottom: boolean) {
  if (isBottom) return "";
  if (d <= 0.01) return "structured shoulders";
  if (d <= 0.04) return "slight shoulder drop";
  return "pronounced shoulder drop";
}

function lengthPhrase(d: number) {
  if (d <= -0.02) return "shorter hem";
  if (d >= 0.04) return "longer hem";
  if (d >= 0.02) return "slightly longer hem";
  return "regular hem length";
}

function sleevePhrase(v: number, d: number, isBottom: boolean) {
  if (isBottom) return "";
  if (v <= 0.03) return "tighter sleeves";
  if (v >= 0.10) return "looser, dropped sleeves";
  if (d >= 0.02) return "slightly longer sleeves";
  return "natural sleeve volume";
}

export function buildFitExplanation(args: {
  fit: GarmentFitMap;
  body: BodyProfile;
  size: string;
}): FitExplanationOut {
  const { fit, size } = args;
  const isBottom = fit.category === "bottom";

  const parts = [
    chestPhrase(fit.chestEase, isBottom),
    waistPhrase(fit.waistEase),
    shoulderPhrase(fit.shoulderDrop, isBottom),
    lengthPhrase(fit.bodyLengthDelta),
    sleevePhrase(fit.sleeveVolume, fit.sleeveLengthDelta, isBottom),
  ].filter(Boolean);

  const head = HEADLINES[fit.silhouetteType] ?? "Balanced fit";
  const paragraph =
    `Size ${size} creates a ${fit.silhouetteType} silhouette — ${parts.slice(0, 3).join(", ")}` +
    (parts.length > 3 ? `, with ${parts.slice(3).join(" and ")}.` : ".");

  return {
    headline: head,
    paragraph,
    silhouetteLabel: SILHOUETTE_LABEL[fit.silhouetteType] ?? "REGULAR",
  };
}

// ── Friendly per-region labels for the breakdown card ─────────────────────

export type RegionLabel = "Snug" | "Balanced" | "Roomy" | "Structured" | "Dropped"
  | "Short" | "Regular" | "Long" | "Tight" | "Natural" | "Loose" | "Clean" | "Relaxed";

export interface FitBreakdown {
  chest: RegionLabel;
  waist: RegionLabel;
  shoulder: RegionLabel;
  length: RegionLabel;
  sleeve: RegionLabel;
}

export function buildFitBreakdown(fit: GarmentFitMap): FitBreakdown {
  const chest: RegionLabel =
    fit.chestEase <= 0.03 ? "Snug" : fit.chestEase >= 0.12 ? "Roomy" : "Balanced";

  const waist: RegionLabel =
    fit.waistEase <= 0.03 ? "Clean" : fit.waistEase >= 0.10 ? "Relaxed" : "Balanced";

  const shoulder: RegionLabel =
    fit.shoulderDrop >= 0.04 ? "Dropped" : "Structured";

  const length: RegionLabel =
    fit.bodyLengthDelta <= -0.02 ? "Short" : fit.bodyLengthDelta >= 0.04 ? "Long" : "Regular";

  const sleeve: RegionLabel =
    fit.sleeveVolume <= 0.03 ? "Tight" : fit.sleeveVolume >= 0.10 ? "Loose" : "Natural";

  return { chest, waist, shoulder, length, sleeve };
}
