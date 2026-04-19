// Combine avatar body morph + garment size morph into final mesh transforms.
// This is the bridge between body data and the procedural garment in Fit3DViewer.

import type { AvatarMorph } from "./bodyToAvatar";
import type { GarmentMorph } from "./sizeToMorph";
import type { GarmentType } from "./getGarmentType";

export interface GarmentTransform {
  /** scene-unit scale applied to garment mesh */
  scale: [number, number, number];
  /** scene-unit position applied to garment mesh */
  position: [number, number, number];
  /** sleeve / leg length multiplier (consumed by mesh shader/geometry) */
  limbScale: number;
  /** shoulder drop applied to top garments (scene units) */
  shoulderDrop: number;
  /** material roughness — looser fits = softer drape look */
  roughness: number;
  /** material clearcoat — leathers/jackets read shinier */
  clearcoat: number;
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

  const clearcoat =
    garmentType === "outerwear" ? 0.45 :
    garmentType === "bottom" ? 0.05 : 0.15;

  const roughness = Math.max(0.35, 0.85 - size.drape * 0.25);

  return {
    scale: [scaleX, scaleY, scaleZ],
    position: [0, baseY, 0],
    limbScale: size.sleeveScale,
    shoulderDrop: size.shoulderOffset,
    roughness,
    clearcoat,
  };
}
