import type { GarmentMeasurements } from "./types";

// Deterministic estimator for when merchant size charts aren't available.
// Returns measurements for a given size label & fit profile.
type FitProfile = "slim" | "regular" | "relaxed" | "oversized";

const SIZE_BASE: Record<string, GarmentMeasurements> = {
  XS: { chest: 96,  length: 64, shoulder: 42, sleeve: 58 },
  S:  { chest: 102, length: 66, shoulder: 44, sleeve: 60 },
  M:  { chest: 108, length: 68, shoulder: 46, sleeve: 62 },
  L:  { chest: 114, length: 70, shoulder: 48, sleeve: 64 },
  XL: { chest: 120, length: 72, shoulder: 50, sleeve: 66 },
};

const FIT_OFFSET: Record<FitProfile, { chest: number; length: number; shoulder: number }> = {
  slim:      { chest: -4, length: -2, shoulder: -1 },
  regular:   { chest: 0,  length: 0,  shoulder: 0 },
  relaxed:   { chest: 6,  length: 2,  shoulder: 2 },
  oversized: { chest: 14, length: 4,  shoulder: 4 },
};

export function estimateGarment(
  size: string,
  fit: FitProfile = "regular"
): GarmentMeasurements {
  const base = SIZE_BASE[size.toUpperCase()] ?? SIZE_BASE.M;
  const off = FIT_OFFSET[fit];
  return {
    chest: base.chest + off.chest,
    length: base.length + off.length,
    shoulder: base.shoulder + off.shoulder,
    sleeve: base.sleeve,
  };
}

export function isCompleteGarment(g: Partial<GarmentMeasurements>): g is GarmentMeasurements {
  return (
    typeof g.chest === "number" &&
    typeof g.length === "number" &&
    typeof g.shoulder === "number" &&
    typeof g.sleeve === "number"
  );
}

// Cache key for garment measurement lookups.
export function garmentCacheKey(productId: string, size: string): string {
  return `garment:${productId}:${size.toUpperCase()}`;
}
