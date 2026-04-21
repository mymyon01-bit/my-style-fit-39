// ─── Module E — FitPromptBuilder ─────────────────────────────────────────────
// Turns the FitComputationResult + body + garment + visual adjustments into
// a structured, formula-driven image prompt. NEVER ad-libs.

import type {
  FitComputationResult,
  FitVisualPrompt,
  GarmentMeasurementProfile,
  UserBodyProfile,
} from "./types";
import { computeVisualAdjustments } from "./coordinateMapper";
import { describeBuild, FIT_PREFERENCE_LABEL, GENDER_LABEL } from "./userBodyProfile";

const CATEGORY_NOUN: Record<GarmentMeasurementProfile["category"], string> = {
  top: "t-shirt", shirt: "shirt", jacket: "jacket", coat: "coat", hoodie: "hoodie",
  pants: "pants", jeans: "jeans", skirt: "skirt", dress: "dress",
};

export function buildFitPrompt(
  body: UserBodyProfile,
  garment: GarmentMeasurementProfile,
  fit: FitComputationResult,
): FitVisualPrompt {
  const adj = computeVisualAdjustments(fit);
  const noun = CATEGORY_NOUN[garment.category];

  // 1. Subject
  const subjectDescription =
    `A ${describeBuild(body)} ${GENDER_LABEL[body.genderPresentation]} model, ` +
    `${Math.round(body.heightCm)}cm tall, ${Math.round(body.weightKg)}kg, ` +
    `front-facing, neutral standing pose, hands relaxed at sides`;

  // 2. Garment
  const garmentDescription =
    `wearing a size ${garment.sizeLabel} ${garment.brand ? garment.brand + " " : ""}${noun}` +
    `${garment.fitType ? ` with a ${FIT_PREFERENCE_LABEL[garment.fitType]} cut` : ""}` +
    `, true to the product image's color, fabric and styling`;

  // 3. Fit description — region-by-region, deterministic
  const notable = fit.regions
    .filter(r => r.label !== "n/a")
    .map(r => r.visualEffect)
    .filter(Boolean);

  const silhouetteWord =
    adj.silhouette === "fitted" ? "fitted, body-following silhouette"
    : adj.silhouette === "oversized" ? "boldly oversized silhouette"
    : adj.silhouette === "relaxed" ? "relaxed, easy silhouette"
    : "clean, balanced silhouette";

  const fitDescription =
    `The garment shows a ${silhouetteWord}. ` +
    `Specifically: ${notable.join("; ")}. ` +
    `Overall fit reads as ${fit.overallFit}.`;

  // 4. Rendering style
  const renderingStyle =
    "Premium editorial ecommerce photography, soft directional studio lighting, " +
    "neutral seamless background, realistic fabric drape and tension, " +
    "subtle natural shadows, sharp focus, full-body framing from head to mid-thigh or full-length depending on garment, " +
    "photorealistic, no text, no watermark, no extra people";

  const finalPrompt = [
    subjectDescription,
    garmentDescription + ".",
    fitDescription,
    renderingStyle + ".",
  ].join(" ");

  return { subjectDescription, garmentDescription, fitDescription, renderingStyle, finalPrompt };
}
