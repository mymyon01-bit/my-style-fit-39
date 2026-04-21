import type { BodyMeasurements, FitAnalysis } from "./types";
import { describeBuild } from "./body";

export interface PromptContext {
  body: BodyMeasurements;
  analysis: FitAnalysis;
  garmentLabel: string;       // e.g. "black oversized t-shirt"
  genderPresentation?: "feminine" | "masculine" | "neutral";
}

export function buildPrompt(ctx: PromptContext): string {
  const build = describeBuild(ctx.body);
  const subject = ctx.genderPresentation === "feminine" ? "female" : ctx.genderPresentation === "masculine" ? "male" : "person";

  const chestLine = chestSentence(ctx.analysis.chestFit);
  const sleeveLine = sleeveSentence(ctx.analysis.sleeveFit);
  const shoulderLine = shoulderSentence(ctx.analysis.shoulderFit);
  const lengthLine = lengthSentence(ctx.analysis.lengthFit);

  return [
    `A ${build} ${subject}, ${ctx.body.height}cm, wearing a ${ctx.garmentLabel}.`,
    chestLine,
    sleeveLine,
    shoulderLine,
    lengthLine,
    "Realistic fashion photography, clean studio background, neutral lighting, full-body front view.",
  ].join(" ");
}

function chestSentence(f: FitAnalysis["chestFit"]): string {
  if (f === "tight") return "The chest area is slightly tight.";
  if (f === "loose") return "The chest area sits relaxed with extra room.";
  return "The chest fits naturally.";
}

function sleeveSentence(f: FitAnalysis["sleeveFit"]): string {
  if (f === "short") return "The sleeves end above the wrist.";
  if (f === "long") return "The sleeves cover past the wrist.";
  return "The sleeves end at the wrist.";
}

function shoulderSentence(f: FitAnalysis["shoulderFit"]): string {
  if (f === "tight") return "The shoulder seam sits slightly inward.";
  if (f === "dropped") return "The shoulder seam drops past the natural shoulder.";
  return "The shoulder seam sits at the natural shoulder line.";
}

function lengthSentence(f: FitAnalysis["lengthFit"]): string {
  if (f === "short") return "The garment length is shorter than ideal.";
  if (f === "long") return "The garment length is longer than ideal.";
  return "The garment length sits at an ideal hem position.";
}
