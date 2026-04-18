// Async try-on using Replicate. POST = create prediction, GET ?id= = status.
// Caches per (user_id, product_key, selected_size) in fit_tryons table.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

// Default model: cuuupid/idm-vton — robust virtual try-on
// Community models MUST be pinned with a version hash; the /v1/models/{owner}/{name}/predictions
// endpoint is reserved for official models only and returns 404 otherwise.
// Override via REPLICATE_TRYON_MODEL env var (format: "owner/name:versionHash").
const DEFAULT_MODEL =
  "cuuupid/idm-vton:0513734a452173b8173e907e3a59d19a36266e55b48528559432bd21c7d7e985";

interface CreateBody {
  userImageUrl?: string;
  productImageUrl: string;
  productKey: string;
  productCategory?: string;
  selectedSize: string;
  fitSummary?: Record<string, unknown>;
  bodyProfileSummary?: Record<string, unknown>;
  forceRegenerate?: boolean;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function mapCategory(cat?: string): string {
  const c = (cat || "").toLowerCase();
  if (c.includes("pant") || c.includes("jean") || c.includes("trouser") || c.includes("skirt") || c.includes("short"))
    return "lower_body";
  if (c.includes("dress") || c.includes("jumpsuit") || c.includes("overall")) return "dresses";
  return "upper_body";
}

async function callReplicate(token: string, model: string, input: Record<string, unknown>) {
  // If model contains ":" treat as version hash, else use models/{owner}/{name}/predictions
  let url: string;
  let payload: Record<string, unknown>;
  if (model.includes(":")) {
    const [, version] = model.split(":");
    url = "https://api.replicate.com/v1/predictions";
    payload = { version, input };
  } else {
    url = `https://api.replicate.com/v1/models/${model}/predictions`;
    payload = { input };
  }
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "wait=5", // try to get fast result inline if possible
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  return { ok: res.ok, status: res.status, data };
}

function parseOutput(output: unknown): string | null {
  if (!output) return null;
  if (typeof output === "string") return output;
  if (Array.isArray(output) && output.length > 0) {
    const first = output[0];
    if (typeof first === "string") return first;
    if (first && typeof first === "object" && "url" in (first as any)) return (first as any).url;
  }
  if (typeof output === "object" && output !== null && "url" in (output as any)) return (output as any).url;
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const REPLICATE_API_TOKEN = Deno.env.get("REPLICATE_API_TOKEN");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  if (!REPLICATE_API_TOKEN) return json({ error: "REPLICATE_API_TOKEN not configured" }, 500);

  const authHeader = req.headers.get("Authorization") || "";
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id || null;

  const model = Deno.env.get("REPLICATE_TRYON_MODEL") || DEFAULT_MODEL;
  const url = new URL(req.url);

  try {
    // ── STATUS POLL ─────────────────────────────────────────────
    if (req.method === "GET") {
      const predictionId = url.searchParams.get("id");
      if (!predictionId) return json({ error: "id required" }, 400);

      const r = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
        headers: { Authorization: `Bearer ${REPLICATE_API_TOKEN}` },
      });
      const data = await r.json();
      console.log("[tryon-replicate] poll", predictionId, data?.status);

      const status = data?.status as string;
      const resultImageUrl = status === "succeeded" ? parseOutput(data?.output) : null;
      const errorMessage = status === "failed" ? (data?.error || "Replicate failed") : null;

      if (userId && (resultImageUrl || errorMessage)) {
        await supabase
          .from("fit_tryons")
          .update({
            status,
            result_image_url: resultImageUrl,
            error_message: errorMessage,
          })
          .eq("prediction_id", predictionId)
          .eq("user_id", userId);
      }

      return json({ status, predictionId, resultImageUrl, error: errorMessage });
    }

    // ── CREATE PREDICTION ───────────────────────────────────────
    const body = (await req.json()) as CreateBody;
    if (!body?.productImageUrl || !body?.selectedSize || !body?.productKey) {
      return json({ error: "productImageUrl, productKey, selectedSize required" }, 400);
    }

    // Cache lookup
    if (userId && !body.forceRegenerate) {
      const { data: cached } = await supabase
        .from("fit_tryons")
        .select("*")
        .eq("user_id", userId)
        .eq("product_key", body.productKey)
        .eq("selected_size", body.selectedSize)
        .maybeSingle();

      if (cached?.result_image_url && cached.status === "succeeded") {
        console.log("[tryon-replicate] cache hit", cached.id);
        return json({
          status: "succeeded",
          predictionId: cached.prediction_id,
          resultImageUrl: cached.result_image_url,
          cached: true,
        });
      }
      if (cached?.status === "starting" || cached?.status === "processing") {
        return json({
          status: cached.status,
          predictionId: cached.prediction_id,
          resultImageUrl: null,
        });
      }
    }

    if (!body.userImageUrl) {
      return json({ error: "userImageUrl required for try-on" }, 400);
    }

    const garmentCategory = mapCategory(body.productCategory);
    const garmentDes = `${body.productCategory || "garment"} in ${body.selectedSize}`;

    // IDM-VTON input mapping
    const input = {
      human_img: body.userImageUrl,
      garm_img: body.productImageUrl,
      garment_des: garmentDes,
      category: garmentCategory,
      crop: false,
      seed: 42,
      steps: 30,
    };

    console.log("[tryon-replicate] create", { model, productKey: body.productKey, size: body.selectedSize });
    const { ok, status, data } = await callReplicate(REPLICATE_API_TOKEN, model, input);
    if (!ok) {
      console.error("[tryon-replicate] create failed", status, data);
      const detail = String(data?.detail || "");
      let reason: "rate_limited" | "billing_required" | "auth" | "provider_error" = "provider_error";
      if (status === 401) reason = "auth";
      else if (status === 429 && /payment method/i.test(detail)) reason = "billing_required";
      else if (status === 429) reason = "rate_limited";
      return json(
        { error: detail || "Replicate request failed", reason, retryAfter: data?.retry_after ?? null, status },
        status === 429 ? 429 : 502
      );
    }

    const predictionId = data?.id as string;
    const predStatus = data?.status as string;
    const inlineResult = predStatus === "succeeded" ? parseOutput(data?.output) : null;

    // Cache row
    if (userId) {
      await supabase
        .from("fit_tryons")
        .upsert(
          {
            user_id: userId,
            product_key: body.productKey,
            selected_size: body.selectedSize,
            provider: "replicate",
            model_id: model,
            prediction_id: predictionId,
            status: predStatus,
            user_image_url: body.userImageUrl,
            product_image_url: body.productImageUrl,
            result_image_url: inlineResult,
            metadata: {
              category: garmentCategory,
              fitSummary: body.fitSummary || {},
              bodyProfileSummary: body.bodyProfileSummary || {},
            },
          },
          { onConflict: "user_id,product_key,selected_size" }
        );
    }

    return json({
      status: predStatus,
      predictionId,
      resultImageUrl: inlineResult,
    });
  } catch (e) {
    console.error("[tryon-replicate] error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
