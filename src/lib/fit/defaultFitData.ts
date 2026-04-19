// ─── DEFAULT FIT DATA ───────────────────────────────────────────────────────
// Guarantees every product has usable size data, even if DB/scrape is empty.
// Keeps the demo from ever showing an empty state.

export interface SimpleSizeMeasurements {
  chest: number;
  shoulder: number;
  length: number;
}

export type SimpleSizeKey = "S" | "M" | "L" | "XL";

export type SimpleFitTable = Record<SimpleSizeKey, SimpleSizeMeasurements>;

export function getDefaultFit(category?: string): SimpleFitTable {
  // Bottoms get a slightly different baseline but the same shape contract,
  // so the visual engine can render either tops or bottoms cleanly.
  const isBottom = category === "bottoms";
  if (isBottom) {
    return {
      S:  { chest: 76, shoulder: 38, length: 100 },
      M:  { chest: 80, shoulder: 40, length: 102 },
      L:  { chest: 84, shoulder: 42, length: 104 },
      XL: { chest: 88, shoulder: 44, length: 106 },
    };
  }
  return {
    S:  { chest: 52, shoulder: 44, length: 68 },
    M:  { chest: 56, shoulder: 47, length: 71 },
    L:  { chest: 60, shoulder: 50, length: 74 },
    XL: { chest: 64, shoulder: 53, length: 77 },
  };
}

export interface SimpleUserBody {
  chest: number;
  shoulder: number;
}

export const DEFAULT_USER_BODY: SimpleUserBody = {
  chest: 56,
  shoulder: 46,
};
