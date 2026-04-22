// ─── UNIFIED TRY-ON IMAGE SOURCE SELECTION ─────────────────────────────────
// Single source of truth for image priority across FitVisual and TryOnPreviewModal.
//
// Priority (strict — generated wins over everything):
//   1. AI-generated try-on (state.aiImageUrl)
//   2. Composite canvas (state.compositeImageUrl)
//   3. Deterministic fallback canvas (state.fallbackImageUrl)
//   4. Local placeholder (state.localPlaceholderUrl)
//   5. Generic state.previewSrc (already prioritized by useCanvasTryOn)
//   6. Raw product image (last resort — never wins over a valid generated image)
//
// The user's original uploaded body image MUST NEVER appear here as a final
// preview — it's only an INPUT to the generation pipeline.

import type { CanvasTryOnState } from "@/hooks/useCanvasTryOn";

export type TryOnImageKind =
  | "ai"
  | "composite"
  | "fallback"
  | "placeholder"
  | "product"
  | null;

export interface BestTryOnImage {
  src: string | null;
  kind: TryOnImageKind;
  /** True if this is the final, AI-generated result. */
  isFinal: boolean;
}

export function getBestTryOnImageSource(
  state: Pick<
    CanvasTryOnState,
    | "aiImageUrl"
    | "compositeImageUrl"
    | "fallbackImageUrl"
    | "localPlaceholderUrl"
    | "previewSrc"
  >,
  productImageUrl?: string | null,
  excluded: string[] = []
): BestTryOnImage {
  const isUsable = (value: string | null | undefined): value is string =>
    typeof value === "string" && value.length > 0 && !excluded.includes(value);

  if (isUsable(state.aiImageUrl)) {
    return { src: state.aiImageUrl, kind: "ai", isFinal: true };
  }
  if (isUsable(state.compositeImageUrl)) {
    return { src: state.compositeImageUrl, kind: "composite", isFinal: false };
  }
  if (isUsable(state.fallbackImageUrl)) {
    return { src: state.fallbackImageUrl, kind: "fallback", isFinal: false };
  }
  if (isUsable(state.localPlaceholderUrl)) {
    return { src: state.localPlaceholderUrl, kind: "placeholder", isFinal: false };
  }
  if (isUsable(state.previewSrc)) {
    // previewSrc is the hook's own prioritized pick — should match one of the above.
    return { src: state.previewSrc, kind: "placeholder", isFinal: false };
  }
  if (isUsable(productImageUrl)) {
    return { src: productImageUrl, kind: "product", isFinal: false };
  }
  return { src: null, kind: null, isFinal: false };
}

export function describeKind(kind: TryOnImageKind): string {
  switch (kind) {
    case "ai":
      return "AI FIT RENDER";
    case "composite":
      return "INTERMEDIATE PREVIEW";
    case "fallback":
      return "INTERMEDIATE PREVIEW";
    case "placeholder":
      return "GENERATING…";
    case "product":
      return "REFERENCE";
    default:
      return "PREVIEW";
  }
}
