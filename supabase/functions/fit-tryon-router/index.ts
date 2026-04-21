// ─── FIT TRY-ON ROUTER — REPLICATE-ONLY ─────────────────────────────────────
// Perplexity has been fully removed from the FIT pipeline. Replicate (IDM-VTON)
// is the sole AI provider. On failure we return a normalized error and the
// client falls back to its deterministic local preview — never blank.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

// 35s — Replicate IDM-VTON cold-start + 40 steps regularly takes 18-28s.
// Anything below 25s caused most legit generations to abort as "timeout".
const SERVER_TIMEOUT_MS = 35_000;
const STALE_PENDING_MS = 120_000;

type ProviderName = "replicate";

interface RegionFitLite {
  region: string;
  fit: string;
}

interface CreateBody {
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
}

interface FailureResponse {
  ok: false;
  code: "timeout" | "generation_failed" | "provider_error" | "missing_output";
  error: string;
  provider?: ProviderName | null;
  selectedSize?: string;
}

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
  code: FailureResponse["code"],
  error: string,
  selectedSize?: string,
  provider: ProviderName | null = "replicate",
): FailureResponse {
  return { ok: false, code, error, selectedSize, provider };
}

function sizeFitBehavior(size: string) {
  const s = (size || "M").toUpperCase();
  if (s === "XS" || s === "S")
    return {
      ease: "tight body-hugging fit, almost no ease, cuffs and hem sit high",
      silhouette: "slim and structured, sleeves taut against the arms, shoulder seam pulled exactly to the joint, hem clearly above the hip",
      drape: "fabric stretches flat across chest and shoulders, no folds, no bunching, garment skims every body line",
    };
  if (s === "L")
    return {
      ease: "relaxed and roomy with generous ease (~8cm), longer body, wider sleeves",
      silhouette: "loose through chest and waist, shoulder seam slightly past the joint, sleeves clearly long, hem drops below the hip",
      drape: "soft visible folds at the waist and under the arms, fabric falls away from the torso, hem swings naturally",
    };
  if (s === "XL" || s === "XXL")
    return {
      ease: "clearly oversized with very generous ease (12cm or more), dropped shoulders, very long body and sleeves",
      silhouette: "boxy and dramatically oversized, shoulder seam visibly dropped onto the upper arm, sleeves falling near the wrist or past, hem near mid-thigh",
      drape: "deep cascading folds across the chest and back, billowing hem, fabric hangs noticeably away from the body in every direction",
    };
  return {
    ease: "true-to-size with natural ease (~5cm)",
    silhouette: "follows the body with comfortable room, shoulder seam at the joint, sleeves end at the wrist, hem at the hip",
    drape: "natural soft folds, balanced volume, fabric neither tight nor loose",
  };
}

function buildFitDescription(category: string | undefined, size: string, fitDescriptor: string | undefined, regions: RegionFitLite[] | undefined) {
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

async function markStaleFailed(supabase: ReturnType<typeof createClient>, id: string) {
  await supabase.from("fit_tryons").update({ status: "failed", error_message: "stale_pending_timeout" }).eq("id", id);
}

async function tryReplicate(token: string, body: CreateBody): Promise<SuccessResponse | FailureResponse> {
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
    ? { version: model.split(":")[1], input: { human_img: body.userImageUrl, garm_img: body.productImageUrl, garment_des, category, crop: false, force_dc: false, mask_only: false, seed, steps: 40 } }
    : { input: { human_img: body.userImageUrl, garm_img: body.productImageUrl, garment_des, category, crop: false, force_dc: false, mask_only: false, seed, steps: 40 } };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SERVER_TIMEOUT_MS);
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "wait=10" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      return failure(r.status === 429 ? "timeout" : "provider_error", String(data?.detail || `replicate http ${r.status}`), body.selectedSize, "replicate");
    }
    const imageUrl = parseOutput(data?.output);
    if (!imageUrl) {
      return failure(data?.status === "processing" || data?.status === "starting" ? "timeout" : "missing_output", data?.status === "processing" || data?.status === "starting" ? "generation_timeout" : "missing_output", body.selectedSize, "replicate");
    }
    return { ok: true, imageUrl, provider: "replicate", selectedSize: body.selectedSize };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return failure("timeout", "generation_timeout", body.selectedSize, "replicate");
    }
    return failure("provider_error", error instanceof Error ? error.message : "replicate_failed", body.selectedSize, "replicate");
  } finally {
    clearTimeout(timer);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const REPLICATE_API_TOKEN = Deno.env.get("REPLICATE_API_TOKEN");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const authHeader = req.headers.get("Authorization") || "";
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id || null;
  const requestStartedAt = Date.now();

  try {
    if (req.method === "GET") {
      return json(failure("provider_error", "polling_disabled_use_post", undefined, null), 410);
    }

    const body = (await req.json()) as CreateBody;
    logRouter("REQUEST_IN", { productKey: body?.productKey, selectedSize: body?.selectedSize });

    if (!body?.productImageUrl || !body?.selectedSize || !body?.productKey) {
      return json(failure("provider_error", "productImageUrl, productKey, selectedSize required", body?.selectedSize), 400);
    }

    const img = String(body.productImageUrl || "").trim();
    const usable = !!img && img !== "null" && img !== "undefined" && /^(https?:\/\/|data:image\/)/i.test(img);
    if (!usable) {
      const out = failure("missing_output", "missing_image", body.selectedSize);
      logRouter("RESPONSE_OUT", { status: out.code, elapsedMs: Date.now() - requestStartedAt });
      return json(out, 422);
    }

    if (userId && !body.forceRegenerate) {
      const { data: cached } = await supabase
        .from("fit_tryons")
        .select("id, status, provider, prediction_id, result_image_url, updated_at, error_message")
        .eq("user_id", userId)
        .eq("product_key", body.productKey)
        .eq("selected_size", body.selectedSize)
        .maybeSingle();

      if (cached) {
        const ageMs = cached.updated_at ? Date.now() - new Date(cached.updated_at).getTime() : 0;
        if (cached.status === "succeeded" && cached.result_image_url) {
          const out: SuccessResponse = { ok: true, imageUrl: cached.result_image_url, provider: "replicate", selectedSize: body.selectedSize };
          logRouter("CACHE_HIT", { ageMs, elapsedMs: Date.now() - requestStartedAt });
          return json(out);
        }
        if (["pending", "starting", "processing", "generating"].includes(cached.status || "")) {
          if (ageMs > STALE_PENDING_MS) {
            await markStaleFailed(supabase, cached.id);
          } else {
            const out = failure("timeout", "generation_timeout", body.selectedSize, "replicate");
            return json(out, 504);
          }
        }
      }
    }

    if (!body.userImageUrl) {
      const out = failure("provider_error", "userImageUrl required for try-on", body.selectedSize);
      return json(out, 400);
    }

    if (!REPLICATE_API_TOKEN) {
      const out = failure("provider_error", "REPLICATE_API_TOKEN missing", body.selectedSize, "replicate");
      logRouter("RESPONSE_OUT", { status: out.code, elapsedMs: Date.now() - requestStartedAt });
      return json(out, 500);
    }

    logRouter("REPLICATE_START", { productKey: body.productKey, selectedSize: body.selectedSize });
    const result = await tryReplicate(REPLICATE_API_TOKEN, body);

    if (result.ok) {
      if (userId) {
        await supabase.from("fit_tryons").upsert({
          user_id: userId,
          product_key: body.productKey,
          selected_size: body.selectedSize,
          provider: "replicate",
          model_id: Deno.env.get("REPLICATE_TRYON_MODEL") || "cuuupid/idm-vton",
          prediction_id: null,
          status: "succeeded",
          user_image_url: body.userImageUrl,
          product_image_url: body.productImageUrl,
          result_image_url: result.imageUrl,
          error_message: null,
          metadata: { fitDescriptor: body.fitDescriptor, regions: body.regions || [], sizeBehavior: sizeFitBehavior(body.selectedSize) },
        }, { onConflict: "user_id,product_key,selected_size" });
      }
      logRouter("REPLICATE_SUCCESS", { elapsedMs: Date.now() - requestStartedAt });
      return json(result);
    }

    if (userId) {
      await supabase.from("fit_tryons").upsert({
        user_id: userId,
        product_key: body.productKey,
        selected_size: body.selectedSize,
        provider: "replicate",
        model_id: null,
        prediction_id: null,
        status: "failed",
        user_image_url: body.userImageUrl,
        product_image_url: body.productImageUrl,
        result_image_url: null,
        error_message: result.error,
        metadata: { fitDescriptor: body.fitDescriptor, regions: body.regions || [], failedCode: result.code },
      }, { onConflict: "user_id,product_key,selected_size" });
    }

    logRouter("REPLICATE_FAIL", { code: result.code, elapsedMs: Date.now() - requestStartedAt });
    return json(result, result.code === "timeout" ? 504 : 502);
  } catch (error) {
    const out = failure("provider_error", error instanceof Error ? error.message : "Unknown error", undefined, null);
    logRouter("CRASH", { error: out.error, elapsedMs: Date.now() - requestStartedAt });
    return json(out, 500);
  }
});
