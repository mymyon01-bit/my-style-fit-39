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
export function sizeBehaviorStrong(size: string): string {
  const s = (size || "M").toUpperCase();
  if (s === "XS") return "very tight fit, fabric tension visible across chest, shorter cropped length, no excess fabric";
  if (s === "S")  return "tight fit, fabric tension visible, shorter length, snug shoulders";
  if (s === "M")  return "regular fit, balanced proportions, natural drape, true-to-size";
  if (s === "L")  return "clearly visible relaxed fit, slight shoulder drop, looser chest, soft folds at waist";
  if (s === "XL") return "noticeably oversized, dropped shoulders, longer hem, visibly baggy chest, generous drape";
  if (s === "XXL")return "very oversized, fully dropped shoulders, extra long hem, baggy throughout, heavy drape";
  return "regular fit, balanced proportions, natural drape";
}
