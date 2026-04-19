// ─── OUTPUT VALIDATION ─────────────────────────────────────────────────────
// Calls fit-vision-analyze in "output" mode to score a Replicate result and
// decide whether the router should retry.

import { supabase } from "@/integrations/supabase/client";

export interface OutputValidation {
  passed: boolean;
  qualityScore: number;
  reasons: string[];
  raw?: Record<string, unknown>;
}

const MIN_QUALITY = 0.55;

export async function validateTryOnOutput(
  resultImageUrl: string,
  garmentImageUrl: string
): Promise<OutputValidation> {
  if (!resultImageUrl) return { passed: false, qualityScore: 0, reasons: ["missing_result"] };

  try {
    const { data, error } = await supabase.functions.invoke("fit-vision-analyze", {
      body: { mode: "output", imageUrl: resultImageUrl, garmentImageUrl },
    });
    if (error || !data?.result) {
      // Fail-open: if validator is down, we accept the result rather than
      // spending another generation. Better than blocking on infra hiccups.
      return { passed: true, qualityScore: 0.5, reasons: ["validator_unavailable"] };
    }
    const r = data.result as {
      person_present: boolean;
      garment_visible: boolean;
      garment_anchored: boolean;
      mannequin: boolean;
      duplicate_clothing: boolean;
      distortion: "none" | "mild" | "severe";
      matches_garment: boolean;
      quality_score: number;
      issues: string[];
    };

    const reasons: string[] = [];
    if (!r.person_present) reasons.push("no_person");
    if (!r.garment_visible) reasons.push("no_garment");
    if (!r.garment_anchored) reasons.push("garment_floating");
    if (r.mannequin) reasons.push("mannequin");
    if (r.duplicate_clothing) reasons.push("duplicate_clothing");
    if (r.distortion === "severe") reasons.push("severe_distortion");
    if (!r.matches_garment) reasons.push("garment_mismatch");

    const passed = reasons.length === 0 && (r.quality_score ?? 0) >= MIN_QUALITY;
    return { passed, qualityScore: r.quality_score ?? 0, reasons, raw: r };
  } catch (e) {
    console.warn("[validateTryOnOutput] threw", e);
    return { passed: true, qualityScore: 0.5, reasons: ["validator_threw"] };
  }
}
