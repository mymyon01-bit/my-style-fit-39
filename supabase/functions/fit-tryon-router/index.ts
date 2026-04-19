// Provider router for try-on. Picks Replicate (high quality) by default,
// falls back to Gemini (Lovable AI gateway) on failure or when ?mode=quick.
// Always returns the Fit-aware response shape:
//   { status, predictionId?, resultImageUrl?, provider, error? }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

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
  mode?: "quick" | "high"; // quick=Gemini first, high=Replicate first (default)
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ─── SIZE → FIT BEHAVIOR (CRITICAL — drives visible S/M/L/XL differences) ──
function sizeFitBehavior(size: string): {
  ease: string;
  silhouette: string;
  drape: string;
} {
  const s = (size || "M").toUpperCase();
  if (s === "XS" || s === "S") {
    return {
      ease: "tight, body-skimming with minimal ease (about 2cm)",
      silhouette: "fitted close to the torso, sleeves taut, hem sits high",
      drape: "fabric stretches across chest and shoulders, no excess folds",
    };
  }
  if (s === "L") {
    return {
      ease: "relaxed with generous ease (about 8cm)",
      silhouette: "loose through chest and waist, sleeves slightly long",
      drape: "soft folds at the waist and under the arms, hem drops naturally",
    };
  }
  if (s === "XL" || s === "XXL") {
    return {
      ease: "oversized with very generous ease (about 12cm or more)",
      silhouette: "dropped shoulders, boxy through the body, long sleeves",
      drape: "deep folds across the chest, billowing hem, fabric hangs away from body",
    };
  }
  // M / default
  return {
    ease: "true-to-size with natural ease (about 5cm)",
    silhouette: "follows body lines with comfortable room",
    drape: "natural folds, sleeves hit the wrist, hem at the hip",
  };
}

/** Build a fit-aware natural-language description used by both providers. */
function buildFitDescription(
  category: string | undefined,
  size: string,
  fitDescriptor: string | undefined,
  regions: RegionFitLite[] | undefined
): string {
  const cat = (category || "garment").toLowerCase();
  const fit = fitDescriptor || "true-to-size";
  const behavior = sizeFitBehavior(size);
  const regionPhrases = (regions || [])
    .filter((r) => r && r.region && r.fit)
    .slice(0, 5)
    .map((r) => `${r.region.toLowerCase()} ${r.fit.replace(/-/g, " ")}`)
    .join(", ");
  const base = `${cat} in size ${size} (${fit} fit, ${behavior.ease}); ${behavior.silhouette}; ${behavior.drape}`;
  return regionPhrases ? `${base} — region notes: ${regionPhrases}` : base;
}

/** Compose a strong editorial prompt for Gemini fallback. */
function buildGeminiPrompt(
  category: string | undefined,
  size: string,
  fitDescriptor: string | undefined,
  regions: RegionFitLite[] | undefined
): string {
  const desc = buildFitDescription(category, size, fitDescriptor, regions);
  const behavior = sizeFitBehavior(size);
  return (
    `Generate a single photorealistic full-body virtual try-on image. ` +
    `Take the PERSON from the FIRST image and dress them in the GARMENT from the SECOND image. ` +
    `Garment: ${desc}. ` +
    `Fit behavior for size ${size}: ${behavior.silhouette}. Drape: ${behavior.drape}. ` +
    `STRICT REQUIREMENTS:\n` +
    `- The garment MUST sit on the person's body, anchored to shoulders / waist / hips with correct perspective.\n` +
    `- The garment MUST NOT float, hover, or appear as a centered sticker overlay.\n` +
    `- Preserve the person's face, hair, skin tone, body proportions, pose, and background EXACTLY.\n` +
    `- Match original lighting direction, color temperature, and shadow softness.\n` +
    `- Render natural fabric drape, seams, creases, and shadow contact at hem and sleeves.\n` +
    `- Background must remain clean, neutral, and identical to the original.\n` +
    `- Output a single sharp full-body editorial fashion photo, minimum 768px on the long edge.\n` +
    `DO NOT: produce a mannequin, duplicated faces, extra limbs, distorted hands, text overlays, ` +
    `logo hallucinations, duplicate clothing, or a different person. ` +
    `DO NOT center the garment in the frame independent of the body.`
  );
}

async function tryReplicate(token: string, body: CreateBody): Promise<{
  ok: boolean;
  status: string;
  predictionId?: string;
  resultImageUrl?: string;
  error?: string;
}> {
  // Community models MUST be pinned with a version hash; the official-models endpoint returns 404 otherwise.
  const model =
    Deno.env.get("REPLICATE_TRYON_MODEL") ||
    "cuuupid/idm-vton:0513734a452173b8173e907e3a59d19a36266e55b48528559432bd21c7d7e985";
  const garmentCategory = (() => {
    const c = (body.productCategory || "").toLowerCase();
    if (c.includes("pant") || c.includes("jean") || c.includes("trouser") || c.includes("skirt") || c.includes("short")) return "lower_body";
    if (c.includes("dress") || c.includes("jumpsuit") || c.includes("overall")) return "dresses";
    return "upper_body";
  })();
  const garment_des = buildFitDescription(body.productCategory, body.selectedSize, body.fitDescriptor, body.regions);

  // Size-stable but size-distinct seed so S/M/L/XL diverge visibly without random churn.
  const sizeSeed: Record<string, number> = { XS: 11, S: 23, M: 42, L: 71, XL: 97, XXL: 113 };
  const seed = sizeSeed[(body.selectedSize || "M").toUpperCase()] ?? 42;

  const url = model.includes(":")
    ? "https://api.replicate.com/v1/predictions"
    : `https://api.replicate.com/v1/models/${model}/predictions`;

  const input = {
    human_img: body.userImageUrl,
    garm_img: body.productImageUrl,
    garment_des,
    category: garmentCategory,
    crop: false,
    force_dc: false,
    mask_only: false,
    seed,
    steps: 40, // higher quality (was 30)
  };

  const payload = model.includes(":")
    ? { version: model.split(":")[1], input }
    : { input };

  console.log("[router] replicate try", { model, size: body.selectedSize, seed, garment_des });
  const r = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "wait=10" },
    body: JSON.stringify(payload),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    console.error("[router] replicate failed", r.status, data);
    return { ok: false, status: "failed", error: data?.detail || `replicate http ${r.status}` };
  }
  const predStatus = data?.status as string;
  const inline = predStatus === "succeeded" ? parseOutput(data?.output) : undefined;
  return { ok: true, status: predStatus, predictionId: data?.id, resultImageUrl: inline };
}

function parseOutput(output: unknown): string | undefined {
  if (!output) return undefined;
  if (typeof output === "string") return output;
  if (Array.isArray(output) && output.length > 0) {
    const first = output[0];
    if (typeof first === "string") return first;
    if (first && typeof first === "object" && "url" in (first as any)) return (first as any).url;
  }
  if (typeof output === "object" && output !== null && "url" in (output as any)) return (output as any).url;
  return undefined;
}

// ─── PERPLEXITY FALLBACK (PRIMARY FALLBACK — replaces Gemini) ──────────────
async function tryPerplexity(body: CreateBody): Promise<{
  ok: boolean;
  status: string;
  resultImageUrl?: string;
  error?: string;
  latency_ms?: number;
}> {
  const t0 = Date.now();
  const garment_des = buildFitDescription(body.productCategory, body.selectedSize, body.fitDescriptor, body.regions);
  console.log("[router] perplexity try", { size: body.selectedSize });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const r = await fetch(`${SUPABASE_URL}/functions/v1/fit-tryon-perplexity`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        apikey: SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        productImageUrl: body.productImageUrl,
        productCategory: body.productCategory,
        selectedSize: body.selectedSize,
        fitDescriptor: body.fitDescriptor,
        garmentDescription: garment_des,
      }),
    });
    const data = await r.json().catch(() => ({}));
    const latency = Date.now() - t0;
    if (!data?.ok || !data?.imageUrl) {
      console.error("[router] perplexity failed", data?.error, { latency });
      return { ok: false, status: "failed", error: data?.error || "perplexity_failed", latency_ms: latency };
    }
    return { ok: true, status: "succeeded", resultImageUrl: data.imageUrl, latency_ms: latency };
  } catch (e) {
    console.error("[router] perplexity error", e);
    return { ok: false, status: "failed", error: e instanceof Error ? e.message : "perplexity_unknown" };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const REPLICATE_API_TOKEN = Deno.env.get("REPLICATE_API_TOKEN");
  const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

  const authHeader = req.headers.get("Authorization") || "";
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id || null;

  const url = new URL(req.url);

  try {
    // ── STATUS POLL (Replicate predictions only) ─────────────────
    if (req.method === "GET") {
      const predictionId = url.searchParams.get("id");
      if (!predictionId) return json({ error: "id required" }, 400);
      if (!REPLICATE_API_TOKEN) return json({ error: "REPLICATE_API_TOKEN not configured" }, 500);

      const r = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
        headers: { Authorization: `Bearer ${REPLICATE_API_TOKEN}` },
      });
      const data = await r.json();
      const status = data?.status as string;
      const resultImageUrl = status === "succeeded" ? parseOutput(data?.output) : null;
      const errorMessage = status === "failed" ? (data?.error || "Replicate failed") : null;
      console.log("[router] poll", predictionId, status);

      if (userId && (resultImageUrl || errorMessage)) {
        await supabase
          .from("fit_tryons")
          .update({ status, result_image_url: resultImageUrl, error_message: errorMessage })
          .eq("prediction_id", predictionId)
          .eq("user_id", userId);
      }
      return json({ status, predictionId, resultImageUrl, provider: "replicate", error: errorMessage });
    }

    // ── CREATE ──────────────────────────────────────────────────
    const body = (await req.json()) as CreateBody;
    if (!body?.productImageUrl || !body?.selectedSize || !body?.productKey) {
      return json({ error: "productImageUrl, productKey, selectedSize required" }, 400);
    }

    // Cache lookup (per provider-agnostic key) — keyed by product + size so S/M/L/XL are distinct rows
    if (userId && !body.forceRegenerate) {
      const { data: cached } = await supabase
        .from("fit_tryons")
        .select("*")
        .eq("user_id", userId)
        .eq("product_key", body.productKey)
        .eq("selected_size", body.selectedSize)
        .maybeSingle();

      if (cached?.result_image_url && cached.status === "succeeded") {
        console.log("[router] cache hit", cached.id, cached.provider);
        return json({
          status: "succeeded",
          predictionId: cached.prediction_id,
          resultImageUrl: cached.result_image_url,
          provider: cached.provider || "replicate",
          cached: true,
        });
      }
      if (cached?.status === "starting" || cached?.status === "processing") {
        return json({ status: cached.status, predictionId: cached.prediction_id, resultImageUrl: null, provider: cached.provider || "replicate" });
      }
    }

    if (!body.userImageUrl) return json({ error: "userImageUrl required for try-on" }, 400);

    // Provider order: REPLICATE (primary) → PERPLEXITY (fallback). Gemini removed.
    // `mode === "quick"` is now an alias for "perplexity-only attempt".
    const mode = body.mode || "high";
    const order: Array<"replicate" | "perplexity"> =
      mode === "quick" ? ["perplexity"] : ["replicate", "perplexity"];

    const log = {
      provider_attempted: [] as string[],
      replicate_failed: false as boolean,
      perplexity_failed: false as boolean,
      fallback_used: false as boolean,
      final_provider: null as string | null,
      latency_ms: 0,
    };
    const tStart = Date.now();
    let lastError = "";

    for (const provider of order) {
      log.provider_attempted.push(provider);

      if (provider === "replicate") {
        if (!REPLICATE_API_TOKEN) {
          lastError = "REPLICATE_API_TOKEN missing";
          log.replicate_failed = true;
          continue;
        }
        const res = await tryReplicate(REPLICATE_API_TOKEN, body);
        if (res.ok) {
          if (userId) {
            await supabase.from("fit_tryons").upsert({
              user_id: userId,
              product_key: body.productKey,
              selected_size: body.selectedSize,
              provider: "replicate",
              model_id: Deno.env.get("REPLICATE_TRYON_MODEL") || "cuuupid/idm-vton",
              prediction_id: res.predictionId,
              status: res.status,
              user_image_url: body.userImageUrl,
              product_image_url: body.productImageUrl,
              result_image_url: res.resultImageUrl,
              metadata: { fitDescriptor: body.fitDescriptor, regions: body.regions || [], sizeBehavior: sizeFitBehavior(body.selectedSize) },
            }, { onConflict: "user_id,product_key,selected_size" });
          }
          log.final_provider = "replicate";
          log.latency_ms = Date.now() - tStart;
          console.log("[router] success", log);
          return json({
            status: res.status,
            predictionId: res.predictionId,
            resultImageUrl: res.resultImageUrl,
            provider: "replicate",
            fallbackUsed: false,
          });
        }
        log.replicate_failed = true;
        lastError = res.error || "replicate failed";
        console.warn("[router] replicate failed → trying perplexity", lastError);
      } else {
        // ── PERPLEXITY FALLBACK ─────────────────────────────────
        if (!PERPLEXITY_API_KEY) {
          lastError = "PERPLEXITY_API_KEY missing";
          log.perplexity_failed = true;
          console.warn("[router] perplexity skipped — key missing");
          continue;
        }
        const res = await tryPerplexity(body);
        if (res.ok) {
          log.fallback_used = true;
          log.final_provider = "perplexity";
          log.latency_ms = Date.now() - tStart;
          if (userId) {
            await supabase.from("fit_tryons").upsert({
              user_id: userId,
              product_key: body.productKey,
              selected_size: body.selectedSize,
              provider: "perplexity",
              model_id: "perplexity/sonar",
              prediction_id: null,
              status: "succeeded",
              user_image_url: body.userImageUrl,
              product_image_url: body.productImageUrl,
              result_image_url: res.resultImageUrl,
              metadata: {
                fitDescriptor: body.fitDescriptor,
                regions: body.regions || [],
                sizeBehavior: sizeFitBehavior(body.selectedSize),
                fallback: true,
                replicate_error: lastError || null,
              },
            }, { onConflict: "user_id,product_key,selected_size" });
          }
          console.log("[router] success (fallback)", log);
          return json({
            status: "succeeded",
            resultImageUrl: res.resultImageUrl,
            provider: "perplexity",
            fallbackUsed: true,
          });
        }
        log.perplexity_failed = true;
        lastError = res.error || "perplexity failed";
        console.warn("[router] perplexity failed", lastError);
      }
    }

    log.latency_ms = Date.now() - tStart;
    console.error("[router] all providers failed", log, lastError);
    return json({
      status: "failed",
      error: lastError || "all providers failed",
      provider: null,
      fallbackUsed: false,
      previewOnly: true,
    }, 502);
  } catch (e) {
    console.error("[router] error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
