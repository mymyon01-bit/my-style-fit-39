// ─── REPLICATE TRY-ON HOOK ──────────────────────────────────────────────────
// End-to-end pipeline:
//   1. Body quality gate  (preprocessBodyImage — local + AI bbox)
//   2. Garment classification (preprocessGarment — AI type)
//   3. Replicate via fit-tryon-router
//   4. Output validation  (validateTryOnOutput — AI vision)
//   5. One retry with stricter prompt + forceRegenerate if step 4 fails
// All steps log a single structured line so we can audit the funnel.

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { preprocessBodyImage } from "@/lib/fit/preprocessBodyImage";
import { preprocessGarment, garmentTypeFromCategory, type GarmentType } from "@/lib/fit/preprocessGarment";
import { validateTryOnOutput } from "@/lib/fit/validateOutput";
import { resolveProductImage } from "@/lib/discover/resolveProductImage";

export type TryOnStatus =
  | "idle"
  | "generating"
  | "resolving_image"
  | "missing_image"
  | "ready"
  | "fallback"
  | "error"
  | "invalid_body";

interface Args {
  enabled: boolean;
  userImageUrl: string | null;
  productImageUrl: string;
  productKey: string;
  productCategory?: string;
  selectedSize: string;
  fitDescriptor?: string;
  regions?: { region: string; fit: string }[];
  /** Optional context used to auto-recover a missing product image */
  productUrl?: string | null;
  productImagesFallback?: (string | null | undefined)[];
}

export type TryOnProvider = "replicate" | "perplexity" | null;

interface CacheEntry {
  url: string | null;
  provider: TryOnProvider;
  fallback: boolean;
}

const memoryCache = new Map<string, CacheEntry>();
const POLL_INTERVAL_MS = 2500;
const POLL_MAX_ATTEMPTS = 40;

export function useReplicateTryOn(args: Args) {
  const { enabled, userImageUrl, productImageUrl, productKey, productCategory, selectedSize, fitDescriptor, regions, productUrl, productImagesFallback } = args;

  const [status, setStatus] = useState<TryOnStatus>("idle");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [provider, setProvider] = useState<TryOnProvider>(null);
  const [error, setError] = useState<string | null>(null);
  const [resolvedProductImage, setResolvedProductImage] = useState<string | null>(null);
  const cancelRef = useRef(false);

  const cacheKey = `${productKey}::${selectedSize}`;

  useEffect(() => {
    cancelRef.current = false;

    if (!enabled || !userImageUrl || !productKey || !selectedSize) {
      setStatus("idle");
      setImageUrl(null);
      setProvider(null);
      return;
    }

    const cached = memoryCache.get(cacheKey);
    if (cached?.url) {
      setImageUrl(cached.url);
      setProvider(cached.provider);
      setStatus(cached.fallback ? "fallback" : "ready");
      return;
    }

    setStatus("generating");
    setImageUrl(null);
    setError(null);

    (async () => {
      // ── 0. PRODUCT IMAGE GUARD + RECOVERY ───────────────────────
      let workingProductImage = productImageUrl;
      const looksUsable = (u: string | null | undefined) =>
        !!u && /^(https?:\/\/|data:image\/)/i.test(String(u).trim()) &&
        String(u).trim() !== "null" && String(u).trim() !== "undefined";

      if (!looksUsable(workingProductImage)) {
        setStatus("resolving_image");
        console.log("[tryon-pipeline]", { stage: "image_guard", product_image_missing: true });
        const resolved = await resolveProductImage({
          id: productKey,
          image: productImageUrl,
          images: productImagesFallback,
          url: productUrl,
          category: productCategory,
        });
        if (cancelRef.current) return;
        if (!resolved) {
          console.warn("[tryon-pipeline]", { stage: "image_guard", recovered: false, replicate_called: false });
          setStatus("missing_image");
          setError("missing_image");
          return;
        }
        workingProductImage = resolved.url;
        setResolvedProductImage(resolved.url);
        console.log("[tryon-pipeline]", { stage: "image_guard", recovered: true, source: resolved.source });
        setStatus("generating");
      }
      try {
        // ── 1. BODY GATE ────────────────────────────────────────────
        const body = await preprocessBodyImage(userImageUrl);
        if (!body.valid) {
          console.log("[tryon-pipeline]", {
            stage: "body",
            body_valid: false,
            reason: body.reason,
            replicate_called: false,
            fallback_triggered: true,
          });
          setStatus("invalid_body");
          setError(body.reason || "body_image_invalid");
          return;
        }

        // ── 2. GARMENT CLASSIFICATION ───────────────────────────────
        const garment = await preprocessGarment(workingProductImage, productCategory);
        const garmentType: GarmentType = garment.type !== "unknown"
          ? garment.type
          : garmentTypeFromCategory(productCategory);

        console.log("[tryon-pipeline]", {
          stage: "preprocess",
          body_valid: true,
          bbox_size: body.bbox ? Number((body.bbox.w * body.bbox.h).toFixed(2)) : null,
          pose_quality: body.confidence ?? null,
          framing: body.framing,
          garment_type: garmentType,
          garment_on_model: garment.onModel,
        });

        // ── 3. REPLICATE (with built-in retry on validation failure) ─
        const runReplicate = async (force: boolean, strict: boolean) => {
          const { data, error: invokeErr } = await supabase.functions.invoke("fit-tryon-router", {
            body: {
              userImageUrl: body.croppedImageUrl,
              productImageUrl: workingProductImage,
              productKey,
              productCategory: garmentType === "lower" ? `${productCategory || ""} pants`.trim()
                              : garmentType === "full" ? `${productCategory || ""} dress`.trim()
                              : productCategory,
              selectedSize,
              fitDescriptor: strict ? `${fitDescriptor || "regular"} (strict alignment)` : fitDescriptor,
              regions: regions || [],
              mode: "high",
              forceRegenerate: force,
            },
          });
          return { data, invokeErr };
        };

        const finalize = async (resultUrl: string, _providerName: TryOnProvider) => {
          // ── 4. OUTPUT VALIDATION ────────────────────────────────
          const validation = await validateTryOnOutput(resultUrl, productImageUrl);
          console.log("[tryon-pipeline]", {
            stage: "validate",
            replicate_success: true,
            validation_passed: validation.passed,
            quality_score: validation.qualityScore,
            reasons: validation.reasons,
          });
          return validation;
        };

        const handleResult = async (
          data: any,
          attempt: 1 | 2
        ): Promise<{ done: boolean; resultUrl?: string; provider?: TryOnProvider }> => {
          if (data?.error && !data?.resultImageUrl) {
            return { done: true };
          }

          let resultUrl: string | null = null;
          let providerName: TryOnProvider = (data?.provider as TryOnProvider) || "replicate";

          if (data?.status === "succeeded" && data?.resultImageUrl) {
            resultUrl = data.resultImageUrl;
          } else if (data?.predictionId) {
            for (let i = 0; i < POLL_MAX_ATTEMPTS; i++) {
              if (cancelRef.current) return { done: true };
              await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
              const baseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fit-tryon-router?id=${encodeURIComponent(data.predictionId)}`;
              const { data: { session } } = await supabase.auth.getSession();
              const headers: Record<string, string> = { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY };
              if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
              const r = await fetch(baseUrl, { headers });
              const polled = await r.json().catch(() => ({}));
              if (polled?.status === "succeeded" && polled?.resultImageUrl) {
                resultUrl = polled.resultImageUrl;
                providerName = polled.provider || providerName;
                break;
              }
              if (polled?.status === "failed") return { done: true };
            }
          }

          if (!resultUrl) return { done: true };

          const validation = await finalize(resultUrl, providerName);
          if (validation.passed || attempt === 2) {
            return { done: true, resultUrl, provider: providerName };
          }
          return { done: false }; // retry
        };

        // First pass
        const first = await runReplicate(false, false);
        if (cancelRef.current) return;
        if (first.invokeErr) {
          setStatus("error");
          setError(first.invokeErr.message || "try-on request failed");
          return;
        }
        let outcome = await handleResult(first.data, 1);

        // Retry with stricter prompt + forced regeneration if validation failed
        if (!outcome.done || (!outcome.resultUrl && !cancelRef.current)) {
          if (!outcome.resultUrl) {
            console.log("[tryon-pipeline]", { stage: "retry", retry_used: true, reason: "validation_failed" });
            const second = await runReplicate(true, true);
            if (cancelRef.current) return;
            if (second.invokeErr) {
              setStatus("error");
              setError(second.invokeErr.message || "retry failed");
              return;
            }
            outcome = await handleResult(second.data, 2);
          }
        }

        if (cancelRef.current) return;

        if (outcome.resultUrl) {
          const isFallback = outcome.provider === "perplexity";
          memoryCache.set(cacheKey, {
            url: outcome.resultUrl,
            provider: outcome.provider || "replicate",
            fallback: isFallback,
          });
          console.log("[tryon-pipeline]", {
            stage: "final",
            final_provider: outcome.provider,
            fallback_used: isFallback,
          });
          setImageUrl(outcome.resultUrl);
          setProvider(outcome.provider || "replicate");
          setStatus(isFallback ? "fallback" : "ready");
        } else {
          setStatus("error");
          setError("generation failed");
        }
      } catch (e) {
        if (cancelRef.current) return;
        console.error("[useReplicateTryOn] unexpected", e);
        setStatus("error");
        setError(e instanceof Error ? e.message : "unknown error");
      }
    })();

    return () => {
      cancelRef.current = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, userImageUrl, productImageUrl, productKey, selectedSize]);

  return { status, imageUrl, provider, error };
}
