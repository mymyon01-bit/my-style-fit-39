import type { BodyMeasurements, GarmentMeasurements, FitResult } from "./types";
import { idealLength } from "./body";

// Pure deterministic math. No AI. No randomness.
export function calculateFit(
  body: BodyMeasurements,
  garment: GarmentMeasurements
): FitResult {
  return {
    chestDiff: round(garment.chest - body.chest),
    shoulderDiff: round(garment.shoulder - body.shoulder),
    lengthDiff: round(garment.length - idealLength(body.height)),
    sleeveDiff: round(garment.sleeve - body.armLength),
  };
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

// ─── REGION-BASED FIT ENGINE ───────────────────────────────────────────────
// 5-tier per-region labels + overall + human explanation. Used by the UI to
// show honest, region-level fit info; consumed by FIT readiness gate.

export type RegionLabel =
  | "tight"
  | "slightly tight"
  | "ideal"
  | "slightly loose"
  | "loose";

export interface RegionFit {
  region: "shoulders" | "chest" | "length" | "sleeve";
  deltaCm: number;
  label: RegionLabel;
}

export interface RegionFitReport {
  regions: RegionFit[];
  overall: RegionLabel;
  explanation: string;
}

/** 5-tier classifier centered on `idealMin..idealMax` in cm. */
function classify(
  delta: number,
  idealMin: number,
  idealMax: number,
  slack: number,
): RegionLabel {
  if (delta < idealMin - slack) return "tight";
  if (delta < idealMin) return "slightly tight";
  if (delta <= idealMax) return "ideal";
  if (delta <= idealMax + slack) return "slightly loose";
  return "loose";
}

export function buildRegionFitReport(
  body: BodyMeasurements,
  garment: GarmentMeasurements,
): RegionFitReport {
  const r = calculateFit(body, garment);
  const regions: RegionFit[] = [
    { region: "shoulders", deltaCm: r.shoulderDiff, label: classify(r.shoulderDiff, -1, 2, 2) },
    { region: "chest",     deltaCm: r.chestDiff,    label: classify(r.chestDiff, 2, 6, 4) },
    { region: "length",    deltaCm: r.lengthDiff,   label: classify(r.lengthDiff, -3, 4, 3) },
    { region: "sleeve",    deltaCm: r.sleeveDiff,   label: classify(r.sleeveDiff, -3, 3, 3) },
  ];

  // Overall — weighted by chest+shoulder (visual silhouette drivers).
  const score = r.chestDiff + r.shoulderDiff * 1.5;
  let overall: RegionLabel;
  if (score < -1) overall = "tight";
  else if (score < 1) overall = "slightly tight";
  else if (score <= 6) overall = "ideal";
  else if (score <= 12) overall = "slightly loose";
  else overall = "loose";

  const parts: string[] = [];
  for (const reg of regions) {
    if (reg.label !== "ideal") {
      const sign = reg.deltaCm > 0 ? "+" : "";
      parts.push(`${reg.region} ${reg.label} (${sign}${reg.deltaCm} cm)`);
    }
  }
  const explanation = parts.length === 0
    ? "Fits well across all measured regions."
    : `Overall ${overall}. ${parts.join("; ")}.`;

  return { regions, overall, explanation };
}
