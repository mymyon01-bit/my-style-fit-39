// ─── FIT EXPLANATION LAYER ──────────────────────────────────────────────────
// PARALLEL computation layer. DOES NOT modify the image generation pipeline.
// Runs AFTER existing fit output is generated and appends a structured
// fit_score / fit_summary / key_feedback / size_advice payload, plus a
// visual-consistency description that matches the calculated fit.
//
// Per spec:
//   1. INPUT  → user body (height, weight) + selected item + selected size
//   2. STEP 1 → estimate body measurements with the heuristic model
//   3. STEP 2 → use real garment data if present, else category averages
//   4. STEP 3 → compute delta = garment - body
//   5. STEP 4 → classify (tight / perfect / relaxed / oversized)
//   6. SCORE  → base 100 ± penalties / preference bonus
//   7. EXPLAIN → JSON payload + visual-consistency text
//
// Pure functions. No side effects. Recompute on size/item change.

export type FitClass = "tight" | "perfect" | "relaxed" | "oversized";
export type WeightBand = "under" | "normal" | "over";
export type FitPref = "tight" | "regular" | "relaxed" | "oversized" | null;

export interface FitLayerInput {
  /** User body — height in cm (required), weight in kg (optional). */
  heightCm: number;
  weightKg?: number | null;
  /** Selected item meta — only category + optional real garment measurements. */
  category: string;                // e.g. "tops", "bottoms", "outerwear"
  selectedSize: string;            // e.g. "M", "L", "32"
  /** If real garment data exists for the selected size, pass it. Else null. */
  garment?: Partial<GarmentDims> | null;
  /** Optional user preference (used for the bonus). */
  preference?: FitPref;
}

export interface GarmentDims {
  chest: number;     // cm — flat width × 2 OR circumference (we treat as circumference-equivalent)
  shoulder: number;  // cm
  length: number;    // cm
  waist: number;     // cm
  hip: number;       // cm
  thigh: number;     // cm
  inseam: number;    // cm
  sleeve: number;    // cm
}

export interface RegionDelta {
  region: string;
  bodyCm: number;
  garmentCm: number;
  deltaCm: number;     // garment - body
  classification: FitClass;
}

export interface FitLayerOutput {
  fit_score: number;                       // 0..100
  fit_summary: string;                     // one-line plain English
  key_feedback: string[];                  // up to 4 short bullets
  size_advice: string;                     // actionable suggestion
  /** Description that visually matches the calculation. NOT used to regenerate the image. */
  visual_description: string;
  /** Internal numbers for debug / UI panels. */
  debug: {
    body: BodyDims;
    garment: GarmentDims;
    regions: RegionDelta[];
    weightBand: WeightBand;
  };
}

export interface BodyDims {
  chest: number;
  waist: number;
  shoulder: number;
  thigh: number;
  hip: number;
  inseam: number;
  sleeve: number;
  length: number; // ideal top length reference (~ torso)
}

// ─── STEP 1 — body estimate (heuristic, deterministic) ──────────────────────
// Per spec ratios. Weight band adjusts uniformly: under -3%, over +5..10%.
function estimateBody(heightCm: number, weightKg: number | null | undefined): {
  body: BodyDims;
  band: WeightBand;
} {
  const h = Math.max(120, Math.min(220, heightCm || 170));
  const base: BodyDims = {
    chest:    h * 0.53,
    waist:    h * 0.45,
    shoulder: h * 0.25,
    thigh:    h * 0.30,
    hip:      h * 0.52,
    inseam:   h * 0.45,
    sleeve:   h * 0.34,
    length:   h * 0.40, // reference torso/top length
  };

  let band: WeightBand = "normal";
  let factor = 1.0;
  if (weightKg && h > 0) {
    const bmi = weightKg / Math.pow(h / 100, 2);
    if (bmi < 18.5) { band = "under"; factor = 0.97; }       // -3%
    else if (bmi >= 25 && bmi < 28) { band = "over"; factor = 1.05; } // +5%
    else if (bmi >= 28) { band = "over"; factor = 1.10; }    // +10%
  }

  // Length-type fields don't scale with weight.
  const skipScale = new Set<keyof BodyDims>(["inseam", "sleeve", "length"]);
  const body: BodyDims = { ...base };
  (Object.keys(body) as (keyof BodyDims)[]).forEach((k) => {
    if (!skipScale.has(k)) body[k] = round1(body[k] * factor);
    else body[k] = round1(body[k]);
  });
  return { body, band };
}

// ─── STEP 2 — category-average garment measurements ─────────────────────────
// Used only when real data is missing. Numbers are size-M baselines per spec
// example, scaled per-size with a simple grade.
const CATEGORY_M_BASE: Record<string, GarmentDims> = {
  tops: {
    chest: 108, shoulder: 46, length: 70, waist: 100, hip: 104,
    thigh: 0, inseam: 0, sleeve: 62,
  },
  outerwear: {
    chest: 116, shoulder: 48, length: 74, waist: 108, hip: 112,
    thigh: 0, inseam: 0, sleeve: 64,
  },
  bottoms: {
    chest: 0, shoulder: 0, length: 102, waist: 82, hip: 100,
    thigh: 60, inseam: 80, sleeve: 0,
  },
  shoes: {
    chest: 0, shoulder: 0, length: 0, waist: 0, hip: 0, thigh: 0, inseam: 0, sleeve: 0,
  },
  accessories: {
    chest: 0, shoulder: 0, length: 0, waist: 0, hip: 0, thigh: 0, inseam: 0, sleeve: 0,
  },
};

const SIZE_GRADE: Record<string, number> = {
  XXS: -3, XS: -2, S: -1, M: 0, L: 1, XL: 2, XXL: 3, XXXL: 4,
};
// Numeric waist sizes (28/30/32/34/36) → grade vs 32.
function numericGrade(size: string): number | null {
  const n = parseInt(size, 10);
  if (!isFinite(n)) return null;
  if (n >= 24 && n <= 46) return (n - 32) / 2; // each step ≈ 1 grade
  return null;
}

function gradedGarment(category: string, size: string): GarmentDims {
  const cat = (category || "tops").toLowerCase();
  const base = CATEGORY_M_BASE[cat] ?? CATEGORY_M_BASE.tops;
  const upperSize = size?.toUpperCase() ?? "M";
  const grade = SIZE_GRADE[upperSize] ?? numericGrade(size) ?? 0;
  // Per-grade increments (cm): widths grow ~4cm/step, lengths ~1.5cm/step.
  const widthStep = 4;
  const lengthStep = 1.5;
  const sleeveStep = 1.5;
  return {
    chest:    base.chest    ? round1(base.chest    + grade * widthStep)  : 0,
    shoulder: base.shoulder ? round1(base.shoulder + grade * (widthStep / 2)) : 0,
    length:   base.length   ? round1(base.length   + grade * lengthStep) : 0,
    waist:    base.waist    ? round1(base.waist    + grade * widthStep)  : 0,
    hip:      base.hip      ? round1(base.hip      + grade * widthStep)  : 0,
    thigh:    base.thigh    ? round1(base.thigh    + grade * (widthStep / 2)) : 0,
    inseam:   base.inseam   ? round1(base.inseam   + grade * lengthStep) : 0,
    sleeve:   base.sleeve   ? round1(base.sleeve   + grade * sleeveStep) : 0,
  };
}

function mergeGarment(estimate: GarmentDims, real?: Partial<GarmentDims> | null): GarmentDims {
  if (!real) return estimate;
  const out = { ...estimate };
  (Object.keys(estimate) as (keyof GarmentDims)[]).forEach((k) => {
    const v = real[k];
    if (typeof v === "number" && isFinite(v) && v > 0) out[k] = round1(v);
  });
  return out;
}

// ─── STEP 4 — classify a delta (cm) ────────────────────────────────────────
function classify(delta: number): FitClass {
  const d = Math.abs(delta);
  if (delta < 0) return "tight";       // garment smaller than body
  if (d < 2)   return "tight";
  if (d <= 6)  return "perfect";
  if (d <= 12) return "relaxed";
  return "oversized";
}

// ─── SCORE — base 100 with penalties + preference bonus ────────────────────
function scoreFromRegions(regions: RegionDelta[], pref: FitPref): number {
  let score = 100;
  let tightPenalty = 0;
  let oversizedPenalty = 0;
  for (const r of regions) {
    if (r.classification === "tight") {
      // Heavier penalty as the negative delta grows.
      const mag = Math.max(0, -r.deltaCm);   // cm "missing"
      tightPenalty += 8 + mag * 1.5;          // ~8 + 1.5/cm shortfall
    } else if (r.classification === "oversized") {
      const excess = Math.max(0, r.deltaCm - 12);
      oversizedPenalty += 5 + excess * 0.8;
    } else if (r.classification === "relaxed") {
      // Relaxed is acceptable but slight penalty.
      oversizedPenalty += 2;
    }
  }
  score -= tightPenalty + oversizedPenalty;

  // Preference match bonus — up to +8.
  if (pref) {
    const dominant = dominantClass(regions);
    if (dominant === pref || prefAlias(dominant, pref)) score += 8;
  }
  return clamp(Math.round(score), 0, 100);
}
function prefAlias(c: FitClass, p: FitPref): boolean {
  if (!p) return false;
  if (p === "regular" && c === "perfect") return true;
  return false;
}
function dominantClass(regions: RegionDelta[]): FitClass {
  const counts: Record<FitClass, number> = { tight: 0, perfect: 0, relaxed: 0, oversized: 0 };
  for (const r of regions) counts[r.classification]++;
  return (Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] as FitClass) ?? "perfect";
}

// ─── REGION SET per category ────────────────────────────────────────────────
function regionsFor(category: string, body: BodyDims, garment: GarmentDims): RegionDelta[] {
  const cat = (category || "tops").toLowerCase();
  const make = (region: string, b: number, g: number): RegionDelta | null => {
    if (!b || !g) return null;
    const delta = round1(g - b);
    return { region, bodyCm: round1(b), garmentCm: round1(g), deltaCm: delta, classification: classify(delta) };
  };
  const list: (RegionDelta | null)[] = [];
  if (cat === "bottoms") {
    list.push(make("Waist", body.waist, garment.waist));
    list.push(make("Hip", body.hip, garment.hip));
    list.push(make("Thigh", body.thigh, garment.thigh));
    list.push(make("Inseam", body.inseam, garment.inseam));
  } else {
    list.push(make("Shoulder", body.shoulder, garment.shoulder));
    list.push(make("Chest", body.chest, garment.chest));
    list.push(make("Waist", body.waist, garment.waist));
    list.push(make("Length", body.length, garment.length));
    list.push(make("Sleeve", body.sleeve, garment.sleeve));
  }
  return list.filter((r): r is RegionDelta => !!r);
}

// ─── EXPLAIN — feedback + visual description ───────────────────────────────
function describeRegion(r: RegionDelta): string {
  const word = r.classification === "tight"
    ? (Math.abs(r.deltaCm) >= 4 ? "tight" : "slightly tight")
    : r.classification === "perfect"
    ? "comfortable"
    : r.classification === "relaxed"
    ? "relaxed"
    : "very loose";
  // Length regions frame as long/short rather than tight/loose.
  if (r.region === "Length" || r.region === "Inseam" || r.region === "Sleeve") {
    if (r.deltaCm < -2) return `${r.region} slightly short`;
    if (r.deltaCm > 6)  return `${r.region} slightly long`;
    return `${r.region} good length`;
  }
  return `${r.region} ${word}`;
}

function buildSummary(score: number, dominant: FitClass): string {
  if (score >= 85) return "Great match — sits well across most regions.";
  if (score >= 70) {
    if (dominant === "relaxed")   return "Comfortable, slightly relaxed wear.";
    if (dominant === "perfect")   return "Solid fit with minor trade-offs.";
    return "Wearable with small compromises.";
  }
  if (score >= 55) return "Acceptable, but expect noticeable fit issues.";
  return "Poor match — consider another size.";
}

function buildAdvice(regions: RegionDelta[], selectedSize: string): string {
  const tight = regions.filter(r => r.classification === "tight");
  const big   = regions.filter(r => r.classification === "oversized");
  if (tight.length >= 2) {
    return `Try one size up from ${selectedSize} for more room in ${tight.slice(0, 2).map(t => t.region.toLowerCase()).join(" and ")}.`;
  }
  if (tight.length === 1) {
    return `Try L for more comfort in ${tight[0].region.toLowerCase()}.`.replace("L", suggestUp(selectedSize));
  }
  if (big.length >= 2) {
    return `Consider one size down from ${selectedSize} for a cleaner silhouette.`;
  }
  return `${selectedSize} is a good pick at your measurements.`;
}
function suggestUp(size: string): string {
  const order = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL"];
  const i = order.indexOf(size?.toUpperCase());
  if (i >= 0 && i < order.length - 1) return order[i + 1];
  const n = parseInt(size, 10);
  if (isFinite(n)) return String(n + 2);
  return size;
}

function buildVisualDescription(regions: RegionDelta[]): string {
  const phrases: string[] = [];
  for (const r of regions) {
    if (r.classification === "tight" && (r.region === "Shoulder" || r.region === "Chest")) {
      phrases.push(`${r.region.toLowerCase()} sits close with mild tension lines`);
    } else if (r.classification === "perfect" && r.region === "Chest") {
      phrases.push("torso has moderate room");
    } else if (r.classification === "relaxed" && (r.region === "Chest" || r.region === "Waist")) {
      phrases.push(`${r.region.toLowerCase()} drapes with gentle slack`);
    } else if (r.classification === "oversized") {
      phrases.push(`${r.region.toLowerCase()} hangs noticeably loose`);
    } else if (r.region === "Length" && r.deltaCm < -2) {
      phrases.push("hem rides slightly above the natural line");
    } else if (r.region === "Length" && r.deltaCm > 6) {
      phrases.push("hem extends a bit past the natural line");
    } else if (r.region === "Sleeve" && r.deltaCm < -2) {
      phrases.push("sleeves end short of the wrist");
    }
  }
  if (!phrases.length) return "The garment sits cleanly across the body with a balanced silhouette.";
  // Capitalize first phrase.
  const first = phrases[0].charAt(0).toUpperCase() + phrases[0].slice(1);
  const rest = phrases.slice(1, 3);
  return rest.length ? `${first}, while ${rest.join(" and ")}.` : `${first}.`;
}

// ─── PUBLIC API ─────────────────────────────────────────────────────────────
/**
 * Compute the fit explanation layer. Pure function — call any time the user
 * changes size or item. Does NOT trigger image regeneration.
 */
export function computeFitExplanation(input: FitLayerInput): FitLayerOutput {
  const { body, band } = estimateBody(input.heightCm, input.weightKg);
  const estGarment = gradedGarment(input.category, input.selectedSize);
  const garment = mergeGarment(estGarment, input.garment);
  const regions = regionsFor(input.category, body, garment);
  const fit_score = scoreFromRegions(regions, input.preference ?? null);
  const dominant = dominantClass(regions);
  const fit_summary = buildSummary(fit_score, dominant);
  const key_feedback = regions.slice(0, 4).map(describeRegion);
  const size_advice = buildAdvice(regions, input.selectedSize);
  const visual_description = buildVisualDescription(regions);

  return {
    fit_score,
    fit_summary,
    key_feedback,
    size_advice,
    visual_description,
    debug: { body, garment, regions, weightBand: band },
  };
}

/** Convenience: serialize the spec-shaped JSON envelope. */
export function toExplanationEnvelope(out: FitLayerOutput) {
  return {
    fit_score: out.fit_score,
    fit_summary: out.fit_summary,
    key_feedback: out.key_feedback,
    size_advice: out.size_advice,
  };
}

// ─── helpers ────────────────────────────────────────────────────────────────
function round1(n: number): number { return Math.round(n * 10) / 10; }
function clamp(n: number, lo: number, hi: number): number { return Math.max(lo, Math.min(hi, n)); }
