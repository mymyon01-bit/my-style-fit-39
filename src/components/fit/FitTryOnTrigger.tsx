// ─── FIT TRY-ON TRIGGER ─────────────────────────────────────────────────────
// Headless component: mounts useAiTryOn the moment a product + size exist.
// Lives at the FitPage level so the AI generation kicks off immediately on
// product selection — independent of the active tab (SCAN / BODY / CHECK /
// RESULTS). When the user later opens RESULTS the image is already
// generated (or in flight) and rendered from the per-(product,size) cache.

import { useEffect } from "react";
import { useAiTryOn } from "@/hooks/useAiTryOn";
import type { TryOnUserBody } from "@/lib/fit/buildTryOnPrompt";

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
  body: TryOnUserBody;
}

export default function FitTryOnTrigger(props: Props) {
  // Mounting useAiTryOn with enabled=true is the trigger — its internal
  // effect runs on (productKey, selectedSize, bodyImageHash) change and
  // posts to the router / fit-tryon-text edge function immediately.
  const tryOn = useAiTryOn({
    enabled: true,
    userImageUrl: props.userImageUrl,
    productImageUrl: props.productImageUrl,
    productKey: props.productKey,
    productCategory: props.productCategory,
    productName: props.productName,
    productFitType: props.productFitType ?? null,
    selectedSize: props.selectedSize,
    bodyImageHash: props.bodyImageHash ?? null,
    body: props.body,
    productUrl: props.productUrl ?? null,
  });

  useEffect(() => {
    console.log("[FitTryOnTrigger] mounted/updated", {
      productKey: props.productKey,
      size: props.selectedSize,
      status: tryOn.status,
      hasImage: !!tryOn.imageUrl,
    });
  }, [props.productKey, props.selectedSize, tryOn.status, tryOn.imageUrl]);

  return null;
}
