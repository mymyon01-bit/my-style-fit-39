// ─── SIZE WARP PROFILE ──────────────────────────────────────────────────────
// Deterministic per-size visual differentiation. The AI image generator
// (Nano Banana / IDM-VTON) routinely IGNORES fine-grained size hints, which
// is why XL often looked identical to S. To guarantee that every size
// produces a visibly different rendering, we post-process the AI image on a
// canvas with a per-size silhouette warp:
//
//   verySmall / tightFit  → narrow garment, slightly shorter, vertical tension
//   fitted                → close to body, no warp
//   regularFit            → reference (no warp)
//   relaxedFit            → slightly wider + slightly longer
//   oversizedFit          → noticeably wider + dropped shoulders + longer hem
//   tooLarge              → exaggerated wide + dropped + long
//
// These numbers are deliberately small enough to keep the image realistic
// but large enough to be UNAMBIGUOUSLY visible side-by-side.
//
// The warp is applied ONLY to the body/garment region of the image, never
// the whole frame, so the head/face stays anchored (real human proportions).

import type { OverallFitLabel } from "@/lib/sizing";

export interface SizeWarpRegionMetric {
  region: string;
  deltaCm?: number | null;
}

export interface SizeWarpProfile {
  /** Horizontal scale of the garment band (0.92..1.18). 1 = no change. */
  scaleX: number;
  /** Vertical scale of the garment band (0.97..1.10). 1 = no change. */
  scaleY: number;
  /** Extra shoulder-drop pixels (0..28). Larger = looser shoulder line. */
  shoulderDropPx: number;
  /** Extra hem-drop pixels (-10..36). Negative = shorter, positive = longer. */
  hemDropPx: number;
  /** Tension overlay opacity (0..0.22). Visible as soft pulled-fabric lines. */
  tensionOpacity: number;
  /** Drape overlay opacity (0..0.22). Visible as soft hanging fabric lines. */
  drapeOpacity: number;
  /** Short human-readable label, surfaced as a chip on the image. */
  silhouetteLabel: "TRIM" | "FITTED" | "REGULAR" | "RELAXED" | "OVERSIZED";
}

const REGULAR: SizeWarpProfile = {
  scaleX: 1,
  scaleY: 1,
  shoulderDropPx: 0,
  hemDropPx: 0,
  tensionOpacity: 0,
  drapeOpacity: 0,
  silhouetteLabel: "REGULAR",
};

export function profileFromOverall(overall: OverallFitLabel | null | undefined): SizeWarpProfile {
  switch (overall) {
    case "verySmall":
      return {
        scaleX: 0.84,
        scaleY: 0.96,
        shoulderDropPx: -8,
        hemDropPx: -22,
        tensionOpacity: 0.34,
        drapeOpacity: 0,
        silhouetteLabel: "TRIM",
      };
    case "tightFit":
      return {
        scaleX: 0.92,
        scaleY: 0.98,
        shoulderDropPx: -4,
        hemDropPx: -10,
        tensionOpacity: 0.22,
        drapeOpacity: 0,
        silhouetteLabel: "TRIM",
      };
    case "fitted":
      return {
        scaleX: 0.97,
        scaleY: 0.99,
        shoulderDropPx: 0,
        hemDropPx: -3,
        tensionOpacity: 0.08,
        drapeOpacity: 0.05,
        silhouetteLabel: "FITTED",
      };
    case "regularFit":
      return REGULAR;
    case "relaxedFit":
      return {
        scaleX: 1.10,
        scaleY: 1.04,
        shoulderDropPx: 14,
        hemDropPx: 18,
        tensionOpacity: 0,
        drapeOpacity: 0.20,
        silhouetteLabel: "RELAXED",
      };
    case "oversizedFit":
      return {
        scaleX: 1.20,
        scaleY: 1.09,
        shoulderDropPx: 26,
        hemDropPx: 36,
        tensionOpacity: 0,
        drapeOpacity: 0.28,
        silhouetteLabel: "OVERSIZED",
      };
    case "tooLarge":
      return {
        scaleX: 1.30,
        scaleY: 1.14,
        shoulderDropPx: 40,
        hemDropPx: 56,
        tensionOpacity: 0,
        drapeOpacity: 0.34,
        silhouetteLabel: "OVERSIZED",
      };
    default:
      return REGULAR;
  }
}

/**
 * Fallback when the new sizing engine has not produced an overall label —
 * derive a coarse profile from the legacy size letter alone so we still
 * differentiate sizes in the visual.
 */
export function profileFromSizeLetter(size: string | null | undefined): SizeWarpProfile {
  const s = (size || "M").toUpperCase().trim();
  if (s === "XS") return profileFromOverall("verySmall");
  if (s === "S") return profileFromOverall("tightFit");
  if (s === "M") return profileFromOverall("regularFit");
  if (s === "L") return profileFromOverall("relaxedFit");
  if (s === "XL") return profileFromOverall("oversizedFit");
  if (s === "XXL" || s === "2XL" || s === "3XL") return profileFromOverall("tooLarge");
  return REGULAR;
}

const SIZE_INDEX: Record<string, number> = { XXS: -2, XS: -1, S: 0, M: 1, L: 2, XL: 3, XXL: 4, "2XL": 4, "3XL": 5 };
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

/**
 * Measurement-first visual profile. This keeps the mannequin fixed and changes
 * the GARMENT envelope for the tapped size. Overall labels alone are too coarse
 * (S and XL can both be "relaxed" for coats), so this combines actual cm ease
 * with the size ladder to make S/M/L/XL visibly different on the same body.
 */
export function profileFromSizeAndRegions(args: {
  size: string | null | undefined;
  overall?: OverallFitLabel | null;
  regions?: SizeWarpRegionMetric[] | null;
}): SizeWarpProfile {
  const base = args.overall ? profileFromOverall(args.overall) : profileFromSizeLetter(args.size);
  const sizeKey = (args.size || "M").toUpperCase().trim();
  const sizeIdx = SIZE_INDEX[sizeKey] ?? 1;
  const sizeOffset = sizeIdx - 1; // M is the neutral reference.
  const widthDeltas = (args.regions || [])
    .filter((r) => /shoulder|chest|waist|hip|thigh/i.test(r.region) && typeof r.deltaCm === "number")
    .map((r) => r.deltaCm as number);
  const avgEase = widthDeltas.length ? widthDeltas.reduce((a, b) => a + b, 0) / widthDeltas.length : 0;
  const measuredWidthPush = clamp(avgEase / 42, -0.18, 0.24);
  const ladderWidthPush = sizeOffset * 0.105;
  const scaleX = clamp(0.92 + ladderWidthPush + measuredWidthPush, 0.74, 1.42);
  const scaleY = clamp(0.97 + sizeOffset * 0.035 + Math.max(0, avgEase) / 260, 0.92, 1.18);
  const loose = scaleX > 1.08;
  const tight = scaleX < 0.94 || avgEase < 1;

  return {
    ...base,
    scaleX,
    scaleY,
    shoulderDropPx: Math.round(clamp(sizeOffset * 13 + Math.max(0, avgEase - 8) * 0.9, -16, 54)),
    hemDropPx: Math.round(clamp(sizeOffset * 18 + Math.max(0, avgEase - 6) * 1.1 - Math.max(0, -avgEase) * 1.4, -34, 76)),
    tensionOpacity: tight ? clamp(0.18 + Math.max(0, 4 - avgEase) * 0.035, 0.16, 0.42) : 0,
    drapeOpacity: loose ? clamp(0.14 + (scaleX - 1.08) * 0.75, 0.14, 0.42) : base.drapeOpacity,
    silhouetteLabel: scaleX < 0.9 ? "TRIM" : scaleX < 1.02 ? "FITTED" : scaleX < 1.12 ? "REGULAR" : scaleX < 1.27 ? "RELAXED" : "OVERSIZED",
  };
}
