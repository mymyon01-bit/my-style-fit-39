// ─── BRAND FIT BIAS — V3.8 ─────────────────────────────────────────────────
// Lightweight brand/category fit memory. Uses localStorage today (no DB
// migration required) — designed so a future move to a `brand_fit_bias`
// Postgres table is a drop-in replacement for the storage layer only.
//
// Surface area is intentionally narrow: get/record/apply.

export interface BrandFitBias {
  brand: string;
  category: string;
  /** -1 (runs small) … 0 (true-to-size) … +1 (runs large) */
  shoulderBias: number;
  chestBias: number;
  waistBias: number;
  hipBias: number;
  /** Sample count — bias only takes effect once a minimum signal is reached. */
  samples: number;
  updatedAt: number;
}

type Feedback = "tooTight" | "tooLoose" | "accurate";

const KEY = "mymyon.fit.brandBias.v1";
const MIN_SAMPLES = 3;
const STEP = 0.15;

function readAll(): Record<string, BrandFitBias> {
  try {
    if (typeof localStorage === "undefined") return {};
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Record<string, BrandFitBias>) : {};
  } catch { return {}; }
}
function writeAll(map: Record<string, BrandFitBias>) {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch { /* quota / SSR — ignore */ }
}
function biasKey(brand: string, category: string) {
  return `${(brand || "").toLowerCase().trim()}::${(category || "").toLowerCase().trim()}`;
}

export function getBrandFitBias(brand: string, category: string): BrandFitBias | null {
  if (!brand || !category) return null;
  const map = readAll();
  return map[biasKey(brand, category)] ?? null;
}

export function recordFitFeedback(args: {
  brand: string;
  category: string;
  feedback: Feedback;
  /** Region the user complained about — defaults to "chest". */
  region?: "shoulder" | "chest" | "waist" | "hip";
}) {
  const { brand, category, feedback } = args;
  if (!brand || !category) return;
  const map = readAll();
  const key = biasKey(brand, category);
  const now = Date.now();
  const existing: BrandFitBias = map[key] ?? {
    brand, category,
    shoulderBias: 0, chestBias: 0, waistBias: 0, hipBias: 0,
    samples: 0, updatedAt: now,
  };
  // tooTight = garment runs SMALL → push bias toward -1.
  // tooLoose = garment runs LARGE → push bias toward +1.
  // accurate = pull all biases toward 0 by half-step.
  const region = args.region ?? "chest";
  const field = (`${region}Bias`) as keyof Pick<BrandFitBias, "shoulderBias" | "chestBias" | "waistBias" | "hipBias">;
  const current = existing[field];
  if (feedback === "tooTight") existing[field] = Math.max(-1, current - STEP);
  else if (feedback === "tooLoose") existing[field] = Math.min(1, current + STEP);
  else {
    existing.shoulderBias *= 0.5;
    existing.chestBias *= 0.5;
    existing.waistBias *= 0.5;
    existing.hipBias *= 0.5;
  }
  existing.samples += 1;
  existing.updatedAt = now;
  map[key] = existing;
  writeAll(map);
}

/**
 * Apply a brand bias to a body measurement BEFORE running the correlation
 * engine. Increases body cm if the brand runs small (so deltas reflect the
 * expected real-world fit). Returns the same body if bias is too weak.
 */
export function applyBrandFitBias<T extends Record<string, number | null | undefined>>(
  body: T,
  brand: string,
  category: string,
  /** How aggressive the adjustment is. 1 = full strength. */
  strength = 1,
): T {
  const bias = getBrandFitBias(brand, category);
  if (!bias || bias.samples < MIN_SAMPLES) return body;
  const adjust = (value: number | null | undefined, b: number) =>
    typeof value === "number" ? Math.round((value - b * strength * 2) * 10) / 10 : value;
  return {
    ...body,
    shoulderCm: adjust(body.shoulderCm as any, bias.shoulderBias),
    chestCm:    adjust(body.chestCm as any, bias.chestBias),
    waistCm:    adjust(body.waistCm as any, bias.waistBias),
    hipCm:      adjust(body.hipCm as any, bias.hipBias),
  } as T;
}
