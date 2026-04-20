import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useReplicateTryOn, type TryOnStatus, type TryOnProvider } from "@/hooks/useReplicateTryOn";
import { type TryOnUserBody } from "@/lib/fit/buildTryOnPrompt";
import { buildBodyProfile } from "@/lib/fit/buildBodyProfile";
import { buildGarmentFitMap } from "@/lib/fit/buildGarmentFitMap";
import { buildProductVisualDescriptor } from "@/lib/fit/buildProductVisualDescriptor";
import { buildFitGenerationPrompt } from "@/lib/fit/buildFitGenerationPrompt";
import { solveFit } from "@/lib/fit/fitSolver";
import { buildBodyFrame } from "@/lib/fit/buildBodyFrame";
import { buildGarmentOverlayMap } from "@/lib/fit/buildGarmentOverlayMap";
import { runCompositeFitTryOn } from "@/lib/fit/compositeFitImages";
import {
  type FitVisualState,
  TRYON_ACTIVE_REQUEST_MS,
  TRYON_CLIENT_TIMEOUT_MS,
  isActiveTryOnAge,
  logTryOnClient,
  makeErrorState,
  makeFallbackState,
  makeIdleState,
  makeLoadingState,
  makeSuccessState,
  readStoredTryOnSuccess,
  readTryOnCacheRecord,
  storeTryOnSuccess,
  clearStoredTryOn,
} from "@/lib/fit/tryOnState";

interface Args {
  enabled: boolean;
  userImageUrl: string | null;
  productImageUrl: string;
  productKey: string;
  productCategory?: string;
  productName: string;
  productFitType?: string | null;
  selectedSize: string;
  body: TryOnUserBody;
  fitDescriptor?: string;
  regions?: { region: string; fit: string }[];
  productUrl?: string | null;
  productImagesFallback?: (string | null | undefined)[];
  prewarmSize?: string | null;
  reloadToken?: number;
}

interface State {
  visualState: FitVisualState;
  provider: TryOnProvider | "replicate-text";
  error: string | null;
  cacheHit: boolean;
  prompt: string | null;
  mode: "photo" | "text";
}

interface TextRunResult {
  visualState: FitVisualState;
  cacheHit: boolean;
}

const TEXT_CACHE = new Map<string, { url: string; cacheHit: boolean }>();
const activeTextRequests = new Map<string, { startedAt: number; promise: Promise<TextRunResult> }>();

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

async function runTextTryOn(args: Args, prompt: string): Promise<TextRunResult> {
  const cacheKey = `${args.productKey}::${args.selectedSize}::text`;
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
    return { visualState: stored, cacheHit: true };
  }

  const memory = TEXT_CACHE.get(cacheKey);
  if (memory?.url) {
    logTryOnClient("CACHE_HIT", {
      productKey: args.productKey,
      selectedSize: args.selectedSize,
      startedAt,
      provider: "replicate-text",
      status: "memory_success",
      cacheLayer: "memory",
    });
    return {
      visualState: makeSuccessState(args.selectedSize, memory.url, "replicate-text"),
      cacheHit: true,
    };
  }

  const cacheRecord = await readTryOnCacheRecord({
    productKey: args.productKey,
    selectedSize: args.selectedSize,
    successFallbackSource: "replicate-text",
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
      cacheHit: true,
    };
  }

  logTryOnClient("CACHE_MISS", {
    productKey: args.productKey,
    selectedSize: args.selectedSize,
    startedAt,
    status: cacheRecord.kind === "pending" ? cacheRecord.status : cacheRecord.kind,
    reason:
      cacheRecord.kind === "pending"
        ? isActiveTryOnAge(cacheRecord.ageMs)
          ? "active_pending_found"
          : "retry_after_pending"
        : cacheRecord.kind,
  });

  // ── PRIMARY PATH: two-image coordinate composite ───────────────────────
  try {
    const bodyProfile = buildBodyProfile({
      heightCm: args.body.heightCm ?? null,
      weightKg: args.body.weightKg ?? null,
      shoulderCm: args.body.shoulderWidthCm ?? null,
      chestCm: args.body.chestCm ?? null,
      waistCm: args.body.waistCm ?? null,
    });
    const fitMap = buildGarmentFitMap({
      category: args.productCategory ?? null,
      selectedSize: args.selectedSize,
      fitType: args.productFitType ?? null,
      body: bodyProfile,
    });
    const solver = solveFit({ body: bodyProfile, fit: fitMap, category: fitMap.category, selectedSize: args.selectedSize });
    const frame = buildBodyFrame(bodyProfile);
    const overlay = buildGarmentOverlayMap({ frame, fit: fitMap, solver, selectedSize: args.selectedSize });

    const composite = await runCompositeFitTryOn({
      productKey: args.productKey,
      selectedSize: args.selectedSize,
      productImageUrl: args.productImageUrl,
      productName: args.productName,
      productCategory: args.productCategory,
      gender: args.body.gender ?? null,
      bodyFrame: frame,
      overlay,
    });
    if (composite.ok) {
      logTryOnClient("COMPOSITE_SUCCESS", { productKey: args.productKey, selectedSize: args.selectedSize, startedAt, provider: "fit-composite", status: "success", cacheHit: composite.cacheHit });
      return { visualState: makeSuccessState(args.selectedSize, composite.compositeUrl, "replicate-text"), cacheHit: composite.cacheHit };
    }
    logTryOnClient("COMPOSITE_FALLBACK", { productKey: args.productKey, selectedSize: args.selectedSize, startedAt, provider: "fit-composite", status: "fallback", reason: composite.error });
  } catch (err) {
    logTryOnClient("COMPOSITE_ERROR", { productKey: args.productKey, selectedSize: args.selectedSize, startedAt, provider: "fit-composite", status: "error", reason: err instanceof Error ? err.message : "unknown" });
  }

  // ── FALLBACK PATH: existing single-pass text generation ─────────────────
  const { data, error } = await supabase.functions.invoke("fit-tryon-text", {
    body: {
      prompt,
      productKey: args.productKey,
      selectedSize: args.selectedSize,
      productImageUrl: args.productImageUrl,
    },
  });

  if (error) {
    return {
      visualState: makeErrorState(args.selectedSize, error.message || "generation_failed"),
      cacheHit: false,
    };
  }

  if (data?.resultImageUrl) {
    return {
      visualState: makeSuccessState(args.selectedSize, data.resultImageUrl, "replicate-text"),
      cacheHit: !!data.cacheHit,
    };
  }

  const errStr = String(data?.error || "").toLowerCase();
  const fallbackReason =
    data?.status === "rate_limited" ||
    data?.fallback === true ||
    errStr.includes("rate") ||
    errStr.includes("429") ||
    errStr.includes("payment")
      ? "timeout"
      : data?.error || "generation_failed";

  return {
    visualState: makeFallbackState(args.selectedSize, fallbackReason),
    cacheHit: false,
  };
}

export function useAiTryOn(args: Args) {
  const hasPhoto = !!args.userImageUrl;
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
    reloadToken: args.reloadToken,
  });

  const [textState, setTextState] = useState<State>({
    visualState: makeIdleState(),
    provider: null,
    error: null,
    cacheHit: false,
    prompt: null,
    mode: "text",
  });

  useEffect(() => {
    let active = true;
    let timedOut = false;

    const transition = (next: State, meta?: Record<string, unknown>) => {
      if (!active) return;
      setTextState(next);
      logTryOnClient("STATE_TRANSITION", {
        productKey: args.productKey,
        selectedSize: args.selectedSize,
        startedAt: next.visualState.kind === "loading" ? next.visualState.startedAt : undefined,
        provider: next.visualState.kind === "success" ? next.visualState.source : next.provider,
        status: next.visualState.kind,
        ...meta,
      });
    };

    if (!args.enabled || hasPhoto) {
      transition({
        visualState: makeIdleState(),
        provider: null,
        error: null,
        cacheHit: false,
        prompt: null,
        mode: "text",
      }, { reason: hasPhoto ? "photo_path_active" : "disabled" });
      return () => {
        active = false;
      };
    }

    if (!args.productKey || !args.selectedSize) {
      return () => {
        active = false;
      };
    }

    // Force-reload: clear text caches for this key when reloadToken bumps
    if (args.reloadToken && args.reloadToken > 0) {
      const cacheKey = `${args.productKey}::${args.selectedSize}::text`;
      clearStoredTryOn(args.productKey, args.selectedSize);
      TEXT_CACHE.delete(cacheKey);
      activeTextRequests.delete(cacheKey);
    }

    const bodyProfile = buildBodyProfile({
      heightCm: args.body.heightCm ?? null,
      weightKg: args.body.weightKg ?? null,
      shoulderCm: args.body.shoulderWidthCm ?? null,
      chestCm: args.body.chestCm ?? null,
      waistCm: args.body.waistCm ?? null,
    });
    const fitMap = buildGarmentFitMap({
      category: args.productCategory ?? null,
      selectedSize: args.selectedSize,
      fitType: args.productFitType ?? null,
      body: bodyProfile,
    });
    const visual = buildProductVisualDescriptor({
      title: args.productName,
      category: args.productCategory ?? null,
      brand: undefined,
      fitType: args.productFitType ?? null,
    });
    const solver = solveFit({
      body: bodyProfile,
      fit: fitMap,
      category: fitMap.category,
      selectedSize: args.selectedSize,
    });
    const prompt = buildFitGenerationPrompt({
      body: bodyProfile,
      fit: fitMap,
      product: visual,
      selectedSize: args.selectedSize,
      hasBodyImage: false,
      gender: args.body.gender ?? null,
      solverHints: solver.visualPromptHints,
    });

    const cacheKey = `${args.productKey}::${args.selectedSize}::text`;
    const stored = readStoredTryOnSuccess(args.productKey, args.selectedSize);
    if (stored?.kind === "success") {
      transition({
        visualState: stored,
        provider: "replicate-text",
        error: null,
        cacheHit: true,
        prompt,
        mode: "text",
      }, { reason: "stored_success" });
      return () => {
        active = false;
      };
    }

    const memory = TEXT_CACHE.get(cacheKey);
    if (memory?.url) {
      transition({
        visualState: makeSuccessState(args.selectedSize, memory.url, "replicate-text"),
        provider: "replicate-text",
        error: null,
        cacheHit: true,
        prompt,
        mode: "text",
      }, { reason: "memory_success" });
      return () => {
        active = false;
      };
    }

    const loadingState = makeLoadingState(args.selectedSize);
    transition({
      visualState: loadingState,
      provider: "replicate-text",
      error: null,
      cacheHit: false,
      prompt,
      mode: "text",
    }, { reason: "TRYON_START" });
    logTryOnClient("TRYON_START", {
      productKey: args.productKey,
      selectedSize: args.selectedSize,
      startedAt: loadingState.startedAt,
      provider: "replicate-text",
      status: "loading",
    });

    const guardTimer = window.setTimeout(() => {
      if (!active || timedOut) return;
      timedOut = true;
      logTryOnClient("CLIENT_TIMEOUT", {
        productKey: args.productKey,
        selectedSize: args.selectedSize,
        startedAt: loadingState.startedAt,
        provider: "replicate-text",
        status: "timeout",
      });
      transition({
        visualState: makeFallbackState(args.selectedSize, "timeout"),
        provider: "replicate-text",
        error: "timeout",
        cacheHit: false,
        prompt,
        mode: "text",
      });
    }, TRYON_CLIENT_TIMEOUT_MS);

    const existing = activeTextRequests.get(cacheKey);
    const promise = existing && Date.now() - existing.startedAt < TRYON_ACTIVE_REQUEST_MS
      ? existing.promise
      : (() => {
          const nextPromise = runTextTryOn(args, prompt);
          activeTextRequests.set(cacheKey, { startedAt: Date.now(), promise: nextPromise });
          nextPromise.finally(() => {
            const current = activeTextRequests.get(cacheKey);
            if (current?.promise === nextPromise) activeTextRequests.delete(cacheKey);
          });
          return nextPromise;
        })();

    promise
      .then((result) => {
        if (!active) return;
        if (result.visualState.kind === "success") {
          TEXT_CACHE.set(cacheKey, { url: result.visualState.imageUrl, cacheHit: result.cacheHit });
          storeTryOnSuccess(args.productKey, args.selectedSize, result.visualState.imageUrl, "replicate-text");
          logTryOnClient("ROUTER_SUCCESS", {
            productKey: args.productKey,
            selectedSize: args.selectedSize,
            startedAt: loadingState.startedAt,
            provider: "replicate-text",
            status: "success",
            cacheHit: result.cacheHit,
          });
        } else {
          logTryOnClient("ROUTER_FAIL", {
            productKey: args.productKey,
            selectedSize: args.selectedSize,
            startedAt: loadingState.startedAt,
            provider: "replicate-text",
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
        transition({
          visualState: result.visualState,
          provider: "replicate-text",
          error:
            result.visualState.kind === "error"
              ? result.visualState.message
              : result.visualState.kind === "fallback"
              ? result.visualState.reason
              : null,
          cacheHit: result.cacheHit,
          prompt,
          mode: "text",
        });
      })
      .catch((err) => {
        if (!active || timedOut) return;
        window.clearTimeout(guardTimer);
        const message = err instanceof Error ? err.message : "unknown_error";
        logTryOnClient("ROUTER_FAIL", {
          productKey: args.productKey,
          selectedSize: args.selectedSize,
          startedAt: loadingState.startedAt,
          provider: "replicate-text",
          status: "error",
          reason: message,
        });
        transition({
          visualState: makeErrorState(args.selectedSize, message),
          provider: "replicate-text",
          error: message,
          cacheHit: false,
          prompt,
          mode: "text",
        });
      });

    return () => {
      active = false;
      window.clearTimeout(guardTimer);
    };
  }, [
    args.body.chestCm,
    args.body.gender,
    args.body.heightCm,
    args.body.shoulderWidthCm,
    args.body.waistCm,
    args.body.weightKg,
    args.enabled,
    args.productCategory,
    args.productFitType,
    args.productImageUrl,
    args.productKey,
    args.productName,
    args.reloadToken,
    args.selectedSize,
    hasPhoto,
  ]);

  useEffect(() => {
    if (!args.enabled || hasPhoto) return;
    const warm = args.prewarmSize;
    if (!warm || warm === args.selectedSize || !args.productKey) return;
    const warmKey = `${args.productKey}::${warm}::text`;
    if (TEXT_CACHE.has(warmKey) || readStoredTryOnSuccess(args.productKey, warm)) return;

    const warmBodyProfile = buildBodyProfile({
      heightCm: args.body.heightCm ?? null,
      weightKg: args.body.weightKg ?? null,
      shoulderCm: args.body.shoulderWidthCm ?? null,
      chestCm: args.body.chestCm ?? null,
      waistCm: args.body.waistCm ?? null,
    });
    const warmFitMap = buildGarmentFitMap({
      category: args.productCategory ?? null,
      selectedSize: warm,
      fitType: args.productFitType ?? null,
      body: warmBodyProfile,
    });
    const warmVisual = buildProductVisualDescriptor({
      title: args.productName,
      category: args.productCategory ?? null,
      fitType: args.productFitType ?? null,
    });
    const warmSolver = solveFit({
      body: warmBodyProfile,
      fit: warmFitMap,
      category: warmFitMap.category,
      selectedSize: warm,
    });
    const prompt = buildFitGenerationPrompt({
      body: warmBodyProfile,
      fit: warmFitMap,
      product: warmVisual,
      selectedSize: warm,
      hasBodyImage: false,
      gender: args.body.gender ?? null,
      solverHints: warmSolver.visualPromptHints,
    });

    const run = () => {
      runTextTryOn({ ...args, selectedSize: warm }, prompt)
        .then((result) => {
          if (result.visualState.kind !== "success") return;
          TEXT_CACHE.set(warmKey, { url: result.visualState.imageUrl, cacheHit: result.cacheHit });
          storeTryOnSuccess(args.productKey, warm, result.visualState.imageUrl, "replicate-text");
        })
        .catch(() => undefined);
    };

    const ric = (globalThis as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => void }).requestIdleCallback;
    if (typeof ric === "function") ric(run, { timeout: 2000 });
    else window.setTimeout(run, 600);
  }, [
    args,
    args.body.chestCm,
    args.body.gender,
    args.body.heightCm,
    args.body.shoulderWidthCm,
    args.body.waistCm,
    args.body.weightKg,
    args.enabled,
    args.prewarmSize,
    args.productCategory,
    args.productFitType,
    args.productKey,
    args.productName,
    args.selectedSize,
    hasPhoto,
  ]);

  if (hasPhoto) {
    return {
      status: photo.status,
      visualState: photo.visualState,
      imageUrl: photo.imageUrl,
      provider: photo.provider,
      error: photo.error,
      cacheHit: false,
      prompt: null,
      mode: "photo" as const,
    };
  }

  return {
    status: toStatus(textState.visualState),
    visualState: textState.visualState,
    imageUrl: textState.visualState.kind === "success" ? textState.visualState.imageUrl : null,
    provider: textState.visualState.kind === "success" ? ("replicate-text" as const) : textState.provider,
    error: textState.error,
    cacheHit: textState.cacheHit,
    prompt: textState.prompt,
    mode: "text" as const,
  };
}

export type { TryOnStatus };
