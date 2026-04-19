// ─── GARMENT PREPROCESS ────────────────────────────────────────────────────
// Detects garment type (upper/lower/full) so the router can pick the right
// IDM-VTON `category`, and flags whether the source is on-model (which IDM
// handles less well than flat lay).

import { supabase } from "@/integrations/supabase/client";

export type GarmentType = "upper" | "lower" | "full" | "accessory" | "unknown";

export interface GarmentInfo {
  type: GarmentType;
  onModel: boolean;
  backgroundClean: boolean;
  confidence: number;
  issues: string[];
}

/** Cheap category-string heuristic used as a synchronous fallback. */
export function garmentTypeFromCategory(category?: string): GarmentType {
  const c = (category || "").toLowerCase();
  if (!c) return "unknown";
  if (c.includes("dress") || c.includes("jumpsuit") || c.includes("overall")) return "full";
  if (
    c.includes("pant") || c.includes("jean") || c.includes("trouser") ||
    c.includes("skirt") || c.includes("short") || c.includes("legging")
  ) return "lower";
  if (c.includes("shoe") || c.includes("bag") || c.includes("hat") || c.includes("acc")) return "accessory";
  return "upper";
}

/** Best-effort AI classification; falls back to category string. */
export async function preprocessGarment(
  imageUrl: string,
  category?: string
): Promise<GarmentInfo> {
  const fallbackType = garmentTypeFromCategory(category);
  if (!imageUrl) {
    return { type: fallbackType, onModel: false, backgroundClean: false, confidence: 0, issues: ["no_image"] };
  }
  try {
    const { data, error } = await supabase.functions.invoke("fit-vision-analyze", {
      body: { mode: "garment", imageUrl },
    });
    if (error || !data?.result) {
      return { type: fallbackType, onModel: false, backgroundClean: true, confidence: 0.4, issues: ["ai_unavailable"] };
    }
    const r = data.result as {
      garment_present: boolean;
      type: GarmentType;
      on_model: boolean;
      background_clean: boolean;
      confidence: number;
      issues: string[];
    };
    return {
      type: r.garment_present ? r.type : fallbackType,
      onModel: !!r.on_model,
      backgroundClean: !!r.background_clean,
      confidence: r.confidence ?? 0.5,
      issues: r.issues || [],
    };
  } catch (e) {
    console.warn("[preprocessGarment] failed", e);
    return { type: fallbackType, onModel: false, backgroundClean: true, confidence: 0.3, issues: ["threw"] };
  }
}
