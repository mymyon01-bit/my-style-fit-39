import { supabase } from "@/integrations/supabase/client";

export const TRYON_CLIENT_TIMEOUT_MS = 12_000;
export const TRYON_ACTIVE_REQUEST_MS = 30_000;
export const TRYON_STALE_PENDING_MS = 120_000;

export type TryOnVisualSource = "replicate" | "perplexity" | "replicate-text";

export type FitVisualState =
  | { kind: "idle" }
  | { kind: "loading"; selectedSize: string; startedAt: number }
  | { kind: "success"; selectedSize: string; imageUrl: string; source: TryOnVisualSource }
  | { kind: "fallback"; selectedSize: string; reason: string }
  | { kind: "error"; selectedSize: string; message: string };

export type TryOnCacheLookup =
  | { kind: "miss" }
  | { kind: "success"; imageUrl: string; provider: TryOnVisualSource; ageMs: number }
  | { kind: "pending"; ageMs: number; provider: string | null; status: string }
  | { kind: "stale"; ageMs: number; provider: string | null; status: string }
  | { kind: "failed"; ageMs: number; provider: string | null; status: string; error: string | null };

interface StoredTryOnSnapshot {
  imageUrl: string;
  provider: TryOnVisualSource;
  savedAt: number;
}

const PENDING_STATUSES = new Set(["pending", "starting", "processing", "generating"]);

const snapshotKey = (productKey: string, selectedSize: string) =>
  `fit-tryon-cache::${productKey}::${selectedSize}`;

const storageAvailable = () => {
  if (typeof window === "undefined") return false;
  try {
    return !!window.localStorage;
  } catch {
    return false;
  }
};

export const normalizeTryOnSource = (
  provider: string | null | undefined,
  fallback: TryOnVisualSource
): TryOnVisualSource => {
  if (provider === "perplexity") return "perplexity";
  if (provider === "replicate-text") return "replicate-text";
  if (provider === "replicate") return "replicate";
  return fallback;
};

export type IdleState = Extract<FitVisualState, { kind: "idle" }>;
export type LoadingState = Extract<FitVisualState, { kind: "loading" }>;
export type SuccessState = Extract<FitVisualState, { kind: "success" }>;
export type FallbackState = Extract<FitVisualState, { kind: "fallback" }>;
export type ErrorState = Extract<FitVisualState, { kind: "error" }>;

export const makeIdleState = (): IdleState => ({ kind: "idle" });

export const makeLoadingState = (selectedSize: string): LoadingState => ({
  kind: "loading",
  selectedSize,
  startedAt: Date.now(),
});

export const makeSuccessState = (
  selectedSize: string,
  imageUrl: string,
  source: TryOnVisualSource
): SuccessState => ({ kind: "success", selectedSize, imageUrl, source });

export const makeFallbackState = (
  selectedSize: string,
  reason: string
): FallbackState => ({ kind: "fallback", selectedSize, reason });

export const makeErrorState = (
  selectedSize: string,
  message: string
): ErrorState => ({ kind: "error", selectedSize, message });

export const logTryOnClient = (
  event: string,
  details: {
    productKey: string;
    selectedSize: string;
    startedAt?: number;
    provider?: string | null;
    status?: string | null;
    [key: string]: unknown;
  }
) => {
  const { productKey, selectedSize, startedAt, provider = null, status = null, ...rest } = details;
  console.log("[TRYON_CLIENT]", {
    event,
    productKey,
    selectedSize,
    elapsedMs: typeof startedAt === "number" ? Date.now() - startedAt : 0,
    provider,
    status,
    ...rest,
  });
};

export const isPendingTryOnStatus = (status: string | null | undefined) =>
  !!status && PENDING_STATUSES.has(status);

export const isActiveTryOnAge = (ageMs: number) => ageMs <= TRYON_ACTIVE_REQUEST_MS;

export function readStoredTryOnSuccess(
  productKey: string,
  selectedSize: string
): FitVisualState | null {
  if (!storageAvailable()) return null;
  try {
    const raw = window.localStorage.getItem(snapshotKey(productKey, selectedSize));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredTryOnSnapshot;
    if (!parsed?.imageUrl || !parsed?.provider) return null;
    return makeSuccessState(selectedSize, parsed.imageUrl, parsed.provider);
  } catch {
    return null;
  }
}

export function storeTryOnSuccess(
  productKey: string,
  selectedSize: string,
  imageUrl: string,
  provider: TryOnVisualSource
) {
  if (!storageAvailable()) return;
  try {
    const payload: StoredTryOnSnapshot = { imageUrl, provider, savedAt: Date.now() };
    window.localStorage.setItem(snapshotKey(productKey, selectedSize), JSON.stringify(payload));
  } catch {
    // ignore storage failures
  }
}

export async function readTryOnCacheRecord(args: {
  productKey: string;
  selectedSize: string;
  successFallbackSource: TryOnVisualSource;
}): Promise<TryOnCacheLookup> {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user?.id;
  if (!userId) return { kind: "miss" };

  const { data, error } = await supabase
    .from("fit_tryons")
    .select("id, status, provider, result_image_url, updated_at, error_message")
    .eq("user_id", userId)
    .eq("product_key", args.productKey)
    .eq("selected_size", args.selectedSize)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return { kind: "miss" };

  const updatedAt = data.updated_at ? new Date(data.updated_at).getTime() : Date.now();
  const ageMs = Math.max(0, Date.now() - updatedAt);
  const provider = normalizeTryOnSource(data.provider, args.successFallbackSource);

  if (data.status === "succeeded" && data.result_image_url) {
    storeTryOnSuccess(args.productKey, args.selectedSize, data.result_image_url, provider);
    return { kind: "success", imageUrl: data.result_image_url, provider, ageMs };
  }

  if (isPendingTryOnStatus(data.status)) {
    if (ageMs > TRYON_STALE_PENDING_MS) {
      await supabase
        .from("fit_tryons")
        .update({ status: "failed", error_message: "stale_pending_timeout" })
        .eq("id", data.id);
      return { kind: "stale", ageMs, provider: data.provider, status: data.status };
    }
    return { kind: "pending", ageMs, provider: data.provider, status: data.status };
  }

  return {
    kind: "failed",
    ageMs,
    provider: data.provider,
    status: data.status || "failed",
    error: data.error_message || null,
  };
}
