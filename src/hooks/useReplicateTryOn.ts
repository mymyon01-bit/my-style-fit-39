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
  mode?: "quick" | "high";
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

async function invokeTryOn(body: CreateTryOnBody): Promise<TryOnInvokeResult> {
  const { data, error, response } = await supabase.functions.invoke("fit-tryon-router", { body });
  if (!error) {
    return {
      data: (data as TryOnResponse | null) ?? null,
      error: null,
      status: response?.status ?? 200,
    };
  }
  return parseHttpError(error);
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
