// ─── BODY RESOLVER ──────────────────────────────────────────────────────────
// Merge user-provided measurements with inferred anthropometry into a single
// ResolvedBody. Each measurement is tagged with its provenance so the UI can
// honestly tell the user which numbers are estimated.

import {
  estimateAnthropometry,
  asExact,
  asInferred,
  asDefault,
} from "./anthropometry";
import type { Gender, BodyType, ResolvedBody, MeasurementValue } from "./types";

export interface BodyResolverInput {
  gender?: string | null;
  /** Slim / regular / solid / heavy — drives the deterministic weight_adj. */
  bodyType?: string | null;
  heightCm?: number | null;
  weightKg?: number | null;
  shoulderCm?: number | null;
  chestCm?: number | null;
  waistCm?: number | null;
  hipCm?: number | null;
  inseamCm?: number | null;
  sleeveCm?: number | null;
  thighCm?: number | null;
  /** Per-region body-type multipliers (slim/regular/solid/heavy etc.). */
  shapeScales?: {
    shoulderWidthScale?: number;
    chestScale?: number;
    waistScale?: number;
    hipScale?: number;
    legScale?: number;
  } | null;
}

const DEFAULT_HEIGHT = 172;
const DEFAULT_WEIGHT = 68;

function normalizeGender(g?: string | null): Gender {
  const v = (g || "").toLowerCase();
  if (v.startsWith("m") || v === "men" || v === "masculine") return "male";
  if (v.startsWith("f") || v === "women" || v === "feminine") return "female";
  return "neutral";
}

function normalizeBodyType(t?: string | null): BodyType | null {
  const v = (t || "").toLowerCase().trim();
  if (!v) return null;
  if (/slim|lean|thin|skinny/.test(v)) return "slim";
  if (/regular|normal|average|balanced|athletic/.test(v)) return "regular";
  if (/solid|muscular|stocky|broad/.test(v)) return "solid";
  if (/heavy|fuller|plus|large/.test(v)) return "heavy";
  return null;
}

function pick(value: number | null | undefined, fallback: number, source: "inferred" | "default"): MeasurementValue {
  if (typeof value === "number" && value > 0) return asExact(value);
  return source === "inferred" ? asInferred(fallback) : asDefault(fallback);
}

/** Merge raw input + anthropometric estimates. */
export function resolveBody(input: BodyResolverInput): ResolvedBody {
  const gender = normalizeGender(input.gender);
  const heightProvided = typeof input.heightCm === "number" && input.heightCm > 0;
  const weightProvided = typeof input.weightKg === "number" && input.weightKg > 0;

  const heightCm: MeasurementValue = heightProvided
    ? asExact(input.heightCm!)
    : asDefault(DEFAULT_HEIGHT);
  const weightCm: MeasurementValue | null = weightProvided
    ? asExact(input.weightKg!)
    : null;

  // Estimate every segment with the deterministic spec formulas (height +
  // gender + bodyType weight_adj). When bodyType is missing we derive an adj
  // from BMI so the same H/W still always produces the same numbers.
  const est = estimateAnthropometry({
    gender,
    heightCm: heightCm.cm,
    weightKg: weightCm?.cm ?? null,
    bodyType: normalizeBodyType(input.bodyType),
    shapeScales: input.shapeScales ?? null,
  });

  // For each region, prefer user-provided value, else mark inferred.
  // If even height was missing we mark "default" to be extra honest.
  const inferenceSource = heightProvided ? "inferred" : "default";

  const shoulderCm = pick(input.shoulderCm, est.shoulderCm, inferenceSource);
  const chestCm    = pick(input.chestCm,    est.chestCm,    inferenceSource);
  const waistCm    = pick(input.waistCm,    est.waistCm,    inferenceSource);
  const hipCm      = pick(input.hipCm,      est.hipCm,      inferenceSource);
  const inseamCm   = pick(input.inseamCm,   est.inseamCm,   inferenceSource);
  const sleeveCm   = pick(input.sleeveCm,   est.sleeveCm,   inferenceSource);
  const thighCm    = pick(input.thighCm,    est.thighCm,    inferenceSource);

  const inferredFieldNames: string[] = [];
  const fields: [string, MeasurementValue][] = [
    ["shoulder", shoulderCm],
    ["chest",    chestCm],
    ["waist",    waistCm],
    ["hip",      hipCm],
    ["inseam",   inseamCm],
    ["sleeve",   sleeveCm],
    ["thigh",    thighCm],
  ];
  for (const [name, m] of fields) {
    if (m.source !== "exact") inferredFieldNames.push(name);
  }

  const bmi = weightCm
    ? Math.round((weightCm.cm / Math.pow(heightCm.cm / 100, 2)) * 10) / 10
    : null;

  return {
    gender,
    heightCm,
    weightKg: weightCm,
    shoulderCm,
    chestCm,
    waistCm,
    hipCm,
    inseamCm,
    sleeveCm,
    thighCm,
    bmi,
    hasInferredFields: inferredFieldNames.length > 0,
    inferredFieldNames,
  };
}
