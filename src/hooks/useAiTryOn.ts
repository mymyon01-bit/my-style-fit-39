// ─── useAiTryOn — HYBRID AI TRY-ON HOOK ─────────────────────────────────────
// Strategy:
//   • If user has a body photo → call fit-tryon-router (Replicate IDM-VTON,
//     Perplexity fallback). This is the "real you wearing it" path.
//   • If no body photo → call fit-tryon-text with a prompt built from body
//     metrics + product data. Generic realistic model, but visibly responds
//     to size.
// Both paths cache by (user_id + product_key + selected_size) in fit_tryons.

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useReplicateTryOn, type TryOnStatus, type TryOnProvider } from "@/hooks/useReplicateTryOn";
import { buildTryOnPrompt, type TryOnUserBody, type TryOnProductInfo } from "@/lib/fit/buildTryOnPrompt";

interface Args {
  enabled: boolean;
  /** Optional body photo URL — when present we use the photo-based pipeline. */
  userImageUrl: string | null;
  productImageUrl: string;
  productKey: string;
  productCategory?: string;
  productName: string;
  productFitType?: string | null;
  selectedSize: string;
  /** Body metrics for the text-prompt fallback. */
  body: TryOnUserBody;
  /** Optional context fed to the photo-based router. */
  fitDescriptor?: string;
  regions?: { region: string; fit: string }[];
  productUrl?: string | null;
  productImagesFallback?: (string | null | undefined)[];
  /** PATCH 4 — when set, also prewarm this size in the background on mount. */
  prewarmSize?: string | null;
}

interface State {
  status: TryOnStatus;
  imageUrl: string | null;
  provider: TryOnProvider | "replicate-text";
  error: string | null;
  cacheHit: boolean;
  prompt: string | null;
  mode: "photo" | "text";
}

const TEXT_CACHE = new Map<string, { url: string; cacheHit: boolean }>();

export function useAiTryOn(args: Args) {
  const hasPhoto = !!args.userImageUrl;

  // ── PATH A: photo-based (delegate to existing hook) ──────────────────────
  const photo = useReplicateTryOn({
    enabled: args.enabled && hasPhoto,
    userImageUrl: args.userImageUrl,
    productImageUrl: args.productImageUrl,
    productKey: args.productKey,
    productCategory: args.productCategory,
    selectedSize: args.selectedSize,
    fitDescriptor: args.fitDescriptor,
    regions: args.regions,
    productUrl: args.productUrl,
    productImagesFallback: args.productImagesFallback,
  });

  // ── PATH B: text-prompt fallback ─────────────────────────────────────────
  const [textState, setTextState] = useState<State>({
    status: "idle",
    imageUrl: null,
    provider: null,
    error: null,
    cacheHit: false,
    prompt: null,
    mode: "text",
  });
  const cancelRef = useRef(false);

  // Run text path when:
  //   • no photo, OR
  //   • photo path failed (invalid_body / error / missing_image)
  const photoFailed =
    hasPhoto && (photo.status === "invalid_body" || photo.status === "error" || photo.status === "missing_image");
  const shouldRunText = args.enabled && (!hasPhoto || photoFailed);

  useEffect(() => {
    cancelRef.current = false;
    if (!shouldRunText) {
      if (!args.enabled) {
        setTextState((s) => ({ ...s, status: "idle", imageUrl: null, error: null }));
      }
      return;
    }
    if (!args.productKey || !args.selectedSize) return;

    const product: TryOnProductInfo = {
      title: args.productName,
      category: args.productCategory ?? null,
      fitType: args.productFitType ?? null,
    };
    const prompt = buildTryOnPrompt({
      user: args.body,
      product,
      selectedSize: args.selectedSize,
      recommendedSize: args.prewarmSize ?? undefined,
    });

    const cacheKey = `${args.productKey}::${args.selectedSize}::text`;
    const mem = TEXT_CACHE.get(cacheKey);
    if (mem) {
      setTextState({
        status: "ready",
        imageUrl: mem.url,
        provider: "replicate-text",
        error: null,
        cacheHit: true,
        prompt,
        mode: "text",
      });
      console.log("[useAiTryOn]", { mode: "text", cacheHit: true, key: cacheKey });
      return;
    }

    setTextState((s) => ({ ...s, status: "generating", prompt, error: null }));
    const startedAt = performance.now();

    // Client-side hard guard — must exceed server poll budget (25s) + slack.
    const guardTimer = setTimeout(() => {
      if (cancelRef.current) return;
      setTextState((s) => {
        if (s.status !== "generating") return s;
        console.warn("[useAiTryOn] client guard: 30s exceeded, falling back");
        return { ...s, status: "fallback", error: "timeout_30s" };
      });
    }, 30_000);

    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("fit-tryon-text", {
          body: {
            prompt,
            productKey: args.productKey,
            selectedSize: args.selectedSize,
            productImageUrl: args.productImageUrl,
          },
        });
        clearTimeout(guardTimer);
        if (cancelRef.current) return;
        const elapsed = Math.round(performance.now() - startedAt);

        if (error || !data?.resultImageUrl) {
          console.warn("[useAiTryOn]", {
            mode: "text",
            success: false,
            error: error?.message || data?.error || "unknown",
            elapsed,
          });
          setTextState({
            status: "error",
            imageUrl: null,
            provider: "replicate-text",
            error: error?.message || data?.error || "generation_failed",
            cacheHit: false,
            prompt,
            mode: "text",
          });
          return;
        }

        TEXT_CACHE.set(cacheKey, { url: data.resultImageUrl, cacheHit: !!data.cacheHit });
        console.log("[useAiTryOn]", {
          mode: "text",
          success: true,
          cacheHit: !!data.cacheHit,
          elapsed,
          size: args.selectedSize,
          nearestSize: data.nearestSize ?? null,
        });
        setTextState({
          status: "ready",
          imageUrl: data.resultImageUrl,
          provider: "replicate-text",
          error: null,
          cacheHit: !!data.cacheHit,
          prompt,
          mode: "text",
        });
      } catch (e) {
        clearTimeout(guardTimer);
        if (cancelRef.current) return;
        console.error("[useAiTryOn] text path crash", e);
        setTextState({
          status: "error",
          imageUrl: null,
          provider: "replicate-text",
          error: e instanceof Error ? e.message : "unknown",
          cacheHit: false,
          prompt,
          mode: "text",
        });
      }
    })();

    return () => {
      cancelRef.current = true;
      clearTimeout(guardTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldRunText, args.productKey, args.selectedSize]);

  // ── PATCH 4 — BACKGROUND PREWARM ─────────────────────────────────────────
  // Fire-and-forget generation for a default/recommended size so that when
  // the user clicks it, the cache already has it.
  useEffect(() => {
    if (!args.enabled) return;
    // Skip prewarm only when photo path is clearly working
    if (hasPhoto && !photoFailed && photo.status !== "idle") return;
    const warm = args.prewarmSize;
    if (!warm || warm === args.selectedSize) return;
    if (!args.productKey) return;
    const warmKey = `${args.productKey}::${warm}::text`;
    if (TEXT_CACHE.has(warmKey)) return;

    const product: TryOnProductInfo = {
      title: args.productName,
      category: args.productCategory ?? null,
      fitType: args.productFitType ?? null,
    };
    const prompt = buildTryOnPrompt({ user: args.body, product, selectedSize: warm, recommendedSize: warm });

    const run = () => {
      supabase.functions
        .invoke("fit-tryon-text", {
          body: {
            prompt,
            productKey: args.productKey,
            selectedSize: warm,
            productImageUrl: args.productImageUrl,
          },
        })
        .then(({ data }) => {
          if (data?.resultImageUrl) {
            TEXT_CACHE.set(warmKey, { url: data.resultImageUrl, cacheHit: !!data.cacheHit });
            console.log("[useAiTryOn] prewarm ok", { size: warm });
          }
        })
        .catch((e) => console.warn("[useAiTryOn] prewarm fail", e));
    };
    const ric = (globalThis as any).requestIdleCallback;
    if (typeof ric === "function") ric(run, { timeout: 2000 });
    else setTimeout(run, 600);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [args.enabled, hasPhoto, args.productKey, args.prewarmSize]);

  // ── Output selection ──────────────────────────────────────────────────
  // If photo path is actively producing/produced something usable, return it.
  // Otherwise (idle, invalid_body, error, missing_image), fall back to the
  // text path so the VISUAL FIT block is never blank.
  const photoUsable =
    hasPhoto &&
    (photo.status === "ready" ||
      photo.status === "fallback" ||
      photo.status === "generating" ||
      photo.status === "resolving_image");

  if (photoUsable) {
    return {
      status: photo.status,
      imageUrl: photo.imageUrl,
      provider: photo.provider,
      error: photo.error,
      cacheHit: false,
      prompt: null,
      mode: "photo" as const,
    };
  }

  // text-state may still be `idle` if effect hasn't fired — surface as generating
  // so the UI shows the loading skeleton rather than a blank.
  if (hasPhoto && textState.status === "idle") {
    console.log("[useAiTryOn] photo path unusable, deferring to text", { photoStatus: photo.status });
  }
  return textState;
}

export type { TryOnStatus };
