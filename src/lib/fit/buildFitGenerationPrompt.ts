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

  const lines = [
    `A premium fashion image of a model wearing the selected garment.`,
    `Persona: ${persona.description} (id ${persona.id} — keep face/hair/body consistent across renders).`,
    ``,
    `Body:`,
    `- ${body.bodySummary}`,
    `- height ~${body.overallHeight} cm${body.bmi ? `, bmi ~${body.bmi}` : ""}`,
    `- shoulder ratio ${body.shoulderRatio.toFixed(2)}, chest ${body.chestRatio.toFixed(2)}, waist ${body.waistRatio.toFixed(2)}, hip ${body.hipRatio.toFixed(2)}, legs ${body.legRatio.toFixed(2)}`,
    ``,
    `Garment:`,
    `- type: ${product.garmentType}`,
    `- visual: ${product.visualSummary}`,
    product.color ? `- dominant color: ${product.color}` : null,
    product.printPlacement ? `- print: ${product.printPlacement}` : null,
    product.fabricWeight ? `- fabric weight: ${product.fabricWeight}` : null,
    `- style mood: ${product.styleMood}`,
    `- selected size: ${selectedSize}`,
    ``,
    `Fit coordinates (relative, drives how the garment sits on the body):`,
    `- chest ease: ${pct(fit.chestEase)}`,
    `- waist ease: ${pct(fit.waistEase)}`,
    `- hem ease: ${pct(fit.hemEase)}`,
    `- shoulder drop: ${pct(fit.shoulderDrop)}`,
    `- body length delta: ${fit.bodyLengthDelta >= 0 ? "+" : ""}${pct(fit.bodyLengthDelta)}`,
    fit.category !== "bottom" ? `- sleeve volume: ${pct(fit.sleeveVolume)}` : null,
    fit.category !== "bottom" ? `- sleeve length delta: ${fit.sleeveLengthDelta >= 0 ? "+" : ""}${pct(fit.sleeveLengthDelta)}` : null,
    `- drape depth: ${pct(fit.drapeDepth)}`,
    `- silhouette: ${fit.silhouetteType}`,
    ``,
    `Render intent:`,
    `Generate the garment as if it is worn on this body with realistic drape and dimensionality.`,
    `Result should feel like a soft 3D fashion render or premium e-commerce editorial image.`,
    `Show realistic garment volume, natural folds, subtle shadow depth, believable body-following fabric behavior.`,
    ``,
    `Camera: ${camera}.`,
    `Background: clean neutral studio backdrop, soft directional fashion lighting.`,
    ``,
    `Do NOT generate: mannequin, floating clothes, flat pasted product card, duplicate limbs, warped torso, text artifacts, fake logos, watermark, deformed hands, cheap CGI look.`,
  ];
  return lines.filter(Boolean).join("\n");
}
