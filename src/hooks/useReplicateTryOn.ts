import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { preprocessBodyImage } from "@/lib/fit/preprocessBodyImage";
import { preprocessGarment, garmentTypeFromCategory, type GarmentType } from "@/lib/fit/preprocessGarment";
import { resolveProductImage } from "@/lib/discover/resolveProductImage";
import {
  type FitVisualState,
  TRYON_CLIENT_TIMEOUT_MS,
  TRYON_ACTIVE_REQUEST_MS,
  isActiveTryOnAge,
  logTryOnClient,
  makeErrorState,
  makeFallbackState,
  makeIdleState,
  makeLoadingState,
  makeSuccessState,
  normalizeTryOnSource,
  readStoredTryOnSuccess,
  readTryOnCacheRecord,
  storeTryOnSuccess,
  clearStoredTryOn,
} from "@/lib/fit/tryOnState";

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
  productUrl?: string | null;
  productImagesFallback?: (string | null | undefined)[];
  reloadToken?: number;
}

export type TryOnProvider = "replicate" | "perplexity" | null;

interface CacheEntry {
  url: string;
  provider: TryOnProvider;
}

interface RequestResult {
  visualState: FitVisualState;
  resolvedProductImage: string | null;
}

const memoryCache = new Map<string, CacheEntry>();
const activePhotoRequests = new Map<string, { startedAt: number; promise: Promise<RequestResult> }>();

const toStatus = (state: FitVisualState): TryOnStatus => {
  switch (state.kind) {
    case "loading":
      return "generating";
    case "success":
      return "ready";
    case "fallback":
      return "fallback";
    case "error":
      return "error";
    default:
      return "idle";
  }
};

async function runPhotoTryOnRequest(args: Args): Promise<RequestResult> {
  const startedAt = Date.now();
  const stored = readStoredTryOnSuccess(args.productKey, args.selectedSize);
  if (stored?.kind === "success") {
    logTryOnClient("CACHE_HIT", {
      productKey: args.productKey,
      selectedSize: args.selectedSize,
      startedAt,
      provider: stored.source,
      status: "stored_success",
      cacheLayer: "local_storage",
    });
    return { visualState: stored, resolvedProductImage: null };
  }

  const cached = memoryCache.get(`${args.productKey}::${args.selectedSize}`);
  if (cached?.url) {
    logTryOnClient("CACHE_HIT", {
      productKey: args.productKey,
      selectedSize: args.selectedSize,
      startedAt,
      provider: cached.provider,
      status: "memory_success",
      cacheLayer: "memory",
    });
    return {
      visualState: makeSuccessState(
        args.selectedSize,
        cached.url,
        normalizeTryOnSource(cached.provider, "replicate")
      ),
      resolvedProductImage: null,
    };
  }

  const cacheRecord = await readTryOnCacheRecord({
    productKey: args.productKey,
    selectedSize: args.selectedSize,
    successFallbackSource: "replicate",
  });

  if (cacheRecord.kind === "success") {
    logTryOnClient("CACHE_HIT", {
      productKey: args.productKey,
      selectedSize: args.selectedSize,
      startedAt,
      provider: cacheRecord.provider,
      status: "db_success",
      cacheLayer: "database",
    });
    return {
      visualState: makeSuccessState(args.selectedSize, cacheRecord.imageUrl, cacheRecord.provider),
      resolvedProductImage: null,
    };
  }

  if (cacheRecord.kind === "stale") {
    logTryOnClient("CACHE_MISS", {
      productKey: args.productKey,
      selectedSize: args.selectedSize,
      startedAt,
      provider: cacheRecord.provider,
      status: cacheRecord.status,
      reason: "stale_pending_ignored",
      ageMs: cacheRecord.ageMs,
    });
  } else if (cacheRecord.kind === "pending") {
    logTryOnClient("CACHE_MISS", {
      productKey: args.productKey,
      selectedSize: args.selectedSize,
      startedAt,
      provider: cacheRecord.provider,
      status: cacheRecord.status,
      reason: isActiveTryOnAge(cacheRecord.ageMs) ? "active_pending_found" : "retry_after_pending",
      ageMs: cacheRecord.ageMs,
    });
  } else {
    logTryOnClient("CACHE_MISS", {
      productKey: args.productKey,
      selectedSize: args.selectedSize,
      startedAt,
      status: cacheRecord.kind === "failed" ? cacheRecord.status : "miss",
      reason: cacheRecord.kind,
    });
  }

  let workingProductImage = args.productImageUrl;
  let resolvedProductImage: string | null = null;
  const looksUsable = (u: string | null | undefined) =>
    !!u && /^(https?:\/\/|data:image\/)/i.test(String(u).trim()) &&
    String(u).trim() !== "null" && String(u).trim() !== "undefined";

  if (!looksUsable(workingProductImage)) {
    const resolved = await resolveProductImage({
      id: args.productKey,
      image: args.productImageUrl,
      images: args.productImagesFallback,
      url: args.productUrl,
      category: args.productCategory,
    });
    if (!resolved) {
      return {
        visualState: makeFallbackState(args.selectedSize, "missing_image"),
        resolvedProductImage: null,
      };
    }
    workingProductImage = resolved.url;
    resolvedProductImage = resolved.url;
  }

  const body = await preprocessBodyImage(args.userImageUrl!);
  if (!body.valid) {
    return {
      visualState: makeFallbackState(args.selectedSize, body.reason || "invalid_body"),
      resolvedProductImage,
    };
  }

  const garment = await preprocessGarment(workingProductImage, args.productCategory);
  const garmentType: GarmentType =
    garment.type !== "unknown" ? garment.type : garmentTypeFromCategory(args.productCategory);

  const { data, error } = await supabase.functions.invoke("fit-tryon-router", {
    body: {
      userImageUrl: body.croppedImageUrl,
      productImageUrl: workingProductImage,
      productKey: args.productKey,
      productCategory:
        garmentType === "lower"
          ? `${args.productCategory || ""} pants`.trim()
          : garmentType === "full"
          ? `${args.productCategory || ""} dress`.trim()
          : args.productCategory,
      selectedSize: args.selectedSize,
      fitDescriptor: args.fitDescriptor,
      regions: args.regions || [],
      mode: "high",
    },
  });

  if (error) {
    return {
      visualState: makeErrorState(args.selectedSize, error.message || "router_failed"),
      resolvedProductImage,
    };
  }

  if (data?.ok && data?.imageUrl) {
    const source = normalizeTryOnSource(data.provider, "replicate");
    return {
      visualState: makeSuccessState(args.selectedSize, data.imageUrl, source),
      resolvedProductImage,
    };
  }

  if (data?.ok === false) {
    return {
      visualState: makeFallbackState(args.selectedSize, data.code || data.error || "generation_failed"),
      resolvedProductImage,
    };
  }

  return {
    visualState: makeErrorState(args.selectedSize, "invalid_router_contract"),
    resolvedProductImage,
  };
}

export function useReplicateTryOn(args: Args) {
  const { enabled, userImageUrl, productKey, selectedSize } = args;
  const [visualState, setVisualState] = useState<FitVisualState>(makeIdleState());
  const [resolvedProductImage, setResolvedProductImage] = useState<string | null>(null);
  const requestKeyRef = useRef<string>("");

  useEffect(() => {
    let active = true;
    let timedOut = false;

    const transition = (next: FitVisualState, meta?: Record<string, unknown>) => {
      if (!active) return;
      setVisualState(next);
      logTryOnClient("STATE_TRANSITION", {
        productKey,
        selectedSize,
        startedAt: next.kind === "loading" ? next.startedAt : undefined,
        provider: next.kind === "success" ? next.source : null,
        status: next.kind,
        ...meta,
      });
    };

    if (!enabled || !userImageUrl || !productKey || !selectedSize) {
      transition(makeIdleState(), { reason: "disabled" });
      setResolvedProductImage(null);
      return () => {
        active = false;
      };
    }

    const cacheKey = `${productKey}::${selectedSize}`;
    requestKeyRef.current = cacheKey;

    // Force-reload: clear all cache layers for this key when reloadToken bumps
    if (args.reloadToken && args.reloadToken > 0) {
      clearStoredTryOn(productKey, selectedSize);
      memoryCache.delete(cacheKey);
      activePhotoRequests.delete(cacheKey);
    }

    const local = readStoredTryOnSuccess(productKey, selectedSize);
    if (local?.kind === "success") {
      transition(local, { reason: "stored_success" });
      return () => {
        active = false;
      };
    }

    const cached = memoryCache.get(cacheKey);
    if (cached?.url) {
      transition(
        makeSuccessState(selectedSize, cached.url, normalizeTryOnSource(cached.provider, "replicate")),
        { reason: "memory_success" }
      );
      return () => {
        active = false;
      };
    }

    const loadingState = makeLoadingState(selectedSize);
    transition(loadingState, { reason: "TRYON_START" });
    logTryOnClient("TRYON_START", {
      productKey,
      selectedSize,
      startedAt: loadingState.startedAt,
      status: "loading",
    });

    const guardTimer = window.setTimeout(() => {
      if (!active || timedOut || requestKeyRef.current !== cacheKey) return;
      timedOut = true;
      logTryOnClient("CLIENT_TIMEOUT", {
        productKey,
        selectedSize,
        startedAt: loadingState.startedAt,
        status: "timeout",
      });
      transition(makeFallbackState(selectedSize, "timeout"), { reason: "timeout" });
    }, TRYON_CLIENT_TIMEOUT_MS);

    const existing = activePhotoRequests.get(cacheKey);
    const promise = existing && Date.now() - existing.startedAt < TRYON_ACTIVE_REQUEST_MS
      ? existing.promise
      : (() => {
          const nextPromise = runPhotoTryOnRequest(args);
          activePhotoRequests.set(cacheKey, { startedAt: Date.now(), promise: nextPromise });
          nextPromise.finally(() => {
            const current = activePhotoRequests.get(cacheKey);
            if (current?.promise === nextPromise) activePhotoRequests.delete(cacheKey);
          });
          return nextPromise;
        })();

    promise
      .then((result) => {
        if (!active || requestKeyRef.current !== cacheKey) return;
        setResolvedProductImage(result.resolvedProductImage);

        if (result.visualState.kind === "success") {
          const provider: TryOnProvider = result.visualState.source === "perplexity" ? "perplexity" : "replicate";
          memoryCache.set(cacheKey, { url: result.visualState.imageUrl, provider });
          storeTryOnSuccess(productKey, selectedSize, result.visualState.imageUrl, provider);
          logTryOnClient("ROUTER_SUCCESS", {
            productKey,
            selectedSize,
            startedAt: loadingState.startedAt,
            provider,
            status: "success",
          });
        } else {
          logTryOnClient("ROUTER_FAIL", {
            productKey,
            selectedSize,
            startedAt: loadingState.startedAt,
            status: result.visualState.kind,
            reason:
              result.visualState.kind === "fallback"
                ? result.visualState.reason
                : result.visualState.kind === "error"
                ? result.visualState.message
                : "unknown",
          });
        }

        if (timedOut) return;
        window.clearTimeout(guardTimer);
        transition(result.visualState);
      })
      .catch((err) => {
        if (!active || timedOut || requestKeyRef.current !== cacheKey) return;
        window.clearTimeout(guardTimer);
        const message = err instanceof Error ? err.message : "unknown_error";
        logTryOnClient("ROUTER_FAIL", {
          productKey,
          selectedSize,
          startedAt: loadingState.startedAt,
          status: "error",
          reason: message,
        });
        transition(makeErrorState(selectedSize, message));
      });

    return () => {
      active = false;
      window.clearTimeout(guardTimer);
    };
  }, [
    args.fitDescriptor,
    args.productCategory,
    args.productImageUrl,
    args.productImagesFallback,
    args.productUrl,
    args.regions,
    args.reloadToken,
    enabled,
    userImageUrl,
    productKey,
    selectedSize,
  ]);

  const imageUrl = visualState.kind === "success" ? visualState.imageUrl : null;
  const provider =
    visualState.kind === "success"
      ? (visualState.source === "perplexity" ? "perplexity" : "replicate")
      : null;
  const error =
    visualState.kind === "error"
      ? visualState.message
      : visualState.kind === "fallback"
      ? visualState.reason
      : null;

  return {
    status: toStatus(visualState),
    visualState,
    imageUrl,
    provider,
    error,
    resolvedProductImage,
  };
}
