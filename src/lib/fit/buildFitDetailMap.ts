// ─── FIT DETAIL MAP ─────────────────────────────────────────────────────────
// Maps deterministic SolverResult region labels into VISUAL detail values
// the canvas compositor uses for non-uniform warping, shoulder drop, hem
// rise/drop, and subtle wrinkle / drape overlays.
//
// All values are stable numbers (0..1 tensions, pixel deltas) so:
//   • S vs M vs L vs XL produce visibly different overlays
//   • The AI refiner can read the same numbers and preserve them
//   • Failure of any individual detail pass never breaks the composite
//
// IMPORTANT: keep this layer additive. If a value is missing or invalid,
// the compositor falls back to neutral (no warp, no wrinkles).

import type { SolverResult } from "./fitSolver";
import type { BodyFrame } from "./buildBodyFrame";

export type WrinkleZone = "chest" | "waist" | "shoulder" | "sleeve" | "hem";
export type WrinkleDirection = "horizontal" | "diagonal" | "vertical";

export interface WrinkleSpec {
  zone: WrinkleZone;
  /** 0..1 — how strong the tension lines / folds should render */
  intensity: number;
  direction: WrinkleDirection;
}

export interface FitDetailMap {
  // ── Tension scalars (0..1) ───────────────────────────────────────────────
  chestTension: number;
  waistTension: number;
  shoulderPull: number;
  sleeveTension: number;
  /** 0..1 — how much soft drape (vertical folds) to render. */
  drapeAmount: number;

  // ── Geometry deltas in PIXELS, applied on top of overlay map ─────────────
  /** Positive = seam drops past natural shoulder onto upper arm. */
  shoulderDropPx: number;
  /** Positive = hem rises (shorter visible body). */
  hemRisePx: number;
  /** Positive = hem extends down past base. */
  hemDropPx: number;

  // ── Non-uniform width scalers (multipliers, ~0.92..1.18) ─────────────────
  /** Width multiplier at chest line on top of solver chest scale. */
  chestWidthMul: number;
  /** Width multiplier at waist line. */
  waistWidthMul: number;
  /** Width multiplier at hem line. */
  hemWidthMul: number;
  /** Sleeve width multiplier (volume). */
  sleeveWidthMul: number;

  // ── Wrinkle / drape spec list ────────────────────────────────────────────
  wrinkleZones: WrinkleSpec[];

  // ── Echo for AI prompt + debug ───────────────────────────────────────────
  silhouetteLabel: "TRIM" | "FITTED" | "REGULAR" | "RELAXED" | "OVERSIZED";
}

// ── Helpers ────────────────────────────────────────────────────────────────

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

// ── Region → tension / geometry contributions ──────────────────────────────

function chestContribution(fit: SolverResult["regions"]["chest"]["fit"]) {
  switch (fit) {
    case "tight":     return { tension: 0.85, widthMul: 0.94, drape: 0.0 };
    case "snug":      return { tension: 0.55, widthMul: 0.97, drape: 0.05 };
    case "balanced":  return { tension: 0.15, widthMul: 1.00, drape: 0.15 };
    case "roomy":     return { tension: 0.05, widthMul: 1.06, drape: 0.35 };
    case "oversized": return { tension: 0.02, widthMul: 1.12, drape: 0.55 };
  }
}

function waistContribution(fit: SolverResult["regions"]["waist"]["fit"]) {
  switch (fit) {
    case "tight":     return { tension: 0.80, widthMul: 0.93, drape: 0.0 };
    case "clean":     return { tension: 0.45, widthMul: 0.97, drape: 0.05 };
    case "balanced":  return { tension: 0.12, widthMul: 1.00, drape: 0.12 };
    case "relaxed":   return { tension: 0.05, widthMul: 1.05, drape: 0.30 };
    case "loose":     return { tension: 0.02, widthMul: 1.12, drape: 0.50 };
  }
}

function shoulderContribution(fit: SolverResult["regions"]["shoulder"]["fit"]) {
  switch (fit) {
    case "pulled":     return { pull: 0.85, dropPx: -8 };
    case "structured": return { pull: 0.20, dropPx: 0 };
    case "natural":    return { pull: 0.10, dropPx: 8 };
    case "dropped":    return { pull: 0.05, dropPx: 32 };
  }
}

function sleeveContribution(fit: SolverResult["regions"]["sleeve"]["fit"]) {
  switch (fit) {
    case "tight":   return { tension: 0.75, widthMul: 0.90 };
    case "trim":    return { tension: 0.40, widthMul: 0.96 };
    case "regular": return { tension: 0.10, widthMul: 1.00 };
    case "loose":   return { tension: 0.02, widthMul: 1.15 };
  }
}

function lengthContribution(fit: SolverResult["regions"]["length"]["fit"]) {
  // Positive → drop hem; negative → rise hem.
  switch (fit) {
    case "short":          return { hemRise: 38, hemDrop: 0 };
    case "slightly_short": return { hemRise: 16, hemDrop: 0 };
    case "regular":        return { hemRise: 0,  hemDrop: 0 };
    case "slightly_long":  return { hemRise: 0,  hemDrop: 18 };
    case "long":           return { hemRise: 0,  hemDrop: 42 };
  }
}

function silhouetteLabel(s: SolverResult["silhouette"]): FitDetailMap["silhouetteLabel"] {
  switch (s) {
    case "trim":      return "TRIM";
    case "fitted":    return "FITTED";
    case "relaxed":   return "RELAXED";
    case "oversized": return "OVERSIZED";
    default:          return "REGULAR";
  }
}

// ── Public builder ─────────────────────────────────────────────────────────

export function buildFitDetailMap(args: {
  solver: SolverResult;
  frame: BodyFrame;
  isBottom: boolean;
}): FitDetailMap {
  const { solver, isBottom } = args;
  const r = solver.regions;

  const chest    = chestContribution(r.chest.fit);
  const waist    = waistContribution(r.waist.fit);
  const shoulder = isBottom ? { pull: 0, dropPx: 0 } : shoulderContribution(r.shoulder.fit);
  const sleeve   = isBottom ? { tension: 0, widthMul: 1 } : sleeveContribution(r.sleeve.fit);
  const length   = lengthContribution(r.length.fit);

  // Drape: weighted by the looser of chest/waist; reduced by tension.
  const drapeAmount = clamp01(
    Math.max(chest.drape, waist.drape) - 0.4 * Math.max(chest.tension, waist.tension)
  );

  // Build wrinkle spec list. Tight zones get sharper, fewer tension lines;
  // loose zones get soft vertical drape folds. Skip zones below intensity 0.18.
  const wrinkleZones: WrinkleSpec[] = [];

  if (!isBottom && chest.tension >= 0.5) {
    wrinkleZones.push({
      zone: "chest",
      intensity: clamp01(chest.tension * 0.9),
      direction: "horizontal",
    });
  }
  if (waist.tension >= 0.5) {
    wrinkleZones.push({
      zone: "waist",
      intensity: clamp01(waist.tension * 0.85),
      direction: "diagonal",
    });
  }
  if (!isBottom && shoulder.pull >= 0.5) {
    wrinkleZones.push({
      zone: "shoulder",
      intensity: clamp01(shoulder.pull * 0.8),
      direction: "diagonal",
    });
  }
  if (!isBottom && sleeve.tension >= 0.5) {
    wrinkleZones.push({
      zone: "sleeve",
      intensity: clamp01(sleeve.tension * 0.8),
      direction: "horizontal",
    });
  }
  // Drape: vertical folds in loose / oversized fits
  if (drapeAmount >= 0.25) {
    wrinkleZones.push({
      zone: "waist",
      intensity: clamp01(drapeAmount * 0.9),
      direction: "vertical",
    });
  }
  if (drapeAmount >= 0.4) {
    wrinkleZones.push({
      zone: "hem",
      intensity: clamp01(drapeAmount * 0.7),
      direction: "vertical",
    });
  }

  return {
    chestTension: chest.tension,
    waistTension: waist.tension,
    shoulderPull: shoulder.pull,
    sleeveTension: sleeve.tension,
    drapeAmount,

    shoulderDropPx: shoulder.dropPx,
    hemRisePx: length.hemRise,
    hemDropPx: length.hemDrop,

    chestWidthMul: clamp(chest.widthMul, 0.88, 1.18),
    waistWidthMul: clamp(waist.widthMul, 0.88, 1.18),
    // Hem follows waist for tops, follows waist*1.02 for bottoms (slight flare).
    hemWidthMul: clamp(waist.widthMul * (isBottom ? 1.02 : 1.0), 0.88, 1.20),
    sleeveWidthMul: clamp(sleeve.widthMul, 0.85, 1.20),

    wrinkleZones,
    silhouetteLabel: silhouetteLabel(solver.silhouette),
  };
}

/** Short paragraph the AI refiner / debug overlay can read. */
export function describeFitDetailMap(d: FitDetailMap): string {
  const wr = d.wrinkleZones.length === 0
    ? "no special wrinkles"
    : d.wrinkleZones
        .map((w) => `${w.zone}:${w.direction}@${w.intensity.toFixed(2)}`)
        .join(", ");
  return [
    `Silhouette ${d.silhouetteLabel}.`,
    `Tensions — chest ${d.chestTension.toFixed(2)}, waist ${d.waistTension.toFixed(2)}, shoulder ${d.shoulderPull.toFixed(2)}, sleeve ${d.sleeveTension.toFixed(2)}.`,
    `Drape ${d.drapeAmount.toFixed(2)}.`,
    `Geometry — shoulder drop ${d.shoulderDropPx}px, hem rise ${d.hemRisePx}px, hem drop ${d.hemDropPx}px.`,
    `Width — chest×${d.chestWidthMul.toFixed(2)}, waist×${d.waistWidthMul.toFixed(2)}, hem×${d.hemWidthMul.toFixed(2)}, sleeve×${d.sleeveWidthMul.toFixed(2)}.`,
    `Wrinkles — ${wr}.`,
  ].join(" ");
}
