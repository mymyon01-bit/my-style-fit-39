// ─── GLOBAL SIZE FALLBACK ───────────────────────────────────────────────────
// When brand size chart is missing or below quality threshold, fall back to
// a height-based generic mapping. Always labelled "Estimated from global sizing".

import type { FrameType } from "./bodyProfile";

export interface GlobalSizeMapping {
  letter: "XS" | "S" | "M" | "L" | "XL" | "XXL";
  us: string;
  eu: string;
  kr: string;
  jp: string;
}

// Height-based bands (cm). Adjusted by frame for borderline cases.
function letterFromHeight(heightCm: number, frame: FrameType): GlobalSizeMapping["letter"] {
  let base: GlobalSizeMapping["letter"];
  if (heightCm < 158) base = "XS";
  else if (heightCm < 168) base = "S";
  else if (heightCm < 176) base = "M";
  else if (heightCm < 184) base = "L";
  else if (heightCm < 192) base = "XL";
  else base = "XXL";

  // Bump up one size for broad frame, down one for slim — but only at borders.
  const order: GlobalSizeMapping["letter"][] = ["XS", "S", "M", "L", "XL", "XXL"];
  const idx = order.indexOf(base);
  if (frame === "broad" && idx < order.length - 1) return order[idx + 1];
  if (frame === "slim" && idx > 0 && heightCm % 8 < 2) return order[idx - 1];
  return base;
}

const REGION_TABLE: Record<GlobalSizeMapping["letter"], Omit<GlobalSizeMapping, "letter">> = {
  XS: { us: "0-2",  eu: "32-34", kr: "44",   jp: "5"  },
  S:  { us: "4",    eu: "36",    kr: "55",   jp: "7"  },
  M:  { us: "6-8",  eu: "38-40", kr: "66",   jp: "9"  },
  L:  { us: "10",   eu: "42",    kr: "77",   jp: "11" },
  XL: { us: "12",   eu: "44",    kr: "88",   jp: "13" },
  XXL:{ us: "14+",  eu: "46+",   kr: "99",   jp: "15" },
};

export function estimateGlobalSize(heightCm: number, frame: FrameType): GlobalSizeMapping {
  const letter = letterFromHeight(heightCm, frame);
  return { letter, ...REGION_TABLE[letter] };
}

export function shouldUseGlobalFallback(productDataQuality: number, hasSizeChart: boolean): boolean {
  if (!hasSizeChart) return true;
  return productDataQuality < 50;
}
