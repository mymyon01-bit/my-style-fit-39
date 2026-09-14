// ─── FIT RENDER STATE — V5 (structured, size-first) ────────────────────────
//
// THE architectural rule of the MYMYON fit pipeline:
//
//   SIZE → PHYSICAL GARMENT DIMENSIONS → BODY/GARMENT DELTA → EASE →
//   TENSION → FABRIC BEHAVIOR → GARMENT DEFORMATION → AI VISUALIZATION
//
// The image generator is the LAST stage. It visualizes the fit that this
// module calculates; it never decides the fit itself.
//
// Pure + deterministic. No I/O. Safe on web and in edge runtimes.

import type { GarmentDNA } from "./garmentDNA";
import type { SizeMeasurementInput, CorrelationRegion } from "./sizeCorrelationEngine";

export type WearerSex = "male" | "female";

export type RegionFitState =
  | "too_tight"
  | "tight"
  | "fitted"
  | "regular"
  | "relaxed"
  | "loose"
  | "oversized";

export interface WearerBodyDNA {
  sex: WearerSex;
  /** How the sex was determined. `inferred` never means "switch to neutral". */
  sexSource: "profile" | "inferred";
  heightCm: number | null;
  weightKg: number | null;
  shoulderCm: number | null;
  chestOrBustCm: number | null;
  underbustCm: number | null;
  waistCm: number | null;
  hipCm: number | null;
  seatCm: number | null;
  upperArmCm: number | null;
  thighCm: number | null;
  torsoLengthCm: number | null;
  legLengthCm: number | null;
  bodyShape: string | null;
  bmi: number | null;
}

export interface FabricBehavior {
  type: string;
  stretch: number;      // 0–1
  elasticity: number;   // 0–1
  stiffness: number;    // 0–1
  thickness: number;    // 0–1
  weight: number;       // 0–1
  drape: number;        // 0–1
  recovery: number;     // 0–1
}

export interface RegionFitRow {
  region: string;
  bodyCm: number | null;
  garmentCm: number | null;
  /** garment − body (cm). Negative = compression. */
  deltaCm: number | null;
  /** Effective ease after fabric stretch is taken into account (cm). */
  easeCm: number | null;
  /** 0.00–1.00 normalized tension. */
  tension: number | null;
  state: RegionFitState;
  /** What the renderer must physically show for this region. */
  behavior: string;
}

export interface FitRenderState {
  version: string;
  wearer: {
    type: "real_human";
    sex: WearerSex;
    sexSource: "profile" | "inferred";
    bodyDNA: WearerBodyDNA;
    /** Stable hash of the body. Identical across every garment size. */
    bodyHash: string;
  };
  garment: {
    id: string;
    category: string;
    type: string;
    selectedSize: string;
    measurements: Record<string, number>;
    fabric: FabricBehavior;
    intendedFit: string;
    measurementSource: SizeMeasurementInput["source"];
  };
  fit: {
    regions: RegionFitRow[];
    delta: Record<string, number>;
    ease: Record<string, number>;
    tension: Record<string, number>;
    fitState: Record<string, RegionFitState>;
    overall: RegionFitState;
    /** Dominant regions for this sex, in priority order. */
    priorityRegions: string[];
  };
  /** Cache key covering body + garment + size + measurements + fabric + sex. */
  hash: string;
}

export const FIT_RENDER_STATE_VERSION = "fit-render-state-v5";

// ─── Hashing ───────────────────────────────────────────────────────────────

function fnv1a(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

function stable(value: unknown): string {
  if (value === null || value === undefined) return "_";
  if (typeof value !== "object") return String(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj).sort().map((k) => `${k}:${stable(obj[k])}`).join(",")}}`;
}

export function hashOf(value: unknown): string {
  return fnv1a(stable(value));
}

// ─── Fabric ────────────────────────────────────────────────────────────────

const L3: Record<string, number> = { low: 0.2, medium: 0.55, high: 0.9 };
const WEIGHT3: Record<string, number> = { light: 0.25, medium: 0.55, heavy: 0.9 };

export function fabricFromDNA(dna: GarmentDNA): FabricBehavior {
  const elasticity = L3[dna.elasticity] ?? 0.55;
  const stiffness = L3[dna.stiffness] ?? 0.4;
  return {
    type: dna.fabricType,
    stretch: L3[dna.stretchLevel] ?? 0.5,
    elasticity,
    stiffness,
    thickness: L3[dna.thickness] ?? 0.5,
    weight: WEIGHT3[dna.fabricWeight] ?? 0.55,
    drape: L3[dna.drapeLevel] ?? 0.5,
    // Elastic fabrics recover; stiff/heavy ones hold deformation.
    recovery: Math.max(0.05, Math.min(1, elasticity * 0.9 + (1 - stiffness) * 0.1)),
  };
}

// ─── Sex / body mapping ────────────────────────────────────────────────────

const MALE_PRIORITY = ["shoulder", "chest", "waist", "hip", "sleeve", "thigh", "inseam", "length"];
const FEMALE_PRIORITY = ["chest", "waist", "hip", "shoulder", "sleeve", "thigh", "inseam", "length"];

/** Never silently defaults to "neutral" — infers the best body profile. */
export function resolveWearerSex(
  gender: string | null | undefined,
  body: { chestCm?: number | null; waistCm?: number | null; hipCm?: number | null },
): { sex: WearerSex; source: "profile" | "inferred" } {
  const g = (gender || "").trim().toLowerCase();
  if (/^(female|feminine|woman|women|f|여성|여자)$/.test(g)) return { sex: "female", source: "profile" };
  if (/^(male|masculine|man|men|m|남성|남자)$/.test(g)) return { sex: "male", source: "profile" };
  // Inference from the body itself: a hip measurement clearly larger than the
  // chest with a defined waist reads female; otherwise male.
  const chest = body.chestCm ?? null;
  const waist = body.waistCm ?? null;
  const hip = body.hipCm ?? null;
  if (chest != null && hip != null && waist != null) {
    const hipOverChest = hip - chest;
    const waistRatio = waist / ((chest + hip) / 2);
    if (hipOverChest >= 2 || waistRatio <= 0.78) return { sex: "female", source: "inferred" };
  }
  return { sex: "male", source: "inferred" };
}

export interface BodyDNAInput {
  gender?: string | null;
  heightCm?: number | null;
  weightKg?: number | null;
  shoulderCm?: number | null;
  chestCm?: number | null;
  underbustCm?: number | null;
  waistCm?: number | null;
  hipCm?: number | null;
  upperArmCm?: number | null;
  thighCm?: number | null;
  inseamCm?: number | null;
  bodyShape?: string | null;
}

export function buildWearerBodyDNA(input: BodyDNAInput): WearerBodyDNA {
  const { sex, source } = resolveWearerSex(input.gender, {
    chestCm: input.chestCm,
    waistCm: input.waistCm,
    hipCm: input.hipCm,
  });
  const heightCm = input.heightCm ?? null;
  const weightKg = input.weightKg ?? null;
  const bmi = heightCm && weightKg ? Math.round((weightKg / Math.pow(heightCm / 100, 2)) * 10) / 10 : null;
  // Female-specific: underbust estimated from bust when not measured.
  const underbust =
    input.underbustCm ?? (sex === "female" && input.chestCm ? Math.round((input.chestCm - 12) * 10) / 10 : null);
  // Male pipeline prioritizes shoulder/chest/torso; female adds bust/underbust/seat.
  const seat = sex === "female" && input.hipCm ? Math.round((input.hipCm + 1) * 10) / 10 : input.hipCm ?? null;
  return {
    sex,
    sexSource: source,
    heightCm,
    weightKg,
    shoulderCm: input.shoulderCm ?? null,
    chestOrBustCm: input.chestCm ?? null,
    underbustCm: underbust,
    waistCm: input.waistCm ?? null,
    hipCm: input.hipCm ?? null,
    seatCm: seat,
    upperArmCm: input.upperArmCm ?? null,
    thighCm: input.thighCm ?? null,
    torsoLengthCm: heightCm ? Math.round(heightCm * (sex === "female" ? 0.31 : 0.32)) : null,
    legLengthCm: input.inseamCm ?? (heightCm ? Math.round(heightCm * 0.45) : null),
    bodyShape: input.bodyShape ?? null,
    bmi,
  };
}

function bodyValueFor(dna: WearerBodyDNA, region: string): number | null {
  switch (region) {
    case "shoulder":    return dna.shoulderCm;
    case "chest":
    case "bust":        return dna.chestOrBustCm;
    case "underbust":   return dna.underbustCm;
    case "waist":       return dna.waistCm;
    case "hip":         return dna.hipCm;
    case "seat":        return dna.seatCm;
    case "upperArm":    return dna.upperArmCm;
    case "thigh":       return dna.thighCm;
    case "inseam":      return dna.legLengthCm;
    case "torsoLength": return dna.torsoLengthCm;
    case "sleeve":      return dna.heightCm ? Math.round(dna.heightCm * 0.34) : null;
    case "rise":        return dna.heightCm ? Math.round(dna.heightCm * 0.16) : null;
    default:            return null; // length / legOpening are garment-absolute
  }
}

const LENGTH_REGIONS = new Set(["length", "sleeve", "inseam", "rise", "torsoLength"]);

// ─── Ease + tension ────────────────────────────────────────────────────────

/**
 * Category-aware expected ease (cm) at the chest/waist for a "regular" fit.
 * A t-shirt, a shirt, a jacket, a hoodie, a dress and jeans do NOT share
 * thresholds.
 */
const CATEGORY_EASE: Record<string, number> = {
  "t-shirt": 6,
  "tank-top": 4,
  "crop-top": 4,
  shirt: 10,
  blouse: 8,
  sweater: 10,
  hoodie: 16,
  jacket: 14,
  coat: 18,
  vest: 10,
  jeans: 2,
  trousers: 4,
  cargo: 6,
  joggers: 8,
  shorts: 4,
  skirt: 3,
  leggings: -2,
  "bodycon-dress": -1,
  "mini-dress": 4,
  "midi-dress": 5,
  "maxi-dress": 6,
  "loose-dress": 10,
};

export function expectedEaseCm(dna: GarmentDNA, region: string): number {
  const base = CATEGORY_EASE[dna.garmentType] ?? 6;
  const stretchRelief = (L3[dna.stretchLevel] ?? 0.5) * 4; // stretch needs less ease
  const intent = dna.intendedFit === "oversized" ? 10 : dna.intendedFit === "relaxed" ? 5 : dna.intendedFit === "slim" ? -2 : 0;
  const regionScale = region === "waist" ? 1.1 : region === "hip" ? 0.9 : region === "shoulder" ? 0.2 : 1;
  return Math.round((base - stretchRelief + intent) * regionScale * 10) / 10;
}

/** Normalized 0–1 tension for a region. 0.4–0.6 = regular. */
export function tensionFor(deltaCm: number, expectedEase: number, fabric: FabricBehavior): number {
  // How far the actual ease sits below (or above) the expected ease, scaled by
  // how much the fabric can absorb.
  const absorb = 6 + fabric.stretch * 10 + fabric.elasticity * 6; // cm of forgiveness
  const shortfall = expectedEase - deltaCm; // >0 = tighter than intended
  const t = 0.5 + (shortfall / absorb) * 0.5 + fabric.stiffness * 0.05 - fabric.drape * 0.03;
  return Math.max(0, Math.min(1, Math.round(t * 100) / 100));
}

export function stateFromTension(t: number): RegionFitState {
  if (t >= 0.9) return "too_tight";
  if (t >= 0.75) return "tight";
  if (t >= 0.6) return "fitted";
  if (t >= 0.4) return "regular";
  if (t >= 0.2) return "relaxed";
  if (t >= 0.1) return "loose";
  return "oversized";
}

function behaviorLine(region: string, state: RegionFitState, deltaCm: number | null, fabric: FabricBehavior): string {
  const amount = deltaCm == null ? "" : `${deltaCm > 0 ? "+" : ""}${deltaCm}cm`;
  const stretchy = fabric.stretch >= 0.7;
  const rigid = fabric.stiffness >= 0.7;
  switch (state) {
    case "too_tight":
      return rigid
        ? `${region}: ${amount} — rigid fabric cannot stretch: seams strain and pull, hard diagonal stress creases, restricted movement`
        : `${region}: ${amount} — fabric stretched to its limit, sharp horizontal tension lines, body contour clearly printing through`;
    case "tight":
      return stretchy
        ? `${region}: ${amount} — fabric hugs and follows the body contour, mild stretch lines, contour clearly visible`
        : `${region}: ${amount} — fabric pulls across the ${region}, visible tension creases, no slack`;
    case "fitted":
      return `${region}: ${amount} — close clean follow of the body with minimal slack`;
    case "regular":
      return `${region}: ${amount} — natural ease, soft clean drape, no tension and no excess volume`;
    case "relaxed":
      return `${region}: ${amount} — visible extra room, soft folds hanging away from the body`;
    case "loose":
      return `${region}: ${amount} — clearly loose, deep folds, fabric falls away from the ${region}`;
    case "oversized":
      return `${region}: ${amount} — oversized volume, dropped/displaced seams, heavy blanket-like drape`;
  }
}

// ─── Main builder ──────────────────────────────────────────────────────────

export interface BuildFitRenderStateInput {
  garmentId: string;
  bodyDNA: WearerBodyDNA;
  garmentDNA: GarmentDNA;
  /** All available sizes with their PHYSICAL measurements. */
  sizes: SizeMeasurementInput[];
  selectedSize: string;
}

export function buildFitRenderState(input: BuildFitRenderStateInput): FitRenderState | null {
  const { bodyDNA, garmentDNA, sizes, selectedSize } = input;
  const norm = (s: string) => s.trim().toUpperCase();
  const row =
    sizes.find((s) => norm(s.size) === norm(selectedSize)) ??
    sizes.find((s) => norm(s.size).replace(/\s/g, "") === norm(selectedSize).replace(/\s/g, "")) ??
    null;
  if (!row) return null;

  const fabric = fabricFromDNA(garmentDNA);
  const measurements: Record<string, number> = {};
  const regions: RegionFitRow[] = [];
  const delta: Record<string, number> = {};
  const ease: Record<string, number> = {};
  const tension: Record<string, number> = {};
  const fitState: Record<string, RegionFitState> = {};

  for (const [regionKey, garmentValue] of Object.entries(row.measurements) as Array<[CorrelationRegion, number | null | undefined]>) {
    if (typeof garmentValue !== "number" || !Number.isFinite(garmentValue)) continue;
    measurements[regionKey] = garmentValue;
    const bodyCm = bodyValueFor(bodyDNA, regionKey);
    if (bodyCm == null) {
      // Garment-absolute region (length, leg opening) — still surfaced so the
      // renderer sees it change between sizes.
      regions.push({
        region: regionKey,
        bodyCm: null,
        garmentCm: garmentValue,
        deltaCm: null,
        easeCm: null,
        tension: null,
        state: "regular",
        behavior: `${regionKey}: garment measures ${garmentValue}cm at this size`,
      });
      continue;
    }
    const d = Math.round((garmentValue - bodyCm) * 10) / 10;
    const isLength = LENGTH_REGIONS.has(regionKey);
    const expected = isLength ? 0 : expectedEaseCm(garmentDNA, regionKey);
    // Effective ease: elastic fabric converts some compression into wearable ease.
    const effective = d < 0 ? Math.round((d + Math.abs(d) * fabric.stretch * 0.45) * 10) / 10 : d;
    const t = tensionFor(isLength ? effective : d, expected, fabric);
    const state = stateFromTension(t);
    delta[regionKey] = d;
    ease[regionKey] = effective;
    tension[regionKey] = t;
    fitState[regionKey] = state;
    regions.push({
      region: regionKey,
      bodyCm,
      garmentCm: garmentValue,
      deltaCm: d,
      easeCm: effective,
      tension: t,
      state,
      behavior: behaviorLine(regionKey, state, d, fabric),
    });
  }

  const priority = (bodyDNA.sex === "female" ? FEMALE_PRIORITY : MALE_PRIORITY).filter((r) => r in fitState);
  const weighted = priority.length ? priority : Object.keys(fitState);
  const avgTension = weighted.length
    ? weighted.reduce((sum, r, i) => sum + (tension[r] ?? 0.5) * (weighted.length - i), 0) /
      weighted.reduce((sum, _r, i) => sum + (weighted.length - i), 0)
    : 0.5;
  const overall = stateFromTension(Math.round(avgTension * 100) / 100);

  const bodyHash = hashOf(bodyDNA);
  const hash = hashOf({
    v: FIT_RENDER_STATE_VERSION,
    body: bodyHash,
    garment: input.garmentId,
    size: norm(selectedSize),
    measurements,
    fabric,
    sex: bodyDNA.sex,
    tension,
  });

  return {
    version: FIT_RENDER_STATE_VERSION,
    wearer: {
      type: "real_human",
      sex: bodyDNA.sex,
      sexSource: bodyDNA.sexSource,
      bodyDNA,
      bodyHash,
    },
    garment: {
      id: input.garmentId,
      category: garmentDNA.category,
      type: garmentDNA.garmentType,
      selectedSize,
      measurements,
      fabric,
      intendedFit: garmentDNA.intendedFit,
      measurementSource: row.source,
    },
    fit: {
      regions,
      delta,
      ease,
      tension,
      fitState,
      overall,
      priorityRegions: weighted,
    },
    hash,
  };
}

/** Dev diagnostics object (section T of the fit spec). */
export function describeRenderStateForDebug(s: FitRenderState | null, extra?: Record<string, unknown>) {
  if (!s) return { renderState: null, ...extra };
  return {
    selectedSize: s.garment.selectedSize,
    resolvedMeasurements: s.garment.measurements,
    measurementSource: s.garment.measurementSource,
    sex: s.wearer.sex,
    sexSource: s.wearer.sexSource,
    bodyDNA: s.wearer.bodyDNA,
    delta: s.fit.delta,
    ease: s.fit.ease,
    tension: s.fit.tension,
    fitState: s.fit.fitState,
    overall: s.fit.overall,
    fabric: s.garment.fabric,
    bodyHash: s.wearer.bodyHash,
    cacheKey: s.hash,
    ...extra,
  };
}
