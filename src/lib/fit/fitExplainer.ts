// ─── FIT EXPLAINER ──────────────────────────────────────────────────────────
// Turns a region-by-region FitComputation into a concise, honest explanation
// the UI can show alongside the visual. Never overclaims certainty when the
// brand size chart is incomplete.

import type { RegionFitComputation, RegionFitResult } from "./regionFitEngine";

export interface FitExplanation {
  headline: string;
  summary: string;
  warnings: string[];
}

function regionPhrase(r: RegionFitResult): string {
  const region = r.region.toLowerCase();
  switch (r.label) {
    case "very-tight":     return `${region} pulls tight`;
    case "slightly-tight": return `${region} sits close`;
    case "ideal":          return `${region} fits cleanly`;
    case "slightly-loose": return `${region} sits relaxed`;
    case "loose":          return `${region} is roomy`;
    case "oversized":      return `${region} is oversized`;
    case "too-short":      return `${region} ends noticeably high`;
    case "slightly-short": return `${region} ends a touch high`;
    case "regular-length": return `${region} hits the right length`;
    case "slightly-long":  return `${region} sits a little long`;
    case "too-long":       return `${region} hangs noticeably long`;
  }
}

export function buildFitExplanation(fit: RegionFitComputation): FitExplanation {
  const headline =
    fit.overallLabel === "tight"     ? `Size ${fit.selectedSize} will feel close to the body`
  : fit.overallLabel === "relaxed"   ? `Size ${fit.selectedSize} should feel comfortably relaxed`
  : fit.overallLabel === "oversized" ? `Size ${fit.selectedSize} will sit clearly oversized`
  :                                    `Size ${fit.selectedSize} should sit naturally`;

  const positive = fit.regions.filter((r) => r.tone === "regular").map(regionPhrase);
  const negative = fit.regions.filter((r) => r.tone !== "regular").map(regionPhrase);

  const parts: string[] = [];
  if (negative.length) parts.push(negative.slice(0, 3).join(", "));
  if (positive.length) parts.push(`while ${positive.slice(0, 2).join(" and ")}`);
  const summary = parts.length
    ? `${parts.join(", ")}.`
    : `Balanced fit across all measured regions.`;

  return { headline, summary, warnings: fit.warnings };
}
