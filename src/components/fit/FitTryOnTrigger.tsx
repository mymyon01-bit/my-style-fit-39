// ─── FIT TRY-ON TRIGGER ─────────────────────────────────────────────────────
// Headless component: pre-warms the canvas pipeline (pose detect + garment
// cutout) the moment a product + size exist, even before the user opens
// the RESULTS tab. Mounting `useCanvasTryOn` is the trigger — the canvas
// composite is cached in-memory by the cutout/pose hooks so the eventual
// FitVisual render is instant.

import { useEffect } from "react";
import { useCanvasTryOn } from "@/hooks/useCanvasTryOn";

interface Props {
  productKey: string;
  productImageUrl: string;
  productName: string;
  productCategory?: string;
  productFitType?: string | null;
  productUrl?: string | null;
  selectedSize: string;
  userImageUrl: string | null;
  bodyImageHash?: string | null;
  body: {
    heightCm?: number | null;
    weightKg?: number | null;
    shoulderWidthCm?: number | null;
    chestCm?: number | null;
    waistCm?: number | null;
    gender?: string | null;
  };
}

export default function FitTryOnTrigger(props: Props) {
  const tryOn = useCanvasTryOn({
    enabled: true,
    productKey: props.productKey,
    productImageUrl: props.productImageUrl,
    productName: props.productName,
    productCategory: props.productCategory,
    productFitType: props.productFitType ?? null,
    selectedSize: props.selectedSize,
    userImageUrl: props.userImageUrl,
    body: props.body,
    enableAiSwap: false, // pre-warm only — RESULTS tab handles AI swap
  });

  useEffect(() => {
    console.log("[FitTryOnTrigger] mounted/updated", {
      productKey: props.productKey,
      size: props.selectedSize,
      stage: tryOn.stage,
      hasImage: !!tryOn.imageUrl,
      poseSource: tryOn.poseSource,
    });
  }, [props.productKey, props.selectedSize, tryOn.stage, tryOn.imageUrl, tryOn.poseSource]);

  return null;
}
