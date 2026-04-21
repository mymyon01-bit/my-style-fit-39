import { supabase } from "@/integrations/supabase/client";
import type {
  BodyMeasurements,
  GarmentMeasurements,
  FitGenerationResponse,
} from "@/lib/fit/v2/types";

export interface GenerateFitImageInput {
  body: BodyMeasurements;
  garment: GarmentMeasurements;
  garmentLabel: string;
  productImageUrl?: string | null;
  genderPresentation?: "feminine" | "masculine" | "neutral";
}

// Simple in-memory dedupe so duplicate parallel UI calls coalesce.
const inflight = new Map<string, Promise<FitGenerationResponse>>();

function keyOf(input: GenerateFitImageInput): string {
  return JSON.stringify({
    b: input.body,
    g: input.garment,
    l: input.garmentLabel,
    p: input.productImageUrl ?? null,
    s: input.genderPresentation ?? "neutral",
  });
}

export async function generateFitImage(
  input: GenerateFitImageInput
): Promise<FitGenerationResponse> {
  const k = keyOf(input);
  const existing = inflight.get(k);
  if (existing) return existing;

  const promise = (async (): Promise<FitGenerationResponse> => {
    const { data, error } = await supabase.functions.invoke("fit-generate-v2", {
      body: input,
    });
    if (error) {
      // UI must NEVER be blank — return a partial result with empty image.
      return {
        status: "error",
        fitResult: { chestDiff: 0, shoulderDiff: 0, lengthDiff: 0, sleeveDiff: 0 },
        fitAnalysis: {
          chestFit: "regular",
          lengthFit: "perfect",
          shoulderFit: "perfect",
          sleeveFit: "perfect",
          overall: "regular",
        },
        prompt: "",
        imageUrl: null,
        message: error.message ?? "fit-generate-v2 failed",
      };
    }
    return data as FitGenerationResponse;
  })().finally(() => {
    // Release after a short window so back-to-back UI calls still dedupe
    // but eventual retries are allowed.
    setTimeout(() => inflight.delete(k), 1500);
  });

  inflight.set(k, promise);
  return promise;
}
