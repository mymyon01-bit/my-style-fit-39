// Shared CSS-based video filter presets for OOTD shorts.
// Applied as a CSS `filter` string on the video / canvas element.

export type VideoFilterId =
  | "none"
  | "warm"
  | "cool"
  | "mono"
  | "vivid"
  | "fade"
  | "noir"
  | "sepia";

export const VIDEO_FILTERS: { id: VideoFilterId; label: string; css: string }[] = [
  { id: "none", label: "Original", css: "none" },
  { id: "vivid", label: "Vivid", css: "saturate(1.55) contrast(1.12)" },
  { id: "warm", label: "Warm", css: "saturate(1.25) sepia(0.18) hue-rotate(-8deg) brightness(1.04)" },
  { id: "cool", label: "Cool", css: "saturate(1.1) hue-rotate(15deg) brightness(1.04)" },
  { id: "fade", label: "Fade", css: "contrast(0.88) brightness(1.08) saturate(0.85)" },
  { id: "mono", label: "Mono", css: "grayscale(1) contrast(1.08)" },
  { id: "noir", label: "Noir", css: "grayscale(1) contrast(1.45) brightness(0.9)" },
  { id: "sepia", label: "Sepia", css: "sepia(0.85) contrast(1.05) brightness(1.02)" },
];

export const filterCssById = (id?: string | null): string => {
  if (!id) return "none";
  return VIDEO_FILTERS.find((f) => f.id === id)?.css || "none";
};
