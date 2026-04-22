import { useCallback } from "react";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type ProviderName = "replicate";

type TryOnCode =
  | "pending"
  | "rate_limited"
  | "timeout"
  | "generation_failed"
  | "provider_error"
  | "missing_output";

export interface TryOnSuccessResponse {
  ok: true;
  imageUrl: string;
  provider: ProviderName;
  selectedSize: string;
  status: "succeeded";
  predictionId?: string | null;
  requestId?: string | null;
  code?: undefined;
  error?: undefined;
  retryAfterMs?: undefined;
}

export interface TryOnAsyncResponse {
  ok: false;
  code: "pending" | "rate_limited";
  error: string | null;
  provider: ProviderName;
  selectedSize?: string;
  status: "queued" | "starting" | "processing" | "generating" | "throttled";
  predictionId?: string | null;
  requestId?: string | null;
  retryAfterMs?: number | null;
}

export interface TryOnFailureResponse {
  ok: false;
  code: Exclude<TryOnCode, "pending" | "rate_limited">;
  error: string;
  provider?: ProviderName | null;
  selectedSize?: string;
  status?: "failed";
  predictionId?: string | null;
  requestId?: string | null;
  retryAfterMs?: number | null;
}

export type TryOnResponse = TryOnSuccessResponse | TryOnAsyncResponse | TryOnFailureResponse;

export interface CreateTryOnBody {
  action?: "create" | "status";
  requestId?: string;
  predictionId?: string;
  userImageUrl?: string;
  productImageUrl?: string;
  productKey?: string;
  productName?: string;
  productCategory?: string;
  selectedSize?: string;
  fitDescriptor?: string;
  regions?: Array<{ region: string; fit: string }>;
  bodyProfileSummary?: {
    heightCm?: number | null;
    weightKg?: number | null;
    build?: string | null;
    gender?: string | null;
  };
  bodyImageHash?: string | null;
  garmentImageHash?: string | null;
  forceRegenerate?: boolean;
  /**
   * "studio" (default) = clean text-to-image render (no user photo as canvas).
   * "vton" = legacy IDM-VTON composite onto user photo.
   */
  mode?: "studio" | "vton";
}

export interface TryOnInvokeResult {
  data: TryOnResponse | null;
  error: Error | null;
  status: number | null;
}

async function parseHttpError(error: unknown): Promise<TryOnInvokeResult> {
  if (error instanceof FunctionsHttpError && error.context instanceof Response) {
    const response = error.context;
    const status = response.status;
    try {
      const cloned = response.clone();
      const data = (await cloned.json()) as TryOnResponse;
      return { data, error: null, status };
    } catch {
      const text = await response.text().catch(() => "");
      return {
        data: null,
        error: new Error(text || error.message || "Function request failed"),
        status,
      };
    }
  }

  return {
    data: null,
    error: error instanceof Error ? error : new Error("Function request failed"),
    status: null,
  };
}

// Some browser/window contexts (popups, secondary windows, restored tabs)
// can leave supabase.functions.invoke hanging on the streamed response even
// after the edge function returned 200. We fall back to a direct fetch with
// an explicit AbortController timeout so the UI never gets stuck.
const INVOKE_TIMEOUT_MS = 75_000;

async function invokeTryOnDirect(body: CreateTryOnBody): Promise<TryOnInvokeResult> {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fit-tryon-router`;
  const anon = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
  const { data: sess } = await supabase.auth.getSession();
  const token = sess?.session?.access_token ?? anon;
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), INVOKE_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anon,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const status = res.status;
    let parsed: TryOnResponse | null = null;
    try {
      parsed = (await res.json()) as TryOnResponse;
    } catch {
      parsed = null;
    }
    if (res.ok || (parsed && typeof parsed === "object")) {
      return { data: parsed, error: parsed ? null : new Error(`HTTP ${status}`), status };
    }
    return { data: null, error: new Error(`HTTP ${status}`), status };
  } catch (e: any) {
    if (e?.name === "AbortError") {
      return { data: null, error: new Error("Try-on request timed out"), status: null };
    }
    return { data: null, error: e instanceof Error ? e : new Error("Network error"), status: null };
  } finally {
    window.clearTimeout(timer);
  }
}

async function invokeTryOn(body: CreateTryOnBody): Promise<TryOnInvokeResult> {
  // Race the SDK invoke against the direct fetch — whichever resolves first wins.
  // This protects against the SDK hanging on response stream in secondary windows
  // while still benefiting from its built-in error parsing when it works.
  const sdkPromise: Promise<TryOnInvokeResult> = supabase.functions
    .invoke("fit-tryon-router", { body })
    .then(({ data, error, response }) => {
      if (!error) {
        return {
          data: (data as TryOnResponse | null) ?? null,
          error: null,
          status: response?.status ?? 200,
        } satisfies TryOnInvokeResult;
      }
      return parseHttpError(error);
    })
    .catch((e) => ({
      data: null,
      error: e instanceof Error ? e : new Error("Function request failed"),
      status: null,
    }));
  return Promise.race([sdkPromise, invokeTryOnDirect(body)]);
}

export function useReplicateTryOn() {
  const createTryOn = useCallback((body: CreateTryOnBody) => invokeTryOn({ action: "create", ...body }), []);
  const pollTryOnStatus = useCallback(
    (params: { requestId?: string | null; predictionId?: string | null; selectedSize?: string }) =>
      invokeTryOn({
        action: "status",
        requestId: params.requestId ?? undefined,
        predictionId: params.predictionId ?? undefined,
        selectedSize: params.selectedSize,
      }),
    [],
  );

  return { createTryOn, pollTryOnStatus };
}
