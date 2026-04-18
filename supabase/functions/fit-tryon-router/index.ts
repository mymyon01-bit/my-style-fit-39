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

/** Build a fit-aware natural-language description used by both providers. */
function buildFitDescription(
  category: string | undefined,
  size: string,
  fitDescriptor: string | undefined,
  regions: RegionFitLite[] | undefined
): string {
  const cat = (category || "garment").toLowerCase();
  const fit = fitDescriptor || "true-to-size";
  const regionPhrases = (regions || [])
    .filter((r) => r && r.region && r.fit)
    .slice(0, 5)
    .map((r) => `${r.region.toLowerCase()} ${r.fit.replace(/-/g, " ")}`)
    .join(", ");
  const base = `${cat} in size ${size}, ${fit} fit`;
  return regionPhrases ? `${base} — ${regionPhrases}` : base;
}

/** Compose a strong editorial prompt for Gemini fallback. */
function buildGeminiPrompt(
  category: string | undefined,
  size: string,
  fitDescriptor: string | undefined,
  regions: RegionFitLite[] | undefined
): string {
  const desc = buildFitDescription(category, size, fitDescriptor, regions);
  return (
    `Generate a photorealistic virtual try-on. Take the person from the FIRST image and dress them in the ${desc} from the SECOND image. ` +
    `Render the garment so the drape, ease, and silhouette accurately reflect the size and fit notes. ` +
    `Preserve the person's face, hair, skin tone, body proportions, pose, and original background EXACTLY. ` +
    `Match the original lighting direction, color temperature, and shadow softness. ` +
    `Render natural fabric drape, seams, and creases. Avoid distortion, warping, extra limbs, duplicated faces, or text overlays. ` +
    `Output a single full-body editorial-quality fashion photo, sharp and well-exposed.`
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

  const url = model.includes(":")
    ? "https://api.replicate.com/v1/predictions"
    : `https://api.replicate.com/v1/models/${model}/predictions`;
  const payload = model.includes(":")
    ? { version: model.split(":")[1], input: { human_img: body.userImageUrl, garm_img: body.productImageUrl, garment_des, category: garmentCategory, crop: false, seed: 42, steps: 30 } }
    : { input: { human_img: body.userImageUrl, garm_img: body.productImageUrl, garment_des, category: garmentCategory, crop: false, seed: 42, steps: 30 } };

  console.log("[router] replicate try", { model, size: body.selectedSize, garment_des });
  const r = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "wait=5" },
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

async function tryGemini(lovableKey: string, body: CreateBody): Promise<{
  ok: boolean;
  status: string;
  resultImageUrl?: string;
  error?: string;
}> {
  const prompt = buildGeminiPrompt(body.productCategory, body.selectedSize, body.fitDescriptor, body.regions);
  console.log("[router] gemini try", { size: body.selectedSize });
  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3-pro-image-preview",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: body.userImageUrl } },
            { type: "image_url", image_url: { url: body.productImageUrl } },
          ],
        },
      ],
      modalities: ["image", "text"],
    }),
  });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    console.error("[router] gemini failed", r.status, t.slice(0, 300));
    return { ok: false, status: "failed", error: `gemini http ${r.status}` };
  }
  const data = await r.json();
  const url = data?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!url) return { ok: false, status: "failed", error: "gemini returned no image" };
  return { ok: true, status: "succeeded", resultImageUrl: url };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const REPLICATE_API_TOKEN = Deno.env.get("REPLICATE_API_TOKEN");
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
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

    // Cache lookup (per provider-agnostic key)
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

    // Decide provider order
    const mode = body.mode || "high";
    const order: Array<"replicate" | "gemini"> =
      mode === "quick" ? ["gemini", "replicate"] : ["replicate", "gemini"];

    let lastError = "";
    for (const provider of order) {
      if (provider === "replicate") {
        if (!REPLICATE_API_TOKEN) { lastError = "REPLICATE_API_TOKEN missing"; continue; }
        const res = await tryReplicate(REPLICATE_API_TOKEN, body);
        if (res.ok) {
          // Cache row
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
              metadata: { fitDescriptor: body.fitDescriptor, regions: body.regions || [] },
            }, { onConflict: "user_id,product_key,selected_size" });
          }
          return json({
            status: res.status,
            predictionId: res.predictionId,
            resultImageUrl: res.resultImageUrl,
            provider: "replicate",
          });
        }
        lastError = res.error || "replicate failed";
        console.warn("[router] replicate failed → falling back", lastError);
      } else {
        if (!LOVABLE_API_KEY) { lastError = "LOVABLE_API_KEY missing"; continue; }
        const res = await tryGemini(LOVABLE_API_KEY, body);
        if (res.ok) {
          if (userId) {
            await supabase.from("fit_tryons").upsert({
              user_id: userId,
              product_key: body.productKey,
              selected_size: body.selectedSize,
              provider: "gemini",
              model_id: "google/gemini-3-pro-image-preview",
              prediction_id: null,
              status: "succeeded",
              user_image_url: body.userImageUrl,
              product_image_url: body.productImageUrl,
              result_image_url: res.resultImageUrl,
              metadata: { fitDescriptor: body.fitDescriptor, regions: body.regions || [], fallback: mode === "high" },
            }, { onConflict: "user_id,product_key,selected_size" });
          }
          return json({
            status: "succeeded",
            resultImageUrl: res.resultImageUrl,
            provider: "gemini",
          });
        }
        lastError = res.error || "gemini failed";
        console.warn("[router] gemini failed", lastError);
      }
    }

    return json({ status: "failed", error: lastError || "all providers failed" }, 502);
  } catch (e) {
    console.error("[router] error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
