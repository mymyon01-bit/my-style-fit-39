// ─── V3 BODY-LOCKED CLASSIFIER + BEST-BALANCE PICKER ────────────────────────
// Hard rules of the rebuild (per spec):
//   1. Body is locked. Same body for every size.
//   2. Size labels (S/M/L/XL) are names ONLY. They never decide fit.
//   3. Fit = (garment − body) − target_ease. Distance-from-target wins.
//   4. Best size = MIN weighted squared distance from target ease — never
//      "biggest safe size", never "label-biased".
//   5. Honest classification: TooSmall, Tight, CloseFit, BestBalance,
//      Relaxed, Oversized, TooLarge.
//
// This file is a pure function layer over the existing `SizeOutcome` data —
// no new DB calls, no body mutation, no AI guesses.

import { CATEGORY_RULES } from "./categoryRules";
import type {
  FitPreference,
  Region,
  ResolvedBody,
  SizeOutcome,
  SizingCategory,
} from "./types";

export type V3Classification =
  | "TooSmall"
  | "Tight"
  | "CloseFit"
  | "BestBalance"
  | "Relaxed"
  | "Oversized"
  | "TooLarge";

export interface V3SizeAnalysis {
  size: string;
  classification: V3Classification;
  /** Sum of weighted squared distance-from-target across regions. Lower = better. */
  distanceScore: number;
  /** Net signed distance (positive = looser than target, negative = tighter). */
  signedDistance: number;
  /** Per-region delta cm vs target ease centre. */
  regionDeltas: Array<{ region: Region; deltaVsTarget: number; weight: number }>;
}

export interface V3Pick {
  primarySize: string | null;
  alternateSize: string | null;
  reason: string;
  analyses: V3SizeAnalysis[];
}

const TIGHT_REGIONS: Region[] = ["shoulder", "chest", "waist", "hip", "thigh"];

function bodyValue(body: ResolvedBody, region: Region): number | null {
  switch (region) {
    case "shoulder": return body.shoulderCm.cm;
    case "chest":    return body.chestCm.cm;
    case "waist":    return body.waistCm.cm;
    case "hip":      return body.hipCm.cm;
    case "thigh":    return body.thighCm.cm;
    case "sleeve":   return body.sleeveCm.cm;
    case "inseam":   return body.inseamCm.cm;
    case "length":   return null;
  }
}

/**
 * Classify a single size based on its worst-region distance from target ease.
 * Bands (cm beyond target ease centre, applied to the most weight-critical
 * tight region — chest for tops, waist for bottoms):
 *
 *   d < −10   → TooSmall          (garment far smaller than body)
 *   d < −4    → Tight
 *   d < +2    → CloseFit
 *   d < +6    → BestBalance
 *   d < +12   → Relaxed
 *   d < +20   → Oversized
 *   d ≥ +20   → TooLarge
 *
 * Where d = (garment − body) − targetEase. Negative = tighter than intended,
 * positive = looser than intended.
 */
function classifyFromDistance(signedDistance: number): V3Classification {
  if (signedDistance < -10) return "TooSmall";
  if (signedDistance < -4)  return "Tight";
  if (signedDistance < 2)   return "CloseFit";
  if (signedDistance < 6)   return "BestBalance";
  if (signedDistance < 12)  return "Relaxed";
  if (signedDistance < 20)  return "Oversized";
  return "TooLarge";
}

/** Dominant region per category — drives the primary signed-distance signal. */
function dominantRegion(category: SizingCategory): Region {
  if (["pants", "denim", "shorts", "skirt"].includes(category)) return "waist";
  return "chest";
}

export function analyzeSize(
  body: ResolvedBody,
  outcome: SizeOutcome,
  category: SizingCategory,
  preference: FitPreference,
): V3SizeAnalysis {
  const rule = CATEGORY_RULES[category];
  const ease = rule.ease[preference] as Record<string, number>;
  const weights = rule.weights as Record<string, number>;

  const regionDeltas: V3SizeAnalysis["regionDeltas"] = [];
  let distanceScore = 0;
  let weightSum = 0;

  for (const r of outcome.regions) {
    const region = r.region;
    if (region === "length") continue; // length handled separately by category lengthMode
    if (r.deltaCm == null) continue;
    const target = ease[region] ?? 0;
    const w = weights[region] ?? 0;
    if (w <= 0) continue;
    // signed distance: how far the actual ease is from the target
    const d = r.deltaCm - target;
    regionDeltas.push({ region, deltaVsTarget: d, weight: w });
    // Asymmetric penalty — tightness on shoulder/chest hurts more than
    // looseness; oversizedness on shoulder hurts more than chest.
    const tightPenalty = region === "shoulder" || region === "chest" ? 1.4 : 1.0;
    const loosePenalty = region === "shoulder" ? 1.6 : 1.0;
    const penalty = d < 0 ? tightPenalty : loosePenalty;
    distanceScore += w * penalty * d * d;
    weightSum += w;
  }

  // Signed distance from target on the dominant region (used for label).
  const dom = dominantRegion(category);
  const domEntry = regionDeltas.find((e) => e.region === dom);
  const signedDistance = domEntry ? domEntry.deltaVsTarget : 0;

  const normScore = weightSum > 0 ? distanceScore / weightSum : Infinity;
  const classification = classifyFromDistance(signedDistance);

  return {
    size: outcome.size,
    classification,
    distanceScore: normScore,
    signedDistance,
    regionDeltas,
  };
}

/**
 * Pick best-balance size: the one whose distanceScore is lowest. The user's
 * fitPreference shifts the target ease (already baked into `analyzeSize` via
 * `rule.ease[preference]`) — it does NOT bias toward a label or a direction.
 *
 * Alternate = next-best size in the OPPOSITE direction (signed distance sign
 * flips), so the user can choose between a tighter and looser option.
 */
export function pickBestBalance(
  body: ResolvedBody,
  outcomes: SizeOutcome[],
  category: SizingCategory,
  preference: FitPreference,
): V3Pick {
  if (outcomes.length === 0) {
    return { primarySize: null, alternateSize: null, reason: "No sizes available.", analyses: [] };
  }

  const analyses = outcomes.map((o) => analyzeSize(body, o, category, preference));
  const ranked = [...analyses].sort((a, b) => a.distanceScore - b.distanceScore);
  const primary = ranked[0];

  // Alternate: the next-best in the OPPOSITE direction relative to primary.
  const opposite = ranked.slice(1).find((a) =>
    Math.sign(a.signedDistance) !== Math.sign(primary.signedDistance) &&
    a.size !== primary.size,
  ) ?? ranked.slice(1)[0] ?? null;

  return {
    primarySize: primary.size,
    alternateSize: opposite?.size ?? null,
    reason: buildReason(primary, opposite),
    analyses,
  };
}

function classificationLabel(c: V3Classification): string {
  switch (c) {
    case "TooSmall":    return "too small";
    case "Tight":       return "tight";
    case "CloseFit":    return "a close fit";
    case "BestBalance": return "the best balance";
    case "Relaxed":     return "relaxed";
    case "Oversized":   return "oversized";
    case "TooLarge":    return "too large";
  }
}

function buildReason(primary: V3SizeAnalysis, alternate: V3SizeAnalysis | null): string {
  const head = `${primary.size} is ${classificationLabel(primary.classification)} for your measurements — closest to the target room for this category.`;
  if (!alternate) return head;
  const dir = alternate.signedDistance < primary.signedDistance ? "tighter" : "looser";
  return `${head} Try ${alternate.size} for a ${dir} silhouette.`;
}

/** One-sentence guidance per classification — drives the FIT page hero copy. */
export function classificationSentence(c: V3Classification, size: string): string {
  switch (c) {
    case "TooSmall":    return `Size ${size} is smaller than your body measurements.`;
    case "Tight":       return `Size ${size} will feel tight on you.`;
    case "CloseFit":    return `Size ${size} sits close to the body — sharper silhouette.`;
    case "BestBalance": return `Size ${size} gives the most natural room without looking oversized.`;
    case "Relaxed":     return `Size ${size} sits relaxed with extra room.`;
    case "Oversized":   return `Size ${size} reads oversized for your body.`;
    case "TooLarge":    return `Size ${size} has too much room for your body.`;
  }
}
