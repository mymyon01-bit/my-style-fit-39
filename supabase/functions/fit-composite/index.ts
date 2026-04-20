// ─── FIT COMPOSITE — TWO-IMAGE COORDINATE-DRIVEN TRY-ON ─────────────────────
// PRIMARY try-on path. Generates a body BASE image and a garment OVERLAY
// image using the SAME normalized 768x1024 frame, then composites them
// into one coherent hero image.
//
// On any stage failure we return { ok:false, fallback:true } so the client
// cascades to the existing fit-tryon-text single-pass path.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { Image } from "https://deno.land/x/imagescript@1.2.17/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const CANVAS_W = 768;
const CANVAS_H = 1024;
const STAGE_TIMEOUT_MS = 22_000;

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const IMAGE_MODEL = Deno.env.get("FIT_COMPOSITE_MODEL") || "google/gemini-2.5-flash-image";

interface BodyFrameLite {
  canvasWidth: number;
  canvasHeight: number;
  shoulderLineY: number;
  chestLineY: number;
  waistLineY: number;
  hipLineY: number;
  hemLineY: number;
  leftShoulderX: number;
  rightShoulderX: number;
  bodySummary: string;
}

interface OverlayMapLite {
  chestWidthPx: number;
  waistWidthPx: number;
  hemWidthPx: number;
  bodyLengthPx: number;
  shoulderDropPx: number;
  sleeveWidthPx: number;
  sleeveLengthPx: number;
  drapeCurve: number;
  fitType: string;
  silhouette: string;
  selectedSize: string;
  regionLabels: {
    chest: string;
    waist: string;
    shoulder: string;
    length: string;
    sleeve: string;
  };
}

interface RequestBody {
  productKey: string;
  selectedSize: string;
  productImageUrl: string;
  productName?: string;
  productCategory?: string;
  gender?: string | null;
  bodyFrame: BodyFrameLite;
  overlay: OverlayMapLite;
  bodyImageUrl?: string | null;
  forceRegenerate?: boolean;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function log(stage: string, details: Record<string, unknown>) {
  console.log("[fit-composite]", { stage, ...details });
}

const FRAME_HEADER =
  "Composition: front-facing standing fashion pose, single subject, full upper body and hips visible, head fully in frame, knees just visible at the bottom. " +
  "Camera: eye-level, no tilt, neutral 50mm lens. Background: clean light neutral studio backdrop with soft floor shadow and soft directional fashion lighting. " +
  "Aspect ratio 3:4. Centered subject. No text, no watermark, no props.";

function buildBodyBasePrompt(req: RequestBody): string {
  const f = req.bodyFrame;
  const gender = (req.gender || "neutral").toLowerCase();
  return [
    `A ${gender === "female" ? "female" : gender === "male" ? "male" : "androgynous"} fashion model, ${f.bodySummary}, wearing only neutral light-grey fitted base clothing (plain tank top and plain shorts) so a garment can be visualized over the torso later.`,
    FRAME_HEADER,
    `Strict anchor lines for consistency: shoulder at y≈${f.shoulderLineY}, chest at y≈${f.chestLineY}, waist at y≈${f.waistLineY}, hip at y≈${f.hipLineY}.`,
    `Shoulder span centered horizontally between x≈${f.leftShoulderX} and x≈${f.rightShoulderX}.`,
    `Pose: relaxed standing, arms at sides, palms in, neutral expression. Same pose every render. No accessories, no jewelry, no logo, no glasses.`,
    `Do NOT generate: outerwear, jacket, dress, prints, mannequin, floating clothes, duplicate limbs, warped torso, deformed hands, text artifacts.`,
  ].join(" ");
}

function buildGarmentOverlayPrompt(req: RequestBody): string {
  const o = req.overlay;
  const f = req.bodyFrame;
  const garment = (req.productCategory || req.productName || "garment").toLowerCase();
  const hemY = f.shoulderLineY + o.bodyLengthPx;
  return [
    `A premium e-commerce fashion image of the SAME ${req.gender || "neutral"} model wearing the selected ${garment} (size ${o.selectedSize}, ${o.silhouette.toUpperCase()} silhouette) over the same neutral base.`,
    FRAME_HEADER,
    `Use a fixed ${f.canvasWidth}x${f.canvasHeight} body frame. Garment placement coordinates:`,
    `chest line y≈${f.chestLineY} with garment width ≈${o.chestWidthPx}px;`,
    `waist line y≈${f.waistLineY} with garment width ≈${o.waistWidthPx}px;`,
    `hem line y≈${hemY} with hem width ≈${o.hemWidthPx}px.`,
    o.shoulderDropPx > 0
      ? `Shoulder seam drops ${o.shoulderDropPx}px past the natural shoulder onto the upper arm.`
      : `Shoulder seam sits cleanly on the natural shoulder point.`,
    o.sleeveWidthPx > 0
      ? `Sleeves with width ≈${o.sleeveWidthPx}px and length ≈${o.sleeveLengthPx}px.`
      : `Bottom garment — no sleeves.`,
    `Drape depth ${(o.drapeCurve * 100).toFixed(0)}% — render fold and shadow depth accordingly.`,
    `Region intent — chest: ${o.regionLabels.chest}, waist: ${o.regionLabels.waist}, shoulder: ${o.regionLabels.shoulder}, length: ${o.regionLabels.length}, sleeve: ${o.regionLabels.sleeve}.`,
    `The silhouette MUST visibly reflect size ${o.selectedSize} — narrower/shorter for S, wider/longer for L/XL.`,
    req.productImageUrl
      ? `Match the visual style, color, fabric and print of the reference product image as closely as possible.`
      : ``,
    `Do NOT generate: mannequin, floating clothes, flat pasted product card, duplicate limbs, warped torso, text, fake logos, watermark, deformed hands.`,
  ].filter(Boolean).join(" ");
}

interface AiImageResult {
  ok: boolean;
  bytes?: Uint8Array;
  error?: string;
}

async function callImageGenerator(prompt: string, referenceUrl?: string | null): Promise<AiImageResult> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return { ok: false, error: "LOVABLE_API_KEY missing" };

  const userContent: unknown[] = [{ type: "text", text: prompt }];
  if (referenceUrl && /^https?:\/\//i.test(referenceUrl)) {
    userContent.push({ type: "image_url", image_url: { url: referenceUrl } });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), STAGE_TIMEOUT_MS);
  try {
    const r = await fetch(LOVABLE_AI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: IMAGE_MODEL,
        messages: [{ role: "user", content: userContent }],
        modalities: ["image", "text"],
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (r.status === 429) return { ok: false, error: "rate_limited" };
    if (r.status === 402) return { ok: false, error: "payment_required" };
    if (!r.ok) {
      const text = await r.text().catch(() => "");
      return { ok: false, error: `ai_${r.status}:${text.slice(0, 120)}` };
    }
    const data = await r.json();
    const image = data?.choices?.[0]?.message?.images?.[0]?.image_url?.url as string | undefined;
    if (!image || typeof image !== "string") return { ok: false, error: "no_image_returned" };

    let bytes: Uint8Array;
    if (image.startsWith("data:")) {
      const b64 = image.split(",")[1] ?? "";
      const bin = atob(b64);
      bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    } else {
      const imgRes = await fetch(image, { signal: AbortSignal.timeout(8_000) });
      if (!imgRes.ok) return { ok: false, error: `image_fetch_${imgRes.status}` };
      bytes = new Uint8Array(await imgRes.arrayBuffer());
    }
    return { ok: true, bytes };
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof DOMException && err.name === "AbortError") {
      return { ok: false, error: "stage_timeout" };
    }
    return { ok: false, error: err instanceof Error ? err.message : "image_call_failed" };
  }
}

async function compositeImages(bodyBytes: Uint8Array, overlayBytes: Uint8Array): Promise<Uint8Array> {
  const bodyImg = await Image.decode(bodyBytes);
  const overlayImg = await Image.decode(overlayBytes);

  bodyImg.resize(CANVAS_W, CANVAS_H);
  overlayImg.resize(CANVAS_W, CANVAS_H);

  const out = new Image(CANVAS_W, CANVAS_H);
  out.composite(bodyImg, 0, 0);
  out.composite(overlayImg, 0, 0);

  return await out.encode();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const authHeader = req.headers.get("Authorization") || "";

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData } = await userClient.auth.getUser();
  const userId = userData?.user?.id;
  if (!userId) return json({ ok: false, error: "unauthorized", fallback: true }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "bad_json", fallback: true }, 400);
  }

  if (!body?.productKey || !body?.selectedSize || !body?.productImageUrl || !body?.bodyFrame || !body?.overlay) {
    return json({ ok: false, error: "missing_fields", fallback: true }, 400);
  }

  const startedAt = Date.now();
  log("REQUEST_IN", { productKey: body.productKey, selectedSize: body.selectedSize, userId });

  if (!body.forceRegenerate) {
    const { data: cached } = await admin
      .from("fit_tryons")
      .select("status, result_image_url, provider, metadata, updated_at")
      .eq("user_id", userId)
      .eq("product_key", body.productKey)
      .eq("selected_size", body.selectedSize)
      .eq("status", "succeeded")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (cached?.result_image_url) {
      log("CACHE_HIT", { productKey: body.productKey, selectedSize: body.selectedSize });
      return json({
        ok: true,
        compositeUrl: cached.result_image_url,
        provider: cached.provider || "fit-composite",
        cacheHit: true,
        metadata: cached.metadata,
      });
    }
  }

  const bodyPrompt = buildBodyBasePrompt(body);
  const overlayPrompt = buildGarmentOverlayPrompt(body);

  log("STAGE_START", { stage: "parallel_generation" });
  const [bodyResult, overlayResult] = await Promise.all([
    callImageGenerator(bodyPrompt, null),
    callImageGenerator(overlayPrompt, body.productImageUrl),
  ]);

  if (!bodyResult.ok || !overlayResult.ok) {
    const reason = bodyResult.error || overlayResult.error || "generation_failed";
    log("STAGE_FAIL", { stage: "generation", reason });
    return json({ ok: false, error: reason, fallback: true }, 200);
  }

  let compositeBytes: Uint8Array;
  try {
    compositeBytes = await compositeImages(bodyResult.bytes!, overlayResult.bytes!);
  } catch (err) {
    log("STAGE_FAIL", { stage: "composite", reason: err instanceof Error ? err.message : "composite_failed" });
    return json({ ok: false, error: "composite_failed", fallback: true }, 200);
  }

  const ts = Date.now();
  const baseFolder = `${userId}/${body.productKey}`;
  const compositePath = `${baseFolder}/${body.selectedSize}-${ts}-composite.png`;
  const bodyPath = `${baseFolder}/${body.selectedSize}-${ts}-body.png`;
  const overlayPath = `${baseFolder}/${body.selectedSize}-${ts}-overlay.png`;

  const upload = async (path: string, bytes: Uint8Array) => {
    const { error } = await admin.storage
      .from("fit-composites")
      .upload(path, bytes, { contentType: "image/png", upsert: true });
    if (error) throw error;
    const { data } = admin.storage.from("fit-composites").getPublicUrl(path);
    return data.publicUrl;
  };

  let compositeUrl: string;
  let bodyBaseUrl: string;
  let overlayUrl: string;
  try {
    [compositeUrl, bodyBaseUrl, overlayUrl] = await Promise.all([
      upload(compositePath, compositeBytes),
      upload(bodyPath, bodyResult.bytes!),
      upload(overlayPath, overlayResult.bytes!),
    ]);
  } catch (err) {
    log("STAGE_FAIL", { stage: "upload", reason: err instanceof Error ? err.message : "upload_failed" });
    return json({ ok: false, error: "upload_failed", fallback: true }, 200);
  }

  const durationMs = Date.now() - startedAt;
  log("STAGE_SUCCESS", { durationMs, compositeUrl });

  await admin.from("fit_tryons").upsert({
    user_id: userId,
    product_key: body.productKey,
    selected_size: body.selectedSize,
    provider: "fit-composite",
    status: "succeeded",
    result_image_url: compositeUrl,
    product_image_url: body.productImageUrl,
    metadata: {
      bodyBaseUrl,
      overlayUrl,
      compositeUrl,
      bodyFrame: body.bodyFrame,
      overlay: body.overlay,
      durationMs,
      pipeline: "two-image-coordinate",
    },
  }, { onConflict: "user_id,product_key,selected_size" });

  return json({
    ok: true,
    compositeUrl,
    bodyBaseUrl,
    overlayUrl,
    provider: "fit-composite",
    cacheHit: false,
    durationMs,
  });
});
