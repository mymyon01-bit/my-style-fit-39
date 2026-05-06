// ─── fitPrewarm — V4.0 background preparation orchestrator ───────────────
// Runs the deterministic, network-light parts of the FIT pipeline BEFORE
// the user taps TRY ON. Results land in `fitCache` keyed by body signature
// + product key, so the actual try-on can skip recomputation.
//
// What we prewarm (parallel):
//   • Garment DNA (deterministic — ~1ms)
//   • Gendered size context (deterministic)
//   • Brand fit bias lookup (deterministic)
//   • Image URL resolution / preload (network → browser cache)
//
// What we do NOT prewarm (heavy or render-stage):
//   • IDM-VTON / studio render
//   • Quality control (depends on rendered image)
//
// The entire prewarm is idempotent and abortable through the priority queue.

import { extractGarmentDNA, type GarmentDNA, type GarmentInferenceInput, type GarmentMacroCategory } from "./garmentDNA";
import {
  buildGenderedSizeContext,
  detectTargetGender,
  type GenderedSizeContext,
  type GenderDetectionInput,
  type BodyGender,
} from "./genderedSizeSystem";
import { getBrandFitBias, type BrandFitBias } from "./brandFitBias";
import { withFitCache } from "./fitCache";
import { registerAbort } from "./fitPriorityQueue";

export interface PrewarmInput {
  bodySignature: string;
  productKey: string;
  productName: string;
  productCategory?: string | null;
  brand?: string | null;
  productImageUrl?: string | null;
  selectedSize?: string | null;
  garmentInput: GarmentInferenceInput;
  genderDetection: GenderDetectionInput;
  bodyGender?: BodyGender;
  /** Macro category for the gendered size context (defaults to "tops"). */
  macroCategory?: GarmentMacroCategory;
}

export interface PrewarmResult {
  garmentDNA: GarmentDNA | null;
  genderedContext: GenderedSizeContext | null;
  brandBias: BrandFitBias | null;
  imageReady: boolean;
}

/** Preload an image so the browser/CDN cache is hot when render starts. */
function preloadImage(url: string, signal: AbortSignal): Promise<boolean> {
  return new Promise((resolve) => {
    if (!url) return resolve(false);
    const img = new Image();
    let done = false;
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      resolve(ok);
    };
    signal.addEventListener("abort", () => finish(false));
    img.onload = () => finish(true);
    img.onerror = () => finish(false);
    try {
      img.decoding = "async";
      img.referrerPolicy = "no-referrer";
      img.src = url;
    } catch {
      finish(false);
    }
  });
}

export async function prewarmFit(input: PrewarmInput): Promise<PrewarmResult> {
  const ctrl = registerAbort("prewarm");
  const sig = input.bodySignature;
  const pk = input.productKey;

  if (!sig || !pk) {
    return { garmentDNA: null, genderedContext: null, brandBias: null, imageReady: false };
  }

  try {
    const [garmentDNA, genderedContext, brandBias, imageReady] = await Promise.all([
      withFitCache<GarmentDNA>(
        { bodySignature: sig, productKey: pk, bucket: "garmentDNA" },
        async () => extractGarmentDNA(input.garmentInput),
      ).catch(() => null),
      withFitCache<GenderedSizeContext>(
        { bodySignature: sig, productKey: pk, selectedSize: input.selectedSize, bucket: "genderedSize" },
        async () =>
          buildGenderedSizeContext({
            body: { gender: input.bodyGender ?? null },
            detection: input.genderDetection,
            macro: input.macroCategory ?? "tops",
            selectedSizeLabel: input.selectedSize ?? "M",
            hasExactChart: false,
          }),
      ).catch(() => null),
      withFitCache<BrandFitBias | null>(
        { bodySignature: sig, productKey: pk, bucket: "brandBias" },
        async () => {
          const target = detectTargetGender(input.genderDetection).gender;
          return getBrandFitBias(
            input.brand || "",
            input.productCategory || "",
            target === "unknown" ? undefined : target,
          );
        },
      ).catch(() => null),
      input.productImageUrl
        ? preloadImage(input.productImageUrl, ctrl.signal)
        : Promise.resolve(false),
    ]);

    return {
      garmentDNA: garmentDNA ?? null,
      genderedContext: genderedContext ?? null,
      brandBias: brandBias ?? null,
      imageReady,
    };
  } catch (e) {
    console.warn("[fitPrewarm] failed", e);
    return { garmentDNA: null, genderedContext: null, brandBias: null, imageReady: false };
  }
}
