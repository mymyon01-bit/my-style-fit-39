// ─── HOUSE MODEL PERSONAS ───────────────────────────────────────────────────
// Fixed identity layer to prevent random faces/bodies across generations.
// Selection is deterministic given (gender + frame) so the same user sees
// the same model across products and sizes.

export type Gender = "female" | "male" | "neutral" | null | undefined;
export type Frame = "lean" | "athletic" | "slim" | "curvy" | "regular";

export interface Persona {
  id: string;
  description: string;
}

export const PERSONAS: Record<string, Persona> = {
  male_lean: {
    id: "male_lean",
    description:
      "male fashion model, lean build, neutral symmetrical face, short dark hair, light olive skin, clean jawline",
  },
  male_athletic: {
    id: "male_athletic",
    description:
      "male fashion model, athletic build, defined shoulders, neutral face, short brown hair, warm beige skin",
  },
  female_slim: {
    id: "female_slim",
    description:
      "female fashion model, slim build, neutral soft face, long straight brown hair, light skin, calm expression",
  },
  female_curvy: {
    id: "female_curvy",
    description:
      "female fashion model, balanced curvy build, neutral face, shoulder-length wavy hair, warm skin tone",
  },
  neutral_regular: {
    id: "neutral_regular",
    description:
      "fashion model, regular adult build, neutral face, medium-length dark hair, neutral skin tone",
  },
};

export function pickPersona(args: {
  gender?: Gender;
  heightCm?: number | null;
  weightKg?: number | null;
}): Persona {
  const g = (args.gender || "neutral").toLowerCase();
  const h = args.heightCm ?? 170;
  const w = args.weightKg ?? 65;
  // crude BMI-ish frame inference
  const bmi = w / Math.pow(h / 100, 2);

  if (g === "male") {
    if (bmi >= 24) return PERSONAS.male_athletic;
    return PERSONAS.male_lean;
  }
  if (g === "female") {
    if (bmi >= 24) return PERSONAS.female_curvy;
    return PERSONAS.female_slim;
  }
  return PERSONAS.neutral_regular;
}

/** Stronger size-behavior copy used inside prompts (PATCH 2). */
export function sizeBehaviorStrong(size: string, recommendedSize?: string): string {
  const raw = (size || "M").toString().trim();
  const s = raw.toUpperCase();

  // ── Letter sizes ────────────────────────────────────────────────
  if (s === "XS") return "very tight fit, fabric tension visible across chest, shorter cropped length, no excess fabric";
  if (s === "S")  return "tight fit, fabric tension visible, shorter length, snug shoulders";
  if (s === "M")  return "regular fit, balanced proportions, natural drape, true-to-size";
  if (s === "L")  return "clearly visible relaxed fit, slight shoulder drop, looser chest, soft folds at waist";
  if (s === "XL") return "noticeably oversized, dropped shoulders, longer hem, visibly baggy chest, generous drape";
  if (s === "XXL") return "very oversized, fully dropped shoulders, extra long hem, baggy throughout, heavy drape";

  // ── Numeric sizes (waist 28-40, EU 34-48, etc.) ────────────────
  const n = parseInt(raw, 10);
  if (!Number.isNaN(n)) {
    const ref = recommendedSize ? parseInt(recommendedSize, 10) : NaN;
    if (!Number.isNaN(ref)) {
      const diff = n - ref;
      if (diff <= -4) return "very tight fit, fabric tension visible, snug throughout";
      if (diff <= -2) return "tight fit, snug waist and hips, shorter length";
      if (diff === 0) return "regular fit, balanced proportions, natural drape, true-to-size";
      if (diff <= 2)  return "relaxed fit, looser waist, soft folds";
      if (diff <= 4)  return "noticeably loose fit, dropped waist, generous drape";
      return "very oversized, baggy throughout, heavy drape";
    }
    // No reference — infer by absolute number ranges
    if (n <= 28) return "tight fit, snug waist, shorter length";
    if (n <= 32) return "regular fit, balanced proportions, natural drape";
    if (n <= 36) return "relaxed fit, looser waist, soft folds";
    return "noticeably loose fit, generous drape";
  }

  return "regular fit, balanced proportions, natural drape";
}
