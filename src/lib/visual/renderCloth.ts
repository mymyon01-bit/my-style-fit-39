// ─── CLOTH RENDER ENGINE ────────────────────────────────────────────────────
// Translates a SimpleFit into concrete CSS the cloth <img> should use.
// The cloth is anchored to the body via top:<chestY>%, then transformed.

import type { CSSProperties } from "react";
import type { SimpleFit } from "@/lib/fit/simpleFitEngine";
import { getAnchors } from "./anchors";

export function getClothStyle(fit: SimpleFit, category: string): CSSProperties {
  const anchors = getAnchors();
  const isBottom = category === "bottoms";
  const topPct = isBottom ? anchors.waistY : anchors.shoulderY;

  // Drop shoulder offset — when oversized, cloth hangs ~12px lower at neckline
  const dropPx = fit.drop * 12;

  // Width scales with shoulder diff
  const widthPct = Math.round(58 * fit.width); // base 58% of stage width

  return {
    position: "absolute",
    top: `${topPct}%`,
    left: "50%",
    width: `${widthPct}%`,
    transform: `translate(-50%, ${dropPx}px) scale(${fit.scale})`,
    transformOrigin: "top center",
    transition:
      "transform 520ms cubic-bezier(.22,.9,.27,1.02), width 520ms cubic-bezier(.22,.9,.27,1.02), top 520ms ease",
    pointerEvents: "none",
    filter: "drop-shadow(0 18px 24px hsl(var(--background) / 0.55))",
    willChange: "transform, width",
  };
}
