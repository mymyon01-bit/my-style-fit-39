// ─── COMPOSITE FIT IMAGES (CLIENT WRAPPER) ──────────────────────────────────
// Calls the fit-composite edge function (two-image coordinate pipeline).
// On any failure, returns { ok:false, fallback:true } so callers cascade
// to the legacy single-pass fit-tryon-text path.

import { supabase } from "@/integrations/supabase/client";
import type { BodyFrame } from "./buildBodyFrame";
import type { GarmentOverlayMap } from "./buildGarmentOverlayMap";

export interface CompositeRequest {
  productKey: string;
  selectedSize: string;
  productImageUrl: string;
  productName?: string;
  productCategory?: string;
  gender?: string | null;
  bodyFrame: BodyFrame;
  overlay: GarmentOverlayMap;
  bodyImageUrl?: string | null;
  forceRegenerate?: boolean;
}

export interface CompositeSuccess {
  ok: true;
  compositeUrl: string;
  bodyBaseUrl?: string;
  overlayUrl?: string;
  cacheHit: boolean;
}

export interface CompositeFailure {
  ok: false;
  error: string;
  fallback: true;
}

export async function runCompositeFitTryOn(
  req: CompositeRequest
): Promise<CompositeSuccess | CompositeFailure> {
  try {
    const { data, error } = await supabase.functions.invoke("fit-composite", {
      body: {
        productKey: req.productKey,
        selectedSize: req.selectedSize,
        productImageUrl: req.productImageUrl,
        productName: req.productName,
        productCategory: req.productCategory,
        gender: req.gender,
        bodyFrame: {
          canvasWidth: req.bodyFrame.canvasWidth,
          canvasHeight: req.bodyFrame.canvasHeight,
          shoulderLineY: req.bodyFrame.shoulderLineY,
          chestLineY: req.bodyFrame.chestLineY,
          waistLineY: req.bodyFrame.waistLineY,
          hipLineY: req.bodyFrame.hipLineY,
          hemLineY: req.bodyFrame.hemLineY,
          leftShoulderX: req.bodyFrame.leftShoulderX,
          rightShoulderX: req.bodyFrame.rightShoulderX,
          bodySummary: req.bodyFrame.bodySummary,
        },
        overlay: req.overlay,
        bodyImageUrl: req.bodyImageUrl ?? null,
        forceRegenerate: req.forceRegenerate ?? false,
      },
    });
    if (error) return { ok: false, error: error.message || "invoke_failed", fallback: true };
    if (!data?.ok || !data?.compositeUrl) {
      return { ok: false, error: data?.error || "no_composite", fallback: true };
    }
    return {
      ok: true,
      compositeUrl: data.compositeUrl,
      bodyBaseUrl: data.bodyBaseUrl,
      overlayUrl: data.overlayUrl,
      cacheHit: !!data.cacheHit,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "composite_failed",
      fallback: true,
    };
  }
}
