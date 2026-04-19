// ─── HUMAN EXPLANATION GENERATOR ────────────────────────────────────────────
// Deterministic, no AI required. Produces 2-4 short bullets keyed off region fits.

import type { FitResult, RegionFit } from "../fitEngine";

const REGION_PHRASE: Record<string, { good: string; tight: string; loose: string; short: string; long: string }> = {
  Shoulder: { good: "Shoulders sit naturally", tight: "Shoulders feel pinched", loose: "Shoulders drop past your frame", short: "", long: "" },
  Chest:    { good: "Chest fits cleanly",      tight: "Chest feels snug",        loose: "Chest sits loose",                short: "", long: "" },
  Waist:    { good: "Waist sits comfortably",  tight: "Waist feels tight",       loose: "Waist sits loose",                short: "", long: "" },
  Hip:      { good: "Hip fits well",           tight: "Hip feels tight",         loose: "Hip sits roomy",                  short: "", long: "" },
  Thigh:    { good: "Thigh has room to move",  tight: "Thigh feels restrictive", loose: "Thigh is loose",                  short: "", long: "" },
  Sleeve:   { good: "", tight: "", loose: "", short: "Sleeves run short", long: "Sleeves run long" },
  Length:   { good: "", tight: "", loose: "", short: "Hem sits short",    long: "Hem runs long" },
  Inseam:   { good: "", tight: "", loose: "", short: "Inseam runs short", long: "Inseam runs long" },
  Rise:     { good: "Rise sits as expected",   tight: "Rise feels low",          loose: "Rise sits high",                  short: "", long: "" },
};

function regionLine(r: RegionFit): string | null {
  const p = REGION_PHRASE[r.region];
  if (!p) return null;
  const f = r.fit;
  if (f === "balanced" || f === "fitted" || f === "good-length") return p.good || null;
  if (f === "slightly-tight" || f === "too-tight") return p.tight || null;
  if (f === "relaxed" || f === "oversized" || f === "too-loose") return p.loose || null;
  if (f === "slightly-short" || f === "too-short") return p.short || null;
  if (f === "slightly-long" || f === "too-long") return p.long || null;
  return null;
}

export interface FitExplanation {
  headline: string;        // "Recommended size M"
  bullets: string[];       // 2-4 short region-driven lines
  caveat: string | null;   // confidence/data caveat
}

export function buildFitExplanation(
  result: FitResult,
  confidence: "high" | "medium" | "limited",
  usedGlobalFallback: boolean,
): FitExplanation {
  const rec = result.sizeResults.find((s) => s.recommended);
  const headline = `Recommended size ${result.recommendedSize}`;

  const lines: string[] = [];
  if (rec) {
    // Prioritize: 1 issue first, then a "good" line, then any other issue.
    const ordered = [...rec.regions].sort((a, b) => {
      const sev = (f: string) =>
        f.includes("too") ? 3 : f.includes("slightly") || f === "oversized" || f === "relaxed" ? 2 : 1;
      return sev(b.fit) - sev(a.fit);
    });
    for (const r of ordered) {
      const line = regionLine(r);
      if (line && !lines.includes(line)) lines.push(line);
      if (lines.length >= 4) break;
    }
  }
  if (lines.length === 0) lines.push("Overall fit looks balanced for your measurements.");

  let caveat: string | null = null;
  if (usedGlobalFallback) {
    caveat = "Estimated from global sizing — brand size chart unavailable.";
  } else if (confidence === "limited") {
    caveat = "Limited confidence — add measurements or a clearer scan to refine.";
  }

  return { headline, bullets: lines, caveat };
}

export function confidenceTier(
  confidenceModifier: number,
  usedGlobalFallback: boolean,
): "high" | "medium" | "limited" {
  if (usedGlobalFallback) return confidenceModifier >= 0.65 ? "medium" : "limited";
  if (confidenceModifier >= 0.8) return "high";
  if (confidenceModifier >= 0.6) return "medium";
  return "limited";
}
