// Translate a size token into visible 3D garment deformations.
// Tuned so each step is OBVIOUSLY different on screen.

export type SizeToken = "XS" | "S" | "M" | "L" | "XL" | "XXL";

export interface GarmentMorph {
  scaleX: number;        // chest/waist width
  scaleY: number;        // body length
  sleeveScale: number;   // sleeve length+volume
  shoulderOffset: number; // shoulder drop (scene units, negative = down)
  lengthOffset: number;  // body bottom-edge drop
  drape: number;         // 0..1 — looseness used for material softness + drape
}

export function normalizeSize(s: string): SizeToken {
  const u = (s || "M").toUpperCase().trim();
  if (u === "XS" || u === "S" || u === "M" || u === "L" || u === "XL" || u === "XXL") return u;
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
  XS: { scaleX: 0.82, scaleY: 0.92, sleeveScale: 0.85, shoulderOffset: 0.03,  lengthOffset: 0.06,  drape: 0.05 },
  S:  { scaleX: 0.90, scaleY: 0.96, sleeveScale: 0.92, shoulderOffset: 0.015, lengthOffset: 0.03,  drape: 0.18 },
  M:  { scaleX: 1.00, scaleY: 1.00, sleeveScale: 1.00, shoulderOffset: 0.00,  lengthOffset: 0.00,  drape: 0.38 },
  L:  { scaleX: 1.10, scaleY: 1.05, sleeveScale: 1.09, shoulderOffset: -0.025, lengthOffset: -0.04, drape: 0.60 },
  XL: { scaleX: 1.22, scaleY: 1.11, sleeveScale: 1.20, shoulderOffset: -0.05,  lengthOffset: -0.08, drape: 0.80 },
  XXL: { scaleX: 1.32, scaleY: 1.16, sleeveScale: 1.28, shoulderOffset: -0.07, lengthOffset: -0.11, drape: 0.95 },
};

export function sizeToMorph(size: string): GarmentMorph {
  return TABLE[normalizeSize(size)];
}
