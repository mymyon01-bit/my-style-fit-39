// ─── FIT FEEDBACK SUBMISSION ────────────────────────────────────────────────
// Writes a row into `fit_feedback` so the learning loop in `brandCalibration`
// can aggregate it on future loads. Per spec [12]:
//   • size worn
//   • too_small / perfect / too_large
//   • area flags (chest, waist, shoulder, hip, sleeve, length)
// Stored with brand + category + body cluster for cohort-level learning.

import { supabase } from "@/integrations/supabase/client";
import type { Region } from "./types";

export type FitFeedbackType = "too_small" | "perfect" | "too_large";

export interface FitFeedbackInput {
  productKey: string;
  brand: string | null;
  category: string | null;
  productGender: string | null;
  userGender: string | null;
  recommendedSize: string | null;
  chosenSize: string;
  feedbackType: FitFeedbackType;
  feedbackAreas?: Region[];
  satisfaction?: number; // 1–5
  notes?: string | null;
  /** Coarse body cluster derived from BMI/height — used to scope learning. */
  bodyCluster?: string | null;
}

/**
 * Submit a fit feedback row. Returns the inserted row id on success or an
 * error message. Silent for unauthenticated callers — feedback requires login
 * because the RLS policy ties rows to auth.uid().
 */
export async function submitFitFeedback(
  input: FitFeedbackInput,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth?.user?.id;
  if (!userId) return { ok: false, error: "not_authenticated" };

  try {
    const { data, error } = await supabase
      .from("fit_feedback")
      .insert({
        user_id: userId,
        product_key: input.productKey,
        brand: input.brand,
        category: input.category,
        product_gender: input.productGender,
        user_gender: input.userGender,
        recommended_size: input.recommendedSize,
        chosen_size: input.chosenSize,
        feedback_type: input.feedbackType,
        feedback_areas: input.feedbackAreas ?? [],
        satisfaction: input.satisfaction ?? null,
        notes: input.notes ?? null,
        body_cluster: input.bodyCluster ?? null,
      })
      .select("id")
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    return { ok: true, id: data?.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
