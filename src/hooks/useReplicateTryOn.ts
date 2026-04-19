// ─── REPLICATE TRY-ON HOOK ──────────────────────────────────────────────────
// Auto-invokes fit-tryon-router whenever product + size + body image are ready.
// Caches results by (productKey, size) within session and polls Replicate
// predictions to completion. Returns the generated image URL + a status flag
// that FitVisual uses to decide between primary (Replicate) and fallback
// (silhouette overlay) rendering.

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { preprocessBodyImage } from "@/lib/fit/preprocessBodyImage";

export type TryOnStatus =
  | "idle"
  | "generating"
  | "ready"
  | "fallback"
  | "error"
  | "invalid_body"; // body image quality gate failed — UI should prompt re-scan

interface Args {
  enabled: boolean;
  userImageUrl: string | null;
  productImageUrl: string;
  productKey: string;
  productCategory?: string;
  selectedSize: string;
  fitDescriptor?: string;
  regions?: { region: string; fit: string }[];
}

interface CacheEntry {
  url: string | null;
  provider: "replicate" | "gemini" | null;
  fallback: boolean;
}

const memoryCache = new Map<string, CacheEntry>();
const POLL_INTERVAL_MS = 2500;
const POLL_MAX_ATTEMPTS = 40; // ~100s

export function useReplicateTryOn(args: Args) {
  const { enabled, userImageUrl, productImageUrl, productKey, productCategory, selectedSize, fitDescriptor, regions } = args;

  const [status, setStatus] = useState<TryOnStatus>("idle");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [provider, setProvider] = useState<"replicate" | "gemini" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef(false);

  const cacheKey = `${productKey}::${selectedSize}`;

  useEffect(() => {
    cancelRef.current = false;

    if (!enabled || !userImageUrl || !productImageUrl || !productKey || !selectedSize) {
      setStatus("idle");
      setImageUrl(null);
      setProvider(null);
      return;
    }

    // Memory cache hit
    const cached = memoryCache.get(cacheKey);
    if (cached) {
      if (cached.url) {
        setImageUrl(cached.url);
        setProvider(cached.provider);
        setStatus(cached.fallback ? "fallback" : "ready");
        return;
      }
    }

    setStatus("generating");
    setImageUrl(null);
    setError(null);

    (async () => {
      try {
        // ── BODY QUALITY GATE ───────────────────────────────────────
        const processed = await preprocessBodyImage(userImageUrl);
        console.log("[useReplicateTryOn] preprocess", {
          body_valid: processed.valid,
          reason: processed.reason,
          crop_applied: processed.cropApplied,
          zoom_ratio: processed.zoomRatio,
          replicate_called: processed.valid,
          fallback_triggered: !processed.valid,
        });
        if (!processed.valid) {
          setStatus("invalid_body");
          setError(processed.reason || "body_image_invalid");
          return;
        }
        const cleanUserImage = processed.croppedImageUrl;

        const { data, error: invokeErr } = await supabase.functions.invoke("fit-tryon-router", {
          body: {
            userImageUrl: cleanUserImage,
            productImageUrl,
            productKey,
            productCategory,
            selectedSize,
            fitDescriptor,
            regions: regions || [],
            mode: "high",
          },
        });

        if (cancelRef.current) return;

        if (invokeErr) {
          console.error("[useReplicateTryOn] invoke error", invokeErr);
          setStatus("error");
          setError(invokeErr.message || "try-on request failed");
          return;
        }

        if (data?.error && !data?.resultImageUrl) {
          setStatus("error");
          setError(String(data.error));
          return;
        }

        // Inline succeeded
        if (data?.status === "succeeded" && data?.resultImageUrl) {
          memoryCache.set(cacheKey, {
            url: data.resultImageUrl,
            provider: data.provider || "replicate",
            fallback: data.provider === "gemini" && data.metadata?.fallback === true,
          });
          setImageUrl(data.resultImageUrl);
          setProvider(data.provider || "replicate");
          setStatus("ready");
          return;
        }

        // Async — poll Replicate prediction
        const predictionId = data?.predictionId;
        if (!predictionId) {
          setStatus("error");
          setError("no prediction id returned");
          return;
        }

        for (let i = 0; i < POLL_MAX_ATTEMPTS; i++) {
          if (cancelRef.current) return;
          await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

          const baseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fit-tryon-router?id=${encodeURIComponent(predictionId)}`;
          const { data: { session } } = await supabase.auth.getSession();
          const headers: Record<string, string> = {
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          };
          if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
          const r = await fetch(baseUrl, { headers });
          const polled = await r.json().catch(() => ({}));

          if (cancelRef.current) return;

          if (polled?.status === "succeeded" && polled?.resultImageUrl) {
            memoryCache.set(cacheKey, {
              url: polled.resultImageUrl,
              provider: polled.provider || "replicate",
              fallback: false,
            });
            setImageUrl(polled.resultImageUrl);
            setProvider(polled.provider || "replicate");
            setStatus("ready");
            return;
          }
          if (polled?.status === "failed") {
            setStatus("error");
            setError(polled.error || "generation failed");
            return;
          }
          // else still starting/processing → keep polling
        }

        setStatus("error");
        setError("generation timed out");
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
