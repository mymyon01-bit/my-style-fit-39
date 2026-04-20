// ─── TEXT → IMAGE TRY-ON (FALLBACK PATH) ───────────────────────────────────
// Used when the user has NO body scan photo. Generates a realistic fashion
// model wearing the product using a text prompt via Replicate (Flux schnell).
// Caches result in fit_tryons keyed by user_id + product_key + selected_size.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface Body {
  prompt: string;
  productKey: string;
  selectedSize: string;
  productImageUrl?: string | null;
  forceRegenerate?: boolean;
}

// FLUX 1.1 Pro — official Replicate model (no version pin needed),
// strong photoreal human renders, supports `image_prompt` for product
// visual reference (acts like a soft IP-Adapter / Kontext-lite).
const REPLICATE_TEXT_MODEL =
  Deno.env.get("REPLICATE_TEXT_MODEL") || "black-forest-labs/flux-1.1-pro";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const REPLICATE_TOKEN = Deno.env.get("REPLICATE_API_TOKEN");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("Authorization") ?? "";

  // Identify user
  const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: "unauthorized" }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  let body: Body;
  try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400); }

  if (!body.prompt || !body.productKey || !body.selectedSize) {
    return json({ error: "missing_fields" }, 400);
  }

  // ── 1. CACHE LOOKUP ──────────────────────────────────────────────────────
  if (!body.forceRegenerate) {
    const { data: cached } = await admin
      .from("fit_tryons")
      .select("result_image_url, status, provider")
      .eq("user_id", user.id)
      .eq("product_key", body.productKey)
      .eq("selected_size", body.selectedSize)
      .eq("status", "succeeded")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cached?.result_image_url) {
      console.log("[fit-tryon-text]", { stage: "cache_hit", user: user.id, key: body.productKey, size: body.selectedSize });
      return json({
        status: "succeeded",
        resultImageUrl: cached.result_image_url,
        provider: cached.provider || "replicate-text",
        cacheHit: true,
      });
    }
  }

  if (!REPLICATE_TOKEN) {
    return json({ error: "replicate_token_missing", provider: null }, 500);
  }

  // ── 2. CREATE PREDICTION ─────────────────────────────────────────────────
  const startedAt = Date.now();
  // Stable seed per (product+size) so S/M/L diverge by prompt, not noise.
  const seedBase = body.productKey.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const sizeBump: Record<string, number> = { XS: 11, S: 23, M: 0, L: 71, XL: 97, XXL: 113 };
  const seed = (seedBase + (sizeBump[body.selectedSize.toUpperCase()] ?? 0)) % 10000;

  const input: Record<string, unknown> = {
    prompt: body.prompt,
    aspect_ratio: "3:4",
    output_format: "webp",
    output_quality: 90,
    safety_tolerance: 5,
    prompt_upsampling: false,
    seed,
  };
  // Pass product image as visual reference (FLUX 1.1 Pro supports `image_prompt`).
  // RULE: if no productImageUrl is provided OR the URL is unreachable, we run
  // prompt-only and rely entirely on the body-measurement-driven prompt.
  const hasImage = !!body.productImageUrl && /^https?:\/\//i.test(body.productImageUrl);
  if (hasImage) {
    let imageReachable = false;
    try {
      const head = await fetch(body.productImageUrl!, {
        method: "HEAD",
        redirect: "follow",
        signal: AbortSignal.timeout(3500),
      });
      const ct = head.headers.get("content-type") || "";
      imageReachable = head.ok && ct.startsWith("image/");
      if (!imageReachable) {
        console.warn("[fit-tryon-text] image_prompt rejected", { status: head.status, ct });
      }
    } catch (e) {
      console.warn("[fit-tryon-text] image_prompt HEAD failed", e instanceof Error ? e.message : e);
    }
    if (imageReachable) {
      input.image_prompt = body.productImageUrl;
      input.image_prompt_strength = 0.35;
    } else {
      console.log("[fit-tryon-text] running prompt-only (image unreachable) — body metrics drive output");
    }
  } else {
    console.log("[fit-tryon-text] running prompt-only (no productImageUrl) — body metrics drive output");
  }

  const createRes = await fetch(`https://api.replicate.com/v1/models/${REPLICATE_TEXT_MODEL}/predictions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${REPLICATE_TOKEN}`,
      "Content-Type": "application/json",
      Prefer: "wait=20",
    },
    body: JSON.stringify({ input }),
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    console.error("[fit-tryon-text] replicate create failed", createRes.status, errText);

    // ── 429 RATE LIMIT — try nearest cached size, else return soft fallback ──
    if (createRes.status === 429 || createRes.status === 402) {
      const { data: nearby } = await admin
        .from("fit_tryons")
        .select("result_image_url, selected_size")
        .eq("user_id", user.id)
        .eq("product_key", body.productKey)
        .eq("status", "succeeded")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (nearby?.result_image_url) {
        return json({
          status: "succeeded",
          resultImageUrl: nearby.result_image_url,
          provider: "replicate-text",
          cacheHit: true,
          nearestSize: nearby.selected_size,
          rateLimited: true,
        });
      }
      // Soft 200 so client flips to fallback instead of throwing 502
      return json({
        status: "rate_limited",
        error: createRes.status === 429 ? "rate_limited" : "payment_required",
        fallback: true,
        provider: null,
        resultImageUrl: null,
        retryAfter: createRes.headers.get("retry-after") ?? null,
      }, 200);
    }

    return json({ error: `replicate_${createRes.status}`, details: errText.slice(0, 200) }, 502);
  }

  const created = await createRes.json();
  let prediction = created;

  // ── 3. POLL (max 25s — FLUX 1.1 Pro typical 6-15s) ──────────────────────
  const maxMs = 25_000;
  while (
    prediction.status !== "succeeded" &&
    prediction.status !== "failed" &&
    prediction.status !== "canceled" &&
    Date.now() - startedAt < maxMs
  ) {
    await new Promise((r) => setTimeout(r, 500));
    const pollRes = await fetch(prediction.urls.get, {
      headers: { Authorization: `Bearer ${REPLICATE_TOKEN}` },
    });
    prediction = await pollRes.json();
  }

  const durationMs = Date.now() - startedAt;

  if (prediction.status !== "succeeded") {
    console.warn("[fit-tryon-text]", { stage: "fail_or_timeout", status: prediction.status, durationMs });
    // PATCH 7 — fall back to nearest cached size for this product/user
    const { data: nearby } = await admin
      .from("fit_tryons")
      .select("result_image_url, selected_size")
      .eq("user_id", user.id)
      .eq("product_key", body.productKey)
      .eq("status", "succeeded")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    await admin.from("fit_tryons").insert({
      user_id: user.id,
      product_key: body.productKey,
      selected_size: body.selectedSize,
      provider: "replicate-text",
      status: "failed",
      prediction_id: prediction.id ?? null,
      error_message: prediction.error?.toString?.() || `status:${prediction.status}`,
      product_image_url: body.productImageUrl ?? null,
      metadata: { prompt: body.prompt, durationMs },
    });

    if (nearby?.result_image_url) {
      return json({
        status: "succeeded",
        resultImageUrl: nearby.result_image_url,
        provider: "replicate-text",
        cacheHit: true,
        nearestSize: nearby.selected_size,
      });
    }
    return json({ error: "generation_failed", status: prediction.status }, 502);
  }

  const out = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
  if (!out || typeof out !== "string") {
    return json({ error: "no_output" }, 502);
  }

  // ── 4. CACHE WRITE ───────────────────────────────────────────────────────
  await admin.from("fit_tryons").insert({
    user_id: user.id,
    product_key: body.productKey,
    selected_size: body.selectedSize,
    provider: "replicate-text",
    status: "succeeded",
    prediction_id: prediction.id ?? null,
    result_image_url: out,
    product_image_url: body.productImageUrl ?? null,
    metadata: { prompt: body.prompt, durationMs, model: REPLICATE_TEXT_MODEL },
  });

  console.log("[fit-tryon-text]", {
    stage: "success",
    user: user.id,
    size: body.selectedSize,
    durationMs,
    cacheHit: false,
  });

  return json({
    status: "succeeded",
    resultImageUrl: out,
    provider: "replicate-text",
    cacheHit: false,
    durationMs,
  });
});
