// ─── FIT GENERATION PROMPT (coordinate-driven) ──────────────────────────────
// Combines BodyProfile + GarmentFitMap + ProductVisualDescriptor into a
// single structured prompt. Used by the text/reference Replicate path.

import type { BodyProfile } from "./buildBodyProfile";
import type { GarmentFitMap } from "./buildGarmentFitMap";
import type { ProductVisualDescriptor } from "./buildProductVisualDescriptor";
import { pickPersona, type Gender } from "./personas";

export interface FitGenerationPromptArgs {
  body: BodyProfile;
  fit: GarmentFitMap;
  product: ProductVisualDescriptor;
  selectedSize: string;
  hasBodyImage: boolean;
  gender?: Gender;
}

const pct = (n: number) => `${(n * 100).toFixed(0)}%`;

// Per-silhouette explicit language so the rendered image VISIBLY differs by size.
const SILHOUETTE_DIRECTIVE: Record<string, string> = {
  trim:
    "Render a TRIM, body-skimming silhouette: reduced chest room, tighter waist line, shorter body length, structured shoulder line, sleeves close to the arm.",
  fitted:
    "Render a FITTED silhouette: clean chest, defined waist, regular hem, structured shoulders, natural sleeve volume.",
  regular:
    "Render a REGULAR silhouette: balanced chest room, natural waist line, standard hem, neutral shoulder line, comfortable sleeves.",
  relaxed:
    "Render a RELAXED silhouette: visible chest room, softer waist line, slightly longer hem, slight shoulder drop, looser sleeves with soft drape.",
  oversized:
    "Render an OVERSIZED silhouette: generous chest volume, loose flowing waist, longer hem, pronounced shoulder drop, dropped sleeves with deep folds.",
};

export function buildFitGenerationPrompt(args: FitGenerationPromptArgs): string {
  const { body, fit, product, selectedSize, hasBodyImage } = args;
  const persona = pickPersona({
    gender: args.gender ?? null,
    heightCm: body.overallHeight,
    weightKg: null,
  });

  const camera = hasBodyImage
    ? "match the input body photo exactly (pose, framing, lighting)"
    : "front-facing or slight 3/4 standing fashion pose, full upper body visible";

  const sizeDirective =
    SILHOUETTE_DIRECTIVE[fit.silhouetteType] ?? SILHOUETTE_DIRECTIVE.regular;

  const lines = [
    `A premium fashion image of a model wearing the selected garment in size ${selectedSize}.`,
    `Persona: ${persona.description} (id ${persona.id} — keep face/hair/body consistent across renders).`,
    ``,
    `SIZE INTENT (${selectedSize} → ${fit.silhouetteType.toUpperCase()}):`,
    sizeDirective,
    ``,
    `Body:`,
    `- ${body.bodySummary}`,
    `- height ~${body.overallHeight} cm${body.bmi ? `, bmi ~${body.bmi}` : ""}`,
    `- shoulder ratio ${body.shoulderRatio.toFixed(2)}, chest ${body.chestRatio.toFixed(2)}, waist ${body.waistRatio.toFixed(2)}, hip ${body.hipRatio.toFixed(2)}, legs ${body.legRatio.toFixed(2)}, arms ${(body.armScale ?? 1).toFixed(2)}`,
    ``,
    `Garment:`,
    `- type: ${product.garmentType}`,
    `- visual: ${product.visualSummary}`,
    product.color ? `- dominant color: ${product.color}` : null,
    product.printPlacement ? `- print: ${product.printPlacement}` : null,
    product.fabricWeight ? `- fabric weight: ${product.fabricWeight}` : null,
    `- style mood: ${product.styleMood}`,
    ``,
    `Fit coordinates (relative — drives how the garment sits on the body):`,
    `- chest ease: ${pct(fit.chestEase)}`,
    `- waist ease: ${pct(fit.waistEase)}`,
    `- hem ease: ${pct(fit.hemEase)}`,
    `- shoulder drop: ${pct(fit.shoulderDrop)}`,
    `- body length delta: ${fit.bodyLengthDelta >= 0 ? "+" : ""}${pct(fit.bodyLengthDelta)}`,
    fit.category !== "bottom" ? `- sleeve volume: ${pct(fit.sleeveVolume)}` : null,
    fit.category !== "bottom" ? `- sleeve length delta: ${fit.sleeveLengthDelta >= 0 ? "+" : ""}${pct(fit.sleeveLengthDelta)}` : null,
    `- drape depth: ${pct(fit.drapeDepth)}`,
    ``,
    `Render intent:`,
    `Generate the garment as if it is worn on this body with realistic drape and dimensionality.`,
    `Result should feel like a soft 3D fashion render or premium e-commerce editorial image.`,
    `Show realistic garment volume, natural folds, subtle shadow depth, believable body-following fabric behavior.`,
    `The silhouette MUST visibly reflect the SIZE INTENT above — different sizes must look noticeably different.`,
    ``,
    `Camera: ${camera}.`,
    `Environment: clean neutral studio backdrop with a subtle floor line and soft wall shadow for real-world depth and natural human scale. Soft directional fashion lighting.`,
    ``,
    `Do NOT generate: mannequin, floating clothes, flat pasted product card, duplicate limbs, warped torso, text artifacts, fake logos, watermark, deformed hands, cheap CGI look, random props or chairs.`,
  ];
  return lines.filter(Boolean).join("\n");
}
