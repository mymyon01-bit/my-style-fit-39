// ─── FIT TRY-ON ROUTER (CLEAN STUDIO GENERATION via Lovable AI) ─────────────
// IMPORTANT: This router NO LONGER overlays the garment onto the user's
// uploaded photo. The previous IDM-VTON pipeline was preserving the user's
// original background (mirrors, bathrooms, rooms, hands, props), producing
// crude composite-looking results. That is now removed.
//
// New flow:
//   - Body image is NOT used as a canvas. Only body measurements + region fit
//     descriptors are fed into the prompt.
//   - Product image is sent as a visual reference only (so style/color/print
//     are preserved).
//   - Lovable AI Gateway (google/gemini-3-pro-image-preview a.k.a. Nano-Banana
//     Pro) generates a brand-new clean studio fashion image — neutral
//     background, premium ecommerce/editorial look, no environmental artifacts.
//
// Persistence + caching contract (fit_tryons table) is preserved so the inline
// useCanvasTryOn hook + TryOnPreviewModal continue to work without changes.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const SERVER_TIMEOUT_MS = 55_000; // image gen needs more headroom than vton
// Replicate IDM-VTON: real virtual try-on (garment composited onto user body).
// Used while Lovable AI image credits are being topped up.
const MODEL_ID = Deno.env.get("REPLICATE_FIT_MODEL") || "cuuupid/idm-vton";
const MODEL_VERSION = Deno.env.get("REPLICATE_FIT_MODEL_VERSION") || "c871bb9b046607b680449ecbae55fd8c6d945e0a1948644bf2361b3d021d3ff4";
const REPLICATE_POLL_INTERVAL_MS = 1500;

type ProviderName = "lovable-ai" | "replicate";
type FailureCode = "timeout" | "generation_failed" | "provider_error" | "missing_output" | "credits_exhausted";
type PendingCode = "pending" | "rate_limited";

interface RegionFitLite { region: string; fit: string; }

interface CreateBody {
  action?: "create" | "status";
  requestId?: string;
  predictionId?: string;
  userImageUrl?: string;       // accepted but only used as identity hint
  productImageUrl: string;
  productKey: string;
  productName?: string;
  productCategory?: string;
  selectedSize: string;
  fitDescriptor?: string;
  regions?: RegionFitLite[];
  bodyProfileSummary?: {
    heightCm?: number | null;
    weightKg?: number | null;
    build?: string | null;
    gender?: string | null;
  };
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
  status: "queued" | "processing" | "throttled";
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

function failure(code: FailureCode, error: string, selectedSize?: string, requestId?: string | null): FailureResponse {
  return { ok: false, code, error, selectedSize, provider: "lovable-ai", status: "failed", requestId, predictionId: null };
}

function pending(code: PendingCode, params: { error?: string | null; selectedSize?: string; status: PendingResponse["status"]; requestId?: string | null; retryAfterMs?: number | null; }): PendingResponse {
  return {
    ok: false, code,
    error: params.error ?? null,
    provider: "lovable-ai",
    selectedSize: params.selectedSize,
    status: params.status,
    requestId: params.requestId ?? null,
    predictionId: null,
    retryAfterMs: params.retryAfterMs ?? null,
  };
}

// ─── PROMPT BUILDING ────────────────────────────────────────────────────────
function describeBuild(b?: CreateBody["bodyProfileSummary"]) {
  if (!b?.heightCm || !b?.weightKg) return "average build";
  const bmi = b.weightKg / Math.pow(b.heightCm / 100, 2);
  if (bmi < 19) return "slim build";
  if (bmi < 24) return "regular athletic build";
  if (bmi < 28) return "athletic build";
  return "broader build";
}

function describeSubject(b?: CreateBody["bodyProfileSummary"]) {
  const g = (b?.gender || "").toLowerCase();
  if (g === "female" || g === "feminine" || g === "woman") return "female model";
  if (g === "male" || g === "masculine" || g === "man") return "male model";
  return "model";
}

function sizeSilhouette(size: string) {
  const s = (size || "M").toUpperCase();
  if (s === "XS" || s === "S") return "trim body-skimming silhouette, sleeves close to the arm, hem sits high on the hip, minimal fabric ease";
  if (s === "L") return "relaxed silhouette with visible chest room, softer waist, slightly longer hem, soft drape";
  if (s === "XL" || s === "XXL") return "oversized silhouette with dropped shoulders, generous chest and waist volume, hem near mid-thigh, deep folds";
  return "regular fitted silhouette with natural ease, shoulder seam at the joint, hem at the hip";
}

function regionPhrase(regions?: RegionFitLite[]) {
  if (!regions?.length) return "";
  const parts = regions
    .filter((r) => r?.region && r?.fit)
    .slice(0, 6)
    .map((r) => `${r.region.toLowerCase()} ${r.fit.replace(/-/g, " ")}`);
  return parts.length ? `Region-by-region fit: ${parts.join("; ")}.` : "";
}

function buildCleanStudioPrompt(body: CreateBody): string {
  const subject = describeSubject(body.bodyProfileSummary);
  const build = describeBuild(body.bodyProfileSummary);
  const heightLine = body.bodyProfileSummary?.heightCm ? `, approximately ${body.bodyProfileSummary.heightCm} cm tall` : "";
  const garmentLabel = body.productName?.trim() || body.productCategory || "the garment";
  const silhouette = sizeSilhouette(body.selectedSize);
  const regions = regionPhrase(body.regions);

  return [
    `A premium realistic fashion photograph of a ${build} ${subject}${heightLine}, wearing ${garmentLabel} in size ${body.selectedSize}.`,
    `Preserve the EXACT style, color, print, and construction of the garment shown in the reference image.`,
    `Render the garment with a ${silhouette}.`,
    regions,
    `Full-body or 3/4 body front-facing standing fashion pose. Realistic fabric drape, natural folds, accurate proportions.`,
    `Background: clean seamless light-gray studio backdrop with soft directional fashion lighting and a subtle floor shadow for grounding. Editorial / premium ecommerce quality.`,
    `Strictly NO bathroom, NO mirror, NO room interior, NO sink, NO household objects, NO handheld props, NO bag, NO phone, NO selfie framing, NO original photo background, NO copy-paste overlay artifacts, NO mannequin, NO floating clothes, NO duplicate limbs, NO text, NO watermark, NO logos other than those on the garment.`,
    `Output must look like a brand-new generated studio fashion image — never like an edit of an existing snapshot.`,
  ].filter(Boolean).join(" ");
}

// ─── LOVABLE AI GATEWAY CALL ────────────────────────────────────────────────
type GenResult =
  | { kind: "success"; imageUrl: string }
  | { kind: "throttled"; error: string; retryAfterMs: number }
  | { kind: "credits_exhausted"; error: string }
  | { kind: "error"; code: FailureCode; error: string };

async function generateCleanFitImage(apiKey: string, body: CreateBody): Promise<GenResult> {
  const prompt = buildCleanStudioPrompt(body);
  logRouter("AI_PROMPT", { productKey: body.productKey, size: body.selectedSize, model: MODEL_ID, promptPreview: prompt.slice(0, 220) });

  const content: Array<Record<string, unknown>> = [{ type: "text", text: prompt }];
  // Pass product image as visual style reference. Body image is intentionally
  // OMITTED — we do not want the model anchoring to the user's environment.
  if (body.productImageUrl) {
    content.push({ type: "image_url", image_url: { url: body.productImageUrl } });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SERVER_TIMEOUT_MS);

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL_ID,
        messages: [{ role: "user", content }],
        modalities: ["image", "text"],
      }),
    });

    if (response.status === 429) {
      const txt = await response.text().catch(() => "");
      return { kind: "throttled", error: txt.slice(0, 220) || "rate_limited", retryAfterMs: 8_000 };
    }
    if (response.status === 402) {
      const txt = await response.text().catch(() => "");
      return { kind: "credits_exhausted", error: txt.slice(0, 220) || "AI credits exhausted" };
    }
    if (!response.ok) {
      const txt = await response.text().catch(() => "");
      return { kind: "error", code: "provider_error", error: `gateway ${response.status}: ${txt.slice(0, 200)}` };
    }

    const data = await response.json().catch(() => ({}));
    const url = data?.choices?.[0]?.message?.images?.[0]?.image_url?.url ?? null;
    if (!url || typeof url !== "string") {
      return { kind: "error", code: "missing_output", error: "no_image_in_response" };
    }
    return { kind: "success", imageUrl: url };
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      return { kind: "error", code: "timeout", error: "ai_gateway_timeout" };
    }
    return { kind: "error", code: "provider_error", error: e instanceof Error ? e.message : "ai_gateway_failed" };
  } finally {
    clearTimeout(timer);
  }
}

// ─── DB HELPERS ─────────────────────────────────────────────────────────────
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

async function getTryOnByRequest(admin: ReturnType<typeof createClient>, userId: string | null, requestId?: string | null) {
  if (!requestId) return null;
  let query = admin
    .from("fit_tryons")
    .select("id, status, provider, prediction_id, result_image_url, updated_at, error_message, user_image_url, product_image_url, product_key, selected_size, metadata")
    .eq("id", requestId);
  if (userId) query = query.eq("user_id", userId);
  const { data } = await query.maybeSingle();
  return (data as TryOnRow | null) ?? null;
}

async function upsertTryOnRecord(admin: ReturnType<typeof createClient>, userId: string, body: CreateBody, values: Record<string, unknown>) {
  const { data, error } = await admin
    .from("fit_tryons")
    .upsert({
      user_id: userId,
      product_key: body.productKey,
      selected_size: body.selectedSize,
      provider: "lovable-ai",
      user_image_url: body.userImageUrl ?? null,
      product_image_url: body.productImageUrl,
      metadata: {
        fitDescriptor: body.fitDescriptor,
        regions: body.regions || [],
        productCategory: body.productCategory ?? null,
        productName: body.productName ?? null,
        bodyProfileSummary: body.bodyProfileSummary ?? null,
        ...((values.metadata as Record<string, unknown> | undefined) ?? {}),
      },
      ...values,
    }, { onConflict: "user_id,product_key,selected_size" })
    .select("id, status, provider, prediction_id, result_image_url, updated_at, error_message, user_image_url, product_image_url, product_key, selected_size, metadata")
    .single();

  if (error) {
    logRouter("DB_UPSERT_FAILED", { error: error.message, productKey: body.productKey, selectedSize: body.selectedSize });
    return null;
  }
  return data as TryOnRow;
}

async function updateTryOnRecord(admin: ReturnType<typeof createClient>, requestId: string, values: Record<string, unknown>) {
  const { data } = await admin
    .from("fit_tryons")
    .update(values)
    .eq("id", requestId)
    .select("id, status, provider, prediction_id, result_image_url, updated_at, error_message, user_image_url, product_image_url, product_key, selected_size, metadata")
    .single();
  return (data as TryOnRow | null) ?? null;
}

function toSuccess(row: TryOnRow, imageUrl: string): SuccessResponse {
  return {
    ok: true, imageUrl, provider: "lovable-ai",
    selectedSize: row.selected_size, status: "succeeded",
    predictionId: null, requestId: row.id,
  };
}

// ─── MAIN ENTRYPOINTS ───────────────────────────────────────────────────────
async function handleCreate(admin: ReturnType<typeof createClient>, apiKey: string, userId: string | null, body: CreateBody): Promise<TryOnResponse> {
  const existing = userId ? await getTryOnByIdentity(admin, userId, body) : null;

  if (existing && !body.forceRegenerate && existing.status === "succeeded" && existing.result_image_url) {
    logRouter("CACHE_HIT", { id: existing.id });
    return toSuccess(existing, existing.result_image_url);
  }

  const record = userId
    ? await upsertTryOnRecord(admin, userId, body, {
        status: "processing",
        prediction_id: null,
        result_image_url: null,
        error_message: null,
        model_id: MODEL_ID,
        metadata: { generator: "lovable-ai-clean-studio", retryAfterUntil: null },
      })
    : null;

  const result = await generateCleanFitImage(apiKey, body);

  if (result.kind === "success") {
    if (record) {
      await updateTryOnRecord(admin, record.id, {
        status: "succeeded",
        result_image_url: result.imageUrl,
        error_message: null,
        metadata: { ...(record.metadata || {}), retryAfterUntil: null },
      });
      return toSuccess(record, result.imageUrl);
    }
    return { ok: true, imageUrl: result.imageUrl, provider: "lovable-ai", selectedSize: body.selectedSize, status: "succeeded", requestId: null, predictionId: null };
  }

  if (result.kind === "throttled") {
    if (record) {
      await updateTryOnRecord(admin, record.id, {
        status: "throttled",
        error_message: result.error,
        metadata: { ...(record.metadata || {}), retryAfterUntil: Date.now() + result.retryAfterMs },
      });
    }
    return pending("rate_limited", { error: result.error, selectedSize: body.selectedSize, status: "throttled", requestId: record?.id ?? null, retryAfterMs: result.retryAfterMs });
  }

  if (result.kind === "credits_exhausted") {
    if (record) await updateTryOnRecord(admin, record.id, { status: "failed", error_message: result.error });
    return failure("credits_exhausted", result.error, body.selectedSize, record?.id ?? null);
  }

  if (record) await updateTryOnRecord(admin, record.id, { status: "failed", error_message: result.error });
  return failure(result.code, result.error, body.selectedSize, record?.id ?? null);
}

async function handleStatus(admin: ReturnType<typeof createClient>, userId: string | null, body: Partial<CreateBody>): Promise<TryOnResponse> {
  const row = await getTryOnByRequest(admin, userId, body.requestId);
  if (!row) return failure("provider_error", "try_on_request_not_found", body.selectedSize, body.requestId ?? null);

  if (row.status === "succeeded" && row.result_image_url) return toSuccess(row, row.result_image_url);
  if (row.status === "failed") return failure("generation_failed", row.error_message || "generation_failed", row.selected_size, row.id);

  if (row.status === "throttled") {
    const meta = (row.metadata || {}) as Record<string, unknown>;
    const until = typeof meta.retryAfterUntil === "number" ? meta.retryAfterUntil : null;
    return pending("rate_limited", {
      error: row.error_message,
      selectedSize: row.selected_size,
      status: "throttled",
      requestId: row.id,
      retryAfterMs: until ? Math.max(until - Date.now(), 0) : 8_000,
    });
  }

  return pending("pending", { selectedSize: row.selected_size, status: "processing", requestId: row.id });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
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
    if (!LOVABLE_API_KEY) {
      return json(failure("provider_error", "LOVABLE_API_KEY missing"), 500);
    }

    const url = new URL(req.url);
    const body = req.method === "POST" ? ((await req.json()) as Partial<CreateBody>) : {};
    const action = req.method === "GET" || body.action === "status" ? "status" : "create";

    if (action === "status") {
      const response = await handleStatus(admin, userId, {
        requestId: body.requestId || url.searchParams.get("requestId") || url.searchParams.get("id") || undefined,
        selectedSize: body.selectedSize || url.searchParams.get("selectedSize") || undefined,
      });
      logRouter("STATUS_OUT", { code: response.ok ? "ok" : response.code, requestId: response.requestId, elapsedMs: Date.now() - requestStartedAt });
    // NOTE: credits_exhausted returns 200 so client SDK can read the body
    // (supabase.functions.invoke discards bodies on non-2xx).
    const statusCode = response.ok ? 200 : response.code === "rate_limited" ? 429 : response.code === "pending" ? 202 : response.code === "credits_exhausted" ? 200 : 500;
      return json(response, statusCode);
    }

    const createBody = body as CreateBody;
    logRouter("REQUEST_IN", { productKey: createBody?.productKey, selectedSize: createBody?.selectedSize, userId });

    if (!createBody?.productImageUrl || !createBody?.selectedSize || !createBody?.productKey) {
      return json(failure("provider_error", "productImageUrl, productKey, selectedSize required", createBody?.selectedSize), 400);
    }

    const img = String(createBody.productImageUrl || "").trim();
    if (!/^(https?:\/\/|data:image\/)/i.test(img)) {
      return json(failure("missing_output", "missing_image", createBody.selectedSize), 422);
    }

    const response = await handleCreate(admin, LOVABLE_API_KEY, userId, createBody);
    logRouter("RESPONSE_OUT", { code: response.ok ? "ok" : response.code, requestId: response.requestId, elapsedMs: Date.now() - requestStartedAt });

    const statusCode = response.ok ? 200 : response.code === "rate_limited" ? 429 : response.code === "pending" ? 202 : response.code === "credits_exhausted" ? 200 : response.code === "missing_output" ? 422 : response.code === "timeout" ? 504 : 500;
    return json(response, statusCode);
  } catch (error) {
    const out = failure("provider_error", error instanceof Error ? error.message : "Unknown error");
    logRouter("CRASH", { error: out.error, elapsedMs: Date.now() - requestStartedAt });
    return json(out, 500);
  }
});
