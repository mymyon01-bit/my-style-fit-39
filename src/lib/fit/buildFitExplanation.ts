// ─── BUILD FIT EXPLANATION ──────────────────────────────────────────────────
// Size-aware, deterministic, human-readable. Different per size.
//
// Now sourced from SolverResult region labels so the text NEVER contradicts
// the visual: if the canvas shows a dropped shoulder + long hem, the copy
// says "dropped shoulder + longer body".

import type { GarmentFitMap } from "./buildGarmentFitMap";
import type { BodyProfile } from "./buildBodyProfile";
import type { SolverResult } from "./fitSolver";

export interface FitExplanationOut {
  headline: string;
  paragraph: string;
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

// ── Region → phrase (sourced from solver labels, not raw eases) ───────────

function chestPhrase(fit: SolverResult["regions"]["chest"]["fit"], isBottom: boolean) {
  if (isBottom) return "";
  switch (fit) {
    case "tight":     return "tighter through the chest";
    case "snug":      return "a closer chest line";
    case "balanced":  return "natural room through the chest";
    case "roomy":     return "visible chest room";
    case "oversized": return "generous chest volume";
  }
}

function waistPhrase(fit: SolverResult["regions"]["waist"]["fit"]) {
  switch (fit) {
    case "tight":    return "a tighter waist line";
    case "clean":    return "a clean waist line";
    case "balanced": return "a natural waist line";
    case "relaxed":  return "a softer waist line";
    case "loose":    return "a loose, flowing waist";
  }
}

function shoulderPhrase(fit: SolverResult["regions"]["shoulder"]["fit"], isBottom: boolean) {
  if (isBottom) return "";
  switch (fit) {
    case "pulled":     return "shoulders pulled tight";
    case "structured": return "structured shoulders";
    case "natural":    return "a natural shoulder line";
    case "dropped":    return "a dropped shoulder line";
  }
}

function lengthPhrase(fit: SolverResult["regions"]["length"]["fit"]) {
  switch (fit) {
    case "short":          return "a noticeably shorter body";
    case "slightly_short": return "a slightly shorter body";
    case "regular":        return "regular hem length";
    case "slightly_long":  return "a slightly longer hem";
    case "long":           return "a longer hem";
  }
}

function sleevePhrase(fit: SolverResult["regions"]["sleeve"]["fit"], isBottom: boolean) {
  if (isBottom) return "";
  switch (fit) {
    case "tight":   return "tighter sleeves";
    case "trim":    return "trim sleeves";
    case "regular": return "natural sleeve volume";
    case "loose":   return "looser, dropped sleeves";
  }
}

export function buildFitExplanation(args: {
  fit: GarmentFitMap;
  body: BodyProfile;
  size: string;
  /** Solver result is the source of truth — pass it whenever available. */
  solver?: SolverResult;
}): FitExplanationOut {
  const { fit, size, solver } = args;
  const isBottom = fit.category === "bottom";

  // Prefer solver labels for stability with the visual.
  const parts: string[] = [];
  if (solver) {
    const r = solver.regions;
    parts.push(
      chestPhrase(r.chest.fit, isBottom),
      waistPhrase(r.waist.fit),
      shoulderPhrase(r.shoulder.fit, isBottom),
      lengthPhrase(r.length.fit),
      sleevePhrase(r.sleeve.fit, isBottom),
    );
  } else {
    // Legacy fallback (eases) — kept for callers that haven't migrated.
    if (!isBottom) parts.push(fit.chestEase <= 0.04 ? "a closer chest line" : "natural chest room");
    parts.push(fit.waistEase <= 0.04 ? "a clean waist line" : "a softer waist line");
    if (!isBottom) parts.push(fit.shoulderDrop >= 0.04 ? "a dropped shoulder line" : "structured shoulders");
    parts.push(fit.bodyLengthDelta >= 0.025 ? "a longer hem" : "regular hem length");
    if (!isBottom) parts.push(fit.sleeveVolume >= 0.09 ? "looser sleeves" : "natural sleeve volume");
  }

  const cleaned = parts.filter((p) => p && p.length > 0);

  const head = HEADLINES[fit.silhouetteType] ?? "Balanced fit";
  const lead =
    fit.silhouetteType === "trim"      ? `Size ${size} runs cleaner`
    : fit.silhouetteType === "fitted"  ? `Size ${size} keeps a clean line`
    : fit.silhouetteType === "relaxed" ? `Size ${size} adds visible room`
    : fit.silhouetteType === "oversized" ? `Size ${size} reads clearly oversized`
    : `Size ${size} keeps a balanced silhouette`;

  const joined =
    cleaned.length === 0 ? "with a clean overall line."
    : cleaned.length === 1 ? `with ${cleaned[0]}.`
    : cleaned.length === 2 ? `with ${cleaned[0]} and ${cleaned[1]}.`
    : `with ${cleaned.slice(0, -1).join(", ")} and ${cleaned.slice(-1)}.`;

  return {
    headline: head,
    paragraph: `${lead} ${joined}`,
    silhouetteLabel: SILHOUETTE_LABEL[fit.silhouetteType] ?? "REGULAR",
  };
}

// ── Friendly per-region labels for the breakdown card (legacy export) ─────

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
