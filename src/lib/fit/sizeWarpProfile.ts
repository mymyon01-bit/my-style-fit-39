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
        scaleX: 0.92,
        scaleY: 0.985,
        shoulderDropPx: -4,
        hemDropPx: -10,
        tensionOpacity: 0.22,
        drapeOpacity: 0,
        silhouetteLabel: "TRIM",
      };
    case "tightFit":
      return {
        scaleX: 0.96,
        scaleY: 0.99,
        shoulderDropPx: -2,
        hemDropPx: -5,
        tensionOpacity: 0.16,
        drapeOpacity: 0,
        silhouetteLabel: "TRIM",
      };
    case "fitted":
      return {
        scaleX: 0.985,
        scaleY: 0.995,
        shoulderDropPx: 0,
        hemDropPx: -2,
        tensionOpacity: 0.06,
        drapeOpacity: 0.04,
        silhouetteLabel: "FITTED",
      };
    case "regularFit":
      return REGULAR;
    case "relaxedFit":
      return {
        scaleX: 1.06,
        scaleY: 1.025,
        shoulderDropPx: 8,
        hemDropPx: 10,
        tensionOpacity: 0,
        drapeOpacity: 0.14,
        silhouetteLabel: "RELAXED",
      };
    case "oversizedFit":
      return {
        scaleX: 1.12,
        scaleY: 1.06,
        shoulderDropPx: 18,
        hemDropPx: 22,
        tensionOpacity: 0,
        drapeOpacity: 0.20,
        silhouetteLabel: "OVERSIZED",
      };
    case "tooLarge":
      return {
        scaleX: 1.18,
        scaleY: 1.10,
        shoulderDropPx: 28,
        hemDropPx: 36,
        tensionOpacity: 0,
        drapeOpacity: 0.22,
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
