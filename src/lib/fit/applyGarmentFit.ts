// Combine avatar body morph + garment size morph into final mesh transforms.
// Adds FAKE DRAPE (chest bulge / waist taper / hem flare / sleeve bend) so
// the procedural garment reads as soft fabric instead of a rigid shell.

import type { AvatarMorph } from "./bodyToAvatar";
import type { GarmentMorph } from "./sizeToMorph";
import type { GarmentType } from "./getGarmentType";

export interface GarmentTransform {
  /** scene-unit scale applied to garment root */
  scale: [number, number, number];
  /** scene-unit position applied to garment root */
  position: [number, number, number];

  /** per-region drape multipliers (chest > waist tapers in, hem flares out) */
  chestScale: number;
  waistScale: number;
  hemScale: number;

  /** sleeve length+volume + small inward bend at the elbow */
  limbScale: number;
  sleeveBend: number; // radians
  /** shoulder drop applied to top garments (scene units, negative = down) */
  shoulderDrop: number;

  /** material settings */
  roughness: number;
  clearcoat: number;

  /** debug/telemetry */
  drape: number; // 0..1
}

export function applyGarmentFit(args: {
  avatar: AvatarMorph;
  size: GarmentMorph;
  garmentType: GarmentType;
  fitType?: "slim" | "regular" | "relaxed" | "oversized";
}): GarmentTransform {
  const { avatar, size, garmentType, fitType = "regular" } = args;

  const fitWidthBoost =
    fitType === "slim" ? 0.96 :
    fitType === "relaxed" ? 1.06 :
    fitType === "oversized" ? 1.14 : 1.0;

  // Horizontal scale couples to torso width (or hip width for bottoms)
  const widthAnchor = garmentType === "bottom" ? avatar.hipWidth : avatar.torsoWidth;

  const scaleX = size.scaleX * widthAnchor * fitWidthBoost;
  const scaleY =
    garmentType === "bottom"
      ? size.scaleY * avatar.legLength
      : size.scaleY * avatar.heightScale;
  const scaleZ = (size.scaleX * 0.85 + 0.15) * widthAnchor * fitWidthBoost;

  // Position: tops sit on shoulders (drop slightly with bigger size), bottoms ride at waist.
  const baseY =
    garmentType === "bottom" ? -0.55 + size.lengthOffset * 0.5 :
    garmentType === "full" ? -0.05 + size.lengthOffset * 0.4 :
    0.45 + size.shoulderOffset;

  // ── FAKE DRAPE ────────────────────────────────────────────────────────
  // drape ∈ [0..1] from sizeToMorph: bigger size = more drape.
  // We bias chest outward, taper waist slightly inward, and flare hem.
  // Top tighter → bottom looser is encoded by chest < hem.
  const d = size.drape;
  const chestScale = 1 + d * 0.06;        // up to +6% bulge at chest
  const waistScale = 1 - 0.02 + d * 0.04; // baseline slight taper, opens with drape
  const hemScale   = 1 + 0.03 + d * 0.10; // hem always flares, more with drape
  const sleeveBend = 0.06 + d * 0.10;     // radians: relaxed sleeves bend more

  const clearcoat =
    garmentType === "outerwear" ? 0.32 :
    garmentType === "bottom" ? 0.04 : 0.10;

  // Fabric, not plastic: keep roughness high and stable.
  const roughness = Math.max(0.55, 0.78 - d * 0.18);

  return {
    scale: [scaleX, scaleY, scaleZ],
    position: [0, baseY, 0],
    chestScale,
    waistScale,
    hemScale,
    limbScale: size.sleeveScale,
    sleeveBend,
    shoulderDrop: size.shoulderOffset,
    roughness,
    clearcoat,
    drape: d,
  };
}
