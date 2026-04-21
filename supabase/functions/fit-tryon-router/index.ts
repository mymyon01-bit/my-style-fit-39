import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const SERVER_TIMEOUT_MS = 15_000;
const STALE_PENDING_MS = 10 * 60_000;
const DEFAULT_RETRY_AFTER_MS = 8_000;
const PROCESSING_STATUSES = new Set(["queued", "pending", "starting", "processing", "generating", "throttled"]);

type ProviderName = "replicate";
type FailureCode = "timeout" | "generation_failed" | "provider_error" | "missing_output";
type PendingCode = "pending" | "rate_limited";

interface RegionFitLite {
  region: string;
  fit: string;
}

interface CreateBody {
  action?: "create" | "status";
  requestId?: string;
  predictionId?: string;
  userImageUrl?: string;
  productImageUrl: string;
  productKey: string;
  productCategory?: string;
  selectedSize: string;
  fitDescriptor?: string;
  regions?: RegionFitLite[];
  bodyProfileSummary?: Record<string, unknown>;
  forceRegenerate?: boolean;
  mode?: "quick" | "high";
}

interface SuccessResponse {
  ok: true;
  imageUrl: string;
  provider: ProviderName;
  selectedSize: string;
  status: "succeeded";
  predictionId?: string | null;
  requestId?: string | null;
}

interface FailureResponse {
  ok: false;
  code: FailureCode;
  error: string;
  provider?: ProviderName | null;
  selectedSize?: string;
  status?: "failed";
  predictionId?: string | null;
  requestId?: string | null;
}

interface PendingResponse {
  ok: false;
  code: PendingCode;
  error: string | null;
  provider: ProviderName;
  selectedSize?: string;
  status: "queued" | "starting" | "processing" | "generating" | "throttled";
  predictionId?: string | null;
  requestId?: string | null;
  retryAfterMs?: number | null;
}

type TryOnResponse = SuccessResponse | FailureResponse | PendingResponse;

type TryOnRow = {
  id: string;
  status: string;
  provider: string | null;
  prediction_id: string | null;
  result_image_url: string | null;
  updated_at: string | null;
  error_message: string | null;
  user_image_url: string | null;
  product_image_url: string | null;
  product_key: string;
  selected_size: string;
  metadata: Record<string, unknown> | null;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function logRouter(event: string, details: Record<string, unknown>) {
  console.log("[FIT][ROUTER]", { event, ...details });
}

function parseOutput(output: unknown): string | null {
  if (!output) return null;
  if (typeof output === "string") return output;
  if (Array.isArray(output) && output.length > 0) {
    const first = output[0];
    if (typeof first === "string") return first;
    if (first && typeof first === "object" && "url" in (first as Record<string, unknown>)) {
      return String((first as Record<string, unknown>).url ?? "") || null;
    }
  }
  if (typeof output === "object" && output !== null && "url" in (output as Record<string, unknown>)) {
    return String((output as Record<string, unknown>).url ?? "") || null;
  }
  return null;
}

function failure(
  code: FailureCode,
  error: string,
  selectedSize?: string,
  provider: ProviderName | null = "replicate",
  requestId?: string | null,
  predictionId?: string | null,
): FailureResponse {
  return { ok: false, code, error, selectedSize, provider, status: "failed", requestId, predictionId };
}

function pending(
  code: PendingCode,
  params: {
    error?: string | null;
    selectedSize?: string;
    status: PendingResponse["status"];
    requestId?: string | null;
    predictionId?: string | null;
    retryAfterMs?: number | null;
  },
): PendingResponse {
  return {
    ok: false,
    code,
    error: params.error ?? null,
    provider: "replicate",
    selectedSize: params.selectedSize,
    status: params.status,
    requestId: params.requestId ?? null,
    predictionId: params.predictionId ?? null,
    retryAfterMs: params.retryAfterMs ?? null,
  };
}

function sizeFitBehavior(size: string) {
  const s = (size || "M").toUpperCase();
  if (s === "XS" || s === "S") {
    return {
      ease: "tight body-hugging fit, almost no ease, cuffs and hem sit high",
      silhouette: "slim and structured, sleeves taut against the arms, shoulder seam pulled exactly to the joint, hem clearly above the hip",
      drape: "fabric stretches flat across chest and shoulders, no folds, no bunching, garment skims every body line",
    };
  }
  if (s === "L") {
    return {
      ease: "relaxed and roomy with generous ease (~8cm), longer body, wider sleeves",
      silhouette: "loose through chest and waist, shoulder seam slightly past the joint, sleeves clearly long, hem drops below the hip",
      drape: "soft visible folds at the waist and under the arms, fabric falls away from the torso, hem swings naturally",
    };
  }
  if (s === "XL" || s === "XXL") {
    return {
      ease: "clearly oversized with very generous ease (12cm or more), dropped shoulders, very long body and sleeves",
      silhouette: "boxy and dramatically oversized, shoulder seam visibly dropped onto the upper arm, sleeves falling near the wrist or past, hem near mid-thigh",
      drape: "deep cascading folds across the chest and back, billowing hem, fabric hangs noticeably away from the body in every direction",
    };
  }
  return {
    ease: "true-to-size with natural ease (~5cm)",
    silhouette: "follows the body with comfortable room, shoulder seam at the joint, sleeves end at the wrist, hem at the hip",
    drape: "natural soft folds, balanced volume, fabric neither tight nor loose",
  };
}

function buildFitDescription(
  category: string | undefined,
  size: string,
  fitDescriptor: string | undefined,
  regions: RegionFitLite[] | undefined,
) {
  const cat = (category || "garment").toLowerCase();
  const fit = fitDescriptor || "true-to-size";
  const behavior = sizeFitBehavior(size);
  const regionPhrases = (regions || [])
    .filter((r) => r?.region && r?.fit)
    .slice(0, 5)
    .map((r) => `${r.region.toLowerCase()} ${r.fit.replace(/-/g, " ")}`)
    .join(", ");
  const base = `${cat} in size ${size} (${fit} fit, ${behavior.ease}); ${behavior.silhouette}; ${behavior.drape}`;
  return regionPhrases ? `${base} — region notes: ${regionPhrases}` : base;
}

function extractRetryAfterMs(message: string | null | undefined) {
  if (!message) return DEFAULT_RETRY_AFTER_MS;
  const secondsMatch = message.match(/resets in\s*~?(\d+)s/i);
  if (secondsMatch) {
    return Math.max(Number(secondsMatch[1]) * 1000, 1_500);
  }
  const minuteMatch = message.match(/resets in\s*~?(\d+)m/i);
  if (minuteMatch) {
    return Math.max(Number(minuteMatch[1]) * 60_000, DEFAULT_RETRY_AFTER_MS);
  }
  return DEFAULT_RETRY_AFTER_MS;
}

function getRetryUntil(metadata: Record<string, unknown> | null) {
  const value = metadata?.retryAfterUntil;
  return typeof value === "number" ? value : null;
}

function isStale(row: Pick<TryOnRow, "updated_at">) {
  if (!row.updated_at) return false;
  return Date.now() - new Date(row.updated_at).getTime() > STALE_PENDING_MS;
}

function buildCreateBodyFromRow(row: TryOnRow): CreateBody {
  const metadata = row.metadata || {};
  return {
    userImageUrl: row.user_image_url ?? undefined,
    productImageUrl: row.product_image_url ?? "",
    productKey: row.product_key,
    productCategory: typeof metadata.productCategory === "string" ? metadata.productCategory : undefined,
    selectedSize: row.selected_size,
    fitDescriptor: typeof metadata.fitDescriptor === "string" ? metadata.fitDescriptor : undefined,
    regions: Array.isArray(metadata.regions) ? (metadata.regions as RegionFitLite[]) : [],
    mode: "high",
  };
}

async function getTryOnByIdentity(admin: ReturnType<typeof createClient>, userId: string, body: CreateBody) {
  const { data } = await admin
    .from("fit_tryons")
    .select("id, status, provider, prediction_id, result_image_url, updated_at, error_message, user_image_url, product_image_url, product_key, selected_size, metadata")
    .eq("user_id", userId)
    .eq("product_key", body.productKey)
    .eq("selected_size", body.selectedSize)
    .maybeSingle();
  return (data as TryOnRow | null) ?? null;
}

async function getTryOnByRequest(admin: ReturnType<typeof createClient>, userId: string | null, requestId?: string | null, predictionId?: string | null) {
  if (requestId) {
    let query = admin
      .from("fit_tryons")
      .select("id, status, provider, prediction_id, result_image_url, updated_at, error_message, user_image_url, product_image_url, product_key, selected_size, metadata")
      .eq("id", requestId);
    if (userId) query = query.eq("user_id", userId);
    const { data } = await query.maybeSingle();
    if (data) return data as TryOnRow;
  }
  if (predictionId) {
    let query = admin
      .from("fit_tryons")
      .select("id, status, provider, prediction_id, result_image_url, updated_at, error_message, user_image_url, product_image_url, product_key, selected_size, metadata")
      .eq("prediction_id", predictionId);
    if (userId) query = query.eq("user_id", userId);
    const { data } = await query.maybeSingle();
    return (data as TryOnRow | null) ?? null;
  }
  return null;
}

async function upsertTryOnRecord(
  admin: ReturnType<typeof createClient>,
  userId: string,
  body: CreateBody,
  values: Record<string, unknown>,
) {
  const { data, error } = await admin
    .from("fit_tryons")
    .upsert(
      {
        user_id: userId,
        product_key: body.productKey,
        selected_size: body.selectedSize,
        provider: "replicate",
        user_image_url: body.userImageUrl ?? null,
        product_image_url: body.productImageUrl,
        metadata: {
          fitDescriptor: body.fitDescriptor,
          regions: body.regions || [],
          productCategory: body.productCategory ?? null,
          ...((values.metadata as Record<string, unknown> | undefined) ?? {}),
        },
        ...values,
      },
      { onConflict: "user_id,product_key,selected_size" },
    )
    .select("id, status, provider, prediction_id, result_image_url, updated_at, error_message, user_image_url, product_image_url, product_key, selected_size, metadata")
    .single();

  if (error) {
    logRouter("DB_UPSERT_FAILED", { error: error.message, productKey: body.productKey, selectedSize: body.selectedSize });
    return null;
  }

  return data as TryOnRow;
}

async function updateTryOnRecord(
  admin: ReturnType<typeof createClient>,
  requestId: string,
  values: Record<string, unknown>,
) {
  const { data } = await admin
    .from("fit_tryons")
    .update(values)
    .eq("id", requestId)
    .select("id, status, provider, prediction_id, result_image_url, updated_at, error_message, user_image_url, product_image_url, product_key, selected_size, metadata")
    .single();
  return (data as TryOnRow | null) ?? null;
}

type ReplicateCreateResult =
  | { kind: "success"; imageUrl: string }
  | { kind: "pending"; predictionId: string; status: PendingResponse["status"] }
  | { kind: "throttled"; error: string; retryAfterMs: number }
  | { kind: "error"; code: FailureCode; error: string };

async function createReplicatePrediction(token: string, body: CreateBody): Promise<ReplicateCreateResult> {
  const model = Deno.env.get("REPLICATE_TRYON_MODEL") || "cuuupid/idm-vton:0513734a452173b8173e907e3a59d19a36266e55b48528559432bd21c7d7e985";
  const category = (() => {
    const c = (body.productCategory || "").toLowerCase();
    if (c.includes("pant") || c.includes("jean") || c.includes("trouser") || c.includes("skirt") || c.includes("short")) return "lower_body";
    if (c.includes("dress") || c.includes("jumpsuit") || c.includes("overall")) return "dresses";
    return "upper_body";
  })();
  const garment_des = buildFitDescription(body.productCategory, body.selectedSize, body.fitDescriptor, body.regions);
  const sizeSeed: Record<string, number> = { XS: 11, S: 23, M: 42, L: 71, XL: 97, XXL: 113 };
  const seed = sizeSeed[(body.selectedSize || "M").toUpperCase()] ?? 42;
  const url = model.includes(":") ? "https://api.replicate.com/v1/predictions" : `https://api.replicate.com/v1/models/${model}/predictions`;
  const payload = model.includes(":")
    ? {
        version: model.split(":")[1],
        input: { human_img: body.userImageUrl, garm_img: body.productImageUrl, garment_des, category, crop: false, force_dc: false, mask_only: false, seed, steps: 40 },
      }
    : {
        input: { human_img: body.userImageUrl, garm_img: body.productImageUrl, garment_des, category, crop: false, force_dc: false, mask_only: false, seed, steps: 40 },
      };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SERVER_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Prefer: "wait=8",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    const detail = String(data?.detail || data?.error || data?.message || "").trim();

    if (response.status === 429) {
      return {
        kind: "throttled",
        error: detail || "replicate_throttled",
        retryAfterMs: extractRetryAfterMs(detail),
      };
    }

    if (!response.ok) {
      return {
        kind: "error",
        code: "provider_error",
        error: detail || `replicate http ${response.status}`,
      };
    }

    const imageUrl = parseOutput(data?.output);
    if (imageUrl) {
      return { kind: "success", imageUrl };
    }

    if (data?.id && ["starting", "processing"].includes(String(data?.status))) {
      return { kind: "pending", predictionId: String(data.id), status: String(data.status) as PendingResponse["status"] };
    }

    return {
      kind: "error",
      code: data?.status === "processing" || data?.status === "starting" ? "timeout" : "missing_output",
      error: data?.status === "processing" || data?.status === "starting" ? "generation_timeout" : "missing_output",
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return { kind: "pending", predictionId: "", status: "processing" };
    }
    return {
      kind: "error",
      code: "provider_error",
      error: error instanceof Error ? error.message : "replicate_failed",
    };
  } finally {
    clearTimeout(timer);
  }
}

type ReplicatePollResult =
  | { kind: "success"; imageUrl: string }
  | { kind: "pending"; status: PendingResponse["status"] }
  | { kind: "failed"; error: string }
  | { kind: "throttled"; error: string; retryAfterMs: number }
  | { kind: "error"; error: string };

async function pollReplicatePrediction(token: string, predictionId: string): Promise<ReplicatePollResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SERVER_TIMEOUT_MS);

  try {
    const response = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    const detail = String(data?.detail || data?.error || data?.message || "").trim();

    if (response.status === 429) {
      return { kind: "throttled", error: detail || "replicate_throttled", retryAfterMs: extractRetryAfterMs(detail) };
    }
    if (!response.ok) {
      return { kind: "error", error: detail || `replicate http ${response.status}` };
    }

    const imageUrl = parseOutput(data?.output);
    if (imageUrl) return { kind: "success", imageUrl };

    const status = String(data?.status || "processing");
    if (["starting", "processing"].includes(status)) {
      return { kind: "pending", status: status as PendingResponse["status"] };
    }
    if (["failed", "canceled"].includes(status)) {
      return { kind: "failed", error: detail || status };
    }
    return { kind: "error", error: detail || "missing_output" };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return { kind: "pending", status: "processing" };
    }
    return { kind: "error", error: error instanceof Error ? error.message : "replicate_poll_failed" };
  } finally {
    clearTimeout(timer);
  }
}

function toSuccess(row: TryOnRow, imageUrl: string): SuccessResponse {
  return {
    ok: true,
    imageUrl,
    provider: "replicate",
    selectedSize: row.selected_size,
    status: "succeeded",
    predictionId: row.prediction_id,
    requestId: row.id,
  };
}

async function createOrResumePrediction(
  admin: ReturnType<typeof createClient>,
  token: string,
  row: TryOnRow | null,
  userId: string | null,
  body: CreateBody,
  forceRegenerate = false,
): Promise<TryOnResponse> {
  const existing = row;

  if (existing && !forceRegenerate) {
    if (existing.status === "succeeded" && existing.result_image_url) {
      return toSuccess(existing, existing.result_image_url);
    }
    if (PROCESSING_STATUSES.has(existing.status) && !isStale(existing)) {
      return pending(existing.status === "throttled" ? "rate_limited" : "pending", {
        error: existing.status === "throttled" ? existing.error_message : null,
        selectedSize: existing.selected_size,
        status: (existing.status === "queued" || existing.status === "throttled" || existing.status === "starting" ? existing.status : "processing") as PendingResponse["status"],
        requestId: existing.id,
        predictionId: existing.prediction_id,
        retryAfterMs: Math.max((getRetryUntil(existing.metadata) ?? Date.now()) - Date.now(), 0) || null,
      });
    }
  }

  const record = userId
    ? await upsertTryOnRecord(admin, userId, body, {
        status: "queued",
        prediction_id: null,
        result_image_url: null,
        error_message: null,
        model_id: Deno.env.get("REPLICATE_TRYON_MODEL") || "cuuupid/idm-vton",
        metadata: { retryAfterUntil: null },
      })
    : null;

  const result = await createReplicatePrediction(token, body);

  if (result.kind === "success") {
    if (record) {
      await updateTryOnRecord(admin, record.id, {
        status: "succeeded",
        prediction_id: null,
        result_image_url: result.imageUrl,
        error_message: null,
        metadata: { ...(record.metadata || {}), retryAfterUntil: null },
      });
      return {
        ok: true,
        imageUrl: result.imageUrl,
        provider: "replicate",
        selectedSize: body.selectedSize,
        status: "succeeded",
        requestId: record.id,
      };
    }
    return {
      ok: true,
      imageUrl: result.imageUrl,
      provider: "replicate",
      selectedSize: body.selectedSize,
      status: "succeeded",
    };
  }

  if (result.kind === "pending") {
    if (record) {
      await updateTryOnRecord(admin, record.id, {
        status: result.status,
        prediction_id: result.predictionId || null,
        error_message: null,
        metadata: { ...(record.metadata || {}), retryAfterUntil: null },
      });
      return pending("pending", {
        error: null,
        selectedSize: body.selectedSize,
        status: result.status,
        requestId: record.id,
        predictionId: result.predictionId || null,
      });
    }

    return pending("pending", {
      error: null,
      selectedSize: body.selectedSize,
      status: result.status,
      predictionId: result.predictionId || null,
    });
  }

  if (result.kind === "throttled") {
    const retryAfterUntil = Date.now() + result.retryAfterMs;
    if (record) {
      await updateTryOnRecord(admin, record.id, {
        status: "throttled",
        prediction_id: null,
        error_message: result.error,
        metadata: { ...(record.metadata || {}), retryAfterUntil },
      });
      return pending("rate_limited", {
        error: result.error,
        selectedSize: body.selectedSize,
        status: "throttled",
        requestId: record.id,
        retryAfterMs: result.retryAfterMs,
      });
    }

    return pending("rate_limited", {
      error: result.error,
      selectedSize: body.selectedSize,
      status: "throttled",
      retryAfterMs: result.retryAfterMs,
    });
  }

  if (record) {
    await updateTryOnRecord(admin, record.id, {
      status: "failed",
      prediction_id: null,
      error_message: result.error,
      metadata: { ...(record.metadata || {}), retryAfterUntil: null },
    });
    return failure(result.code, result.error, body.selectedSize, "replicate", record.id, null);
  }

  return failure(result.code, result.error, body.selectedSize, "replicate");
}

async function handleStatus(
  admin: ReturnType<typeof createClient>,
  token: string,
  userId: string | null,
  body: Partial<CreateBody>,
): Promise<TryOnResponse> {
  const row = await getTryOnByRequest(admin, userId, body.requestId, body.predictionId);

  if (row?.status === "succeeded" && row.result_image_url) {
    return toSuccess(row, row.result_image_url);
  }

  if (row?.status === "failed") {
    return failure("generation_failed", row.error_message || "generation_failed", row.selected_size, "replicate", row.id, row.prediction_id);
  }

  if (row?.status === "throttled") {
    const retryAfterUntil = getRetryUntil(row.metadata);
    if (retryAfterUntil && retryAfterUntil > Date.now()) {
      return pending("rate_limited", {
        error: row.error_message,
        selectedSize: row.selected_size,
        status: "throttled",
        requestId: row.id,
        predictionId: row.prediction_id,
        retryAfterMs: retryAfterUntil - Date.now(),
      });
    }
    const recreate = await createOrResumePrediction(admin, token, row, userId, buildCreateBodyFromRow(row), true);
    return recreate;
  }

  if (row?.prediction_id) {
    const poll = await pollReplicatePrediction(token, row.prediction_id);
    if (poll.kind === "success") {
      await updateTryOnRecord(admin, row.id, {
        status: "succeeded",
        result_image_url: poll.imageUrl,
        error_message: null,
        metadata: { ...(row.metadata || {}), retryAfterUntil: null },
      });
      return {
        ok: true,
        imageUrl: poll.imageUrl,
        provider: "replicate",
        selectedSize: row.selected_size,
        status: "succeeded",
        predictionId: row.prediction_id,
        requestId: row.id,
      };
    }
    if (poll.kind === "pending") {
      await updateTryOnRecord(admin, row.id, { status: poll.status, error_message: null });
      return pending("pending", {
        error: null,
        selectedSize: row.selected_size,
        status: poll.status,
        requestId: row.id,
        predictionId: row.prediction_id,
      });
    }
    if (poll.kind === "throttled") {
      const retryAfterUntil = Date.now() + poll.retryAfterMs;
      await updateTryOnRecord(admin, row.id, {
        status: "throttled",
        error_message: poll.error,
        metadata: { ...(row.metadata || {}), retryAfterUntil },
      });
      return pending("rate_limited", {
        error: poll.error,
        selectedSize: row.selected_size,
        status: "throttled",
        requestId: row.id,
        predictionId: row.prediction_id,
        retryAfterMs: poll.retryAfterMs,
      });
    }
    if (poll.kind === "failed") {
      await updateTryOnRecord(admin, row.id, {
        status: "failed",
        error_message: poll.error,
        metadata: { ...(row.metadata || {}), retryAfterUntil: null },
      });
      return failure("generation_failed", poll.error, row.selected_size, "replicate", row.id, row.prediction_id);
    }
    await updateTryOnRecord(admin, row.id, {
      status: "failed",
      error_message: poll.error,
      metadata: { ...(row.metadata || {}), retryAfterUntil: null },
    });
    return failure("provider_error", poll.error, row.selected_size, "replicate", row.id, row.prediction_id);
  }

  if (row && PROCESSING_STATUSES.has(row.status)) {
    if (isStale(row)) {
      const recreate = await createOrResumePrediction(admin, token, row, userId, buildCreateBodyFromRow(row), true);
      return recreate;
    }
    return pending("pending", {
      error: null,
      selectedSize: row.selected_size,
      status: row.status === "queued" ? "queued" : "processing",
      requestId: row.id,
      predictionId: null,
    });
  }

  if (!row && body.predictionId) {
    const poll = await pollReplicatePrediction(token, body.predictionId);
    if (poll.kind === "success") {
      return {
        ok: true,
        imageUrl: poll.imageUrl,
        provider: "replicate",
        selectedSize: body.selectedSize || "M",
        status: "succeeded",
        predictionId: body.predictionId,
      };
    }
    if (poll.kind === "pending") {
      return pending("pending", {
        error: null,
        selectedSize: body.selectedSize,
        status: poll.status,
        predictionId: body.predictionId,
      });
    }
    if (poll.kind === "throttled") {
      return pending("rate_limited", {
        error: poll.error,
        selectedSize: body.selectedSize,
        status: "throttled",
        predictionId: body.predictionId,
        retryAfterMs: poll.retryAfterMs,
      });
    }
    if (poll.kind === "failed") {
      return failure("generation_failed", poll.error, body.selectedSize, "replicate", null, body.predictionId);
    }
    return failure("provider_error", poll.error, body.selectedSize, "replicate", null, body.predictionId);
  }

  return failure("provider_error", "try_on_request_not_found", body.selectedSize, "replicate", body.requestId ?? null, body.predictionId ?? null);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const REPLICATE_API_TOKEN = Deno.env.get("REPLICATE_API_TOKEN");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("Authorization") || "";
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: userData } = await userClient.auth.getUser();
  const userId = userData?.user?.id || null;
  const requestStartedAt = Date.now();

  try {
    const url = new URL(req.url);
    const body = req.method === "POST" ? ((await req.json()) as Partial<CreateBody>) : {};
    const action = req.method === "GET" || body.action === "status" ? "status" : "create";

    if (!REPLICATE_API_TOKEN) {
      return json(failure("provider_error", "REPLICATE_API_TOKEN missing", body.selectedSize, "replicate"), 500);
    }

    if (action === "status") {
      const response = await handleStatus(admin, REPLICATE_API_TOKEN, userId, {
        requestId: body.requestId || url.searchParams.get("requestId") || url.searchParams.get("id") || undefined,
        predictionId: body.predictionId || url.searchParams.get("predictionId") || undefined,
        selectedSize: body.selectedSize || url.searchParams.get("selectedSize") || undefined,
      });
      logRouter("STATUS_OUT", {
        status: response.status,
        code: response.ok ? "ok" : response.code,
        requestId: response.requestId,
        predictionId: response.predictionId,
        elapsedMs: Date.now() - requestStartedAt,
      });
      const statusCode = response.ok ? 200 : response.code === "rate_limited" ? 429 : response.code === "pending" ? 202 : response.code === "missing_output" ? 422 : response.code === "provider_error" ? 502 : response.code === "timeout" ? 504 : 500;
      return json(response, statusCode);
    }

    const createBody = body as CreateBody;
    logRouter("REQUEST_IN", { productKey: createBody?.productKey, selectedSize: createBody?.selectedSize, userId });

    if (!createBody?.productImageUrl || !createBody?.selectedSize || !createBody?.productKey) {
      return json(failure("provider_error", "productImageUrl, productKey, selectedSize required", createBody?.selectedSize), 400);
    }

    const img = String(createBody.productImageUrl || "").trim();
    const usable = !!img && img !== "null" && img !== "undefined" && /^(https?:\/\/|data:image\/)/i.test(img);
    if (!usable) {
      return json(failure("missing_output", "missing_image", createBody.selectedSize), 422);
    }

    if (!createBody.userImageUrl) {
      return json(failure("provider_error", "userImageUrl required for try-on", createBody.selectedSize), 400);
    }

    const existing = userId ? await getTryOnByIdentity(admin, userId, createBody) : null;
    const response = await createOrResumePrediction(admin, REPLICATE_API_TOKEN, existing, userId, createBody, !!createBody.forceRegenerate);

    logRouter("RESPONSE_OUT", {
      status: response.status,
      code: response.ok ? "ok" : response.code,
      requestId: response.requestId,
      predictionId: response.predictionId,
      elapsedMs: Date.now() - requestStartedAt,
    });

    const statusCode = response.ok ? 200 : response.code === "rate_limited" ? 429 : response.code === "pending" ? 202 : response.code === "missing_output" ? 422 : response.code === "provider_error" ? 502 : response.code === "timeout" ? 504 : 500;
    return json(response, statusCode);
  } catch (error) {
    const out = failure("provider_error", error instanceof Error ? error.message : "Unknown error", undefined, null);
    logRouter("CRASH", { error: out.error, elapsedMs: Date.now() - requestStartedAt });
    return json(out, 500);
  }
});
