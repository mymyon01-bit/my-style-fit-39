// ─── SIMPLE FIT ENGINE (visual driver) ──────────────────────────────────────
// Lightweight calc that turns user body + size into VISUAL transform values.
// This is what makes the cloth on the body look different per size.
// Does NOT replace the deep scoring engine in /lib/fitEngine.ts.

import type { SimpleSizeMeasurements, SimpleUserBody } from "./defaultFitData";

export type Silhouette = "tight" | "regular" | "relaxed" | "oversized";

export interface SimpleFit {
  silhouette: Silhouette;
  scale: number;       // overall garment scale (height-ish)
  width: number;       // horizontal stretch factor
  drop: number;        // 0 or 1 → triggers visible drop shoulder
  chestDiff: number;
  shoulderDiff: number;
}

export function calculateFit(user: SimpleUserBody, size: SimpleSizeMeasurements): SimpleFit {
  const chestDiff = size.chest - user.chest;
  const shoulderDiff = size.shoulder - user.shoulder;

  let silhouette: Silhouette = "tight";
  if (chestDiff > 8) silhouette = "oversized";
  else if (chestDiff > 3) silhouette = "relaxed";
  else if (chestDiff >= 0) silhouette = "regular";

  // clamp so visuals don't break
  const scale = Math.max(0.92, Math.min(1.18, 1 + chestDiff * 0.012));
  const width = Math.max(0.94, Math.min(1.28, 1 + shoulderDiff * 0.018));
  const drop = shoulderDiff > 4 ? 1 : 0;

  return { silhouette, scale, width, drop, chestDiff, shoulderDiff };
}

export function silhouetteCopy(s: Silhouette): { label: string; line: string } {
  switch (s) {
    case "tight":
      return { label: "Tight fit", line: "Body-hugging — runs close to the skin." };
    case "regular":
      return { label: "True to size", line: "Balanced silhouette — works for most styling." };
    case "relaxed":
      return { label: "Relaxed fit", line: "Easy line through chest — clean casual feel." };
    case "oversized":
      return { label: "Oversized drop", line: "Relaxed fit, wider shoulders — intentional street look." };
  }
}
