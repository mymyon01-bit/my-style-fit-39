// Translate a size token into visible 3D garment deformations.
// Values are multipliers / offsets (in scene units) consumed by Fit3DViewer.

export type SizeToken = "XS" | "S" | "M" | "L" | "XL" | "XXL";

export interface GarmentMorph {
  scaleX: number;        // chest/waist width
  scaleY: number;        // body length
  sleeveScale: number;   // sleeve length+volume
  shoulderOffset: number; // shoulder drop (scene units, negative = down)
  lengthOffset: number;  // body bottom-edge drop
  drape: number;         // 0..1 — looseness used for material softness
}

export function normalizeSize(s: string): SizeToken {
  const u = (s || "M").toUpperCase().trim();
  if (u === "XS" || u === "S" || u === "M" || u === "L" || u === "XL" || u === "XXL") return u;
  // numeric waist sizes
  const n = parseInt(u, 10);
  if (!isNaN(n)) {
    if (n <= 28) return "XS";
    if (n <= 30) return "S";
    if (n <= 32) return "M";
    if (n <= 34) return "L";
    if (n <= 36) return "XL";
    return "XXL";
  }
  return "M";
}

const TABLE: Record<SizeToken, GarmentMorph> = {
  XS: { scaleX: 0.86, scaleY: 0.94, sleeveScale: 0.88, shoulderOffset: 0.02, lengthOffset: 0.04, drape: 0.05 },
  S:  { scaleX: 0.93, scaleY: 0.97, sleeveScale: 0.94, shoulderOffset: 0.01, lengthOffset: 0.02, drape: 0.18 },
  M:  { scaleX: 1.00, scaleY: 1.00, sleeveScale: 1.00, shoulderOffset: 0.00, lengthOffset: 0.00, drape: 0.35 },
  L:  { scaleX: 1.08, scaleY: 1.04, sleeveScale: 1.07, shoulderOffset: -0.015, lengthOffset: -0.03, drape: 0.55 },
  XL: { scaleX: 1.18, scaleY: 1.09, sleeveScale: 1.16, shoulderOffset: -0.035, lengthOffset: -0.06, drape: 0.75 },
  XXL: { scaleX: 1.27, scaleY: 1.14, sleeveScale: 1.24, shoulderOffset: -0.05, lengthOffset: -0.09, drape: 0.9 },
};

export function sizeToMorph(size: string): GarmentMorph {
  return TABLE[normalizeSize(size)];
}
