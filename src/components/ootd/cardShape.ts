/**
 * Card-shape preference for OOTD My Page — "round" (soft, default) or
 * "sharp" (modern square). Persists to localStorage and exposes a CSS
 * variable `--ootd-card-radius` consumed by the OOTD card surfaces.
 */
export type CardShape = "round" | "sharp";

const STORAGE_KEY = "ootd-card-shape";
const ROOT_VAR = "--ootd-card-radius";

const RADIUS_MAP: Record<CardShape, string> = {
  round: "1.5rem", // rounded-3xl
  sharp: "0.375rem", // rounded-[6px]
};

export function loadCardShape(): CardShape {
  if (typeof window === "undefined") return "round";
  const v = localStorage.getItem(STORAGE_KEY);
  return v === "sharp" ? "sharp" : "round";
}

export function applyCardShapeToRoot(shape: CardShape) {
  if (typeof document === "undefined") return;
  document.documentElement.style.setProperty(ROOT_VAR, RADIUS_MAP[shape]);
}

export function saveCardShape(shape: CardShape) {
  try {
    localStorage.setItem(STORAGE_KEY, shape);
  } catch {}
  applyCardShapeToRoot(shape);
  try {
    window.dispatchEvent(new CustomEvent("ootd-card-shape-change", { detail: shape }));
  } catch {}
}
