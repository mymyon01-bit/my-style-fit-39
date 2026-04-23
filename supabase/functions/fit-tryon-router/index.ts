// ─── FIT TRY-ON ROUTER (REPLICATE IDM-VTON) ────────────────────────────────
// Final image generation runs on Replicate IDM-VTON. Local code (in
// `fit-generate-v2` and `src/lib/fit/*`) handles fit calculation, region
// interpretation, and prompt assembly — no Gemini dependency in this path.
// Optional lightweight assist (e.g. body bbox) lives in `fit-vision-analyze`
// and uses gemini-2.5-flash-lite (free-tier friendly), and is OPTIONAL.
//
// Flow:
//   1. local fit calc + prompt (handled by caller / fit-generate-v2)
//   2. Replicate IDM-VTON renders the final try-on image
//   3. result is persisted to the `fit-composites` storage bucket
//   4. persistent URL is stored in `fit_tryons` and returned to the UI

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const SERVER_TIMEOUT_MS = 55_000; // image gen needs more headroom than vton

// ─── PROVIDER SELECTION ─────────────────────────────────────────────────────
// Default mode = "studio": clean newly-generated text-to-image render driven
// by the user's body proportions + region fit deltas. The garment image is
// passed as a visual reference; the original photo background is NEVER kept.
//
// Opt-in mode = "vton": uses Replicate IDM-VTON to composite the garment onto
// the user photo (legacy behavior). Triggered via `mode: "vton"` in the body.
const STUDIO_MODEL_ID = Deno.env.get("REPLICATE_FIT_STUDIO_MODEL") || "black-forest-labs/flux-schnell";
const STUDIO_MODEL_VERSION = Deno.env.get("REPLICATE_FIT_STUDIO_MODEL_VERSION") || "";
const VTON_MODEL_ID = Deno.env.get("REPLICATE_FIT_MODEL") || "cuuupid/idm-vton";
const VTON_MODEL_VERSION = Deno.env.get("REPLICATE_FIT_MODEL_VERSION") || "c871bb9b046607b680449ecbae55fd8c6d945e0a1948644bf2361b3d021d3ff4";
// Back-compat aliases (used by older code paths in this file)
const MODEL_ID = VTON_MODEL_ID;
const MODEL_VERSION = VTON_MODEL_VERSION;
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
  /**
   * Pre-computed baseline-vs-current-size verdict from the client. When the
   * product has no measurements, this is the ONLY truth the prompt has about
   * whether the chosen size will actually fit. Drives the exaggerated visual
   * consequences (blanket / compressed / etc.).
   */
  baselineVerdict?: {
    baseline?: string;
    offset?: number;            // +N = current size smaller than baseline
    verdict?: string;           // way-too-tight | tight | matches | loose | blanket
    consequence?: string;       // human sentence describing fabric behavior
    fallbackMode?: boolean;     // true when no product measurement data
  };
  forceRegenerate?: boolean;
  /**
   * "studio" (DEFAULT) — clean newly-generated text-to-image render reflecting
   *   the body model + region fit deltas. NEVER reuses the original user
   *   photo as a canvas. This is the purchase-decision-grade preview.
   * "vton" — legacy IDM-VTON virtual try-on (composites onto the user photo).
   */
  mode?: "studio" | "vton";
  /**
   * Set to true by the client when the previous render failed the quality
   * gate (too small, blank, malformed). Triggers a more conservative prompt
   * + cache bypass so the user gets a clean image on the second try.
   */
  safeMode?: boolean;
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
  return { ok: false, code, error, selectedSize, provider: "replicate", status: "failed", requestId, predictionId: null };
}

function pending(code: PendingCode, params: { error?: string | null; selectedSize?: string; status: PendingResponse["status"]; requestId?: string | null; retryAfterMs?: number | null; }): PendingResponse {
  return {
    ok: false, code,
    error: params.error ?? null,
    provider: "replicate",
    selectedSize: params.selectedSize,
    status: params.status,
    requestId: params.requestId ?? null,
    predictionId: null,
    retryAfterMs: params.retryAfterMs ?? null,
  };
}

// ─── PROMPT BUILDING ────────────────────────────────────────────────────────
function describeBuild(b?: CreateBody["bodyProfileSummary"]) {
  if (!b?.heightCm || !b?.weightKg) return "average build, average body width";
  const bmi = b.weightKg / Math.pow(b.heightCm / 100, 2);
  // Body width MUST scale with weight, not just BMI tier label.
  // No upper clamp — extreme weights MUST extend the silhouette, never normalize.
  if (bmi < 17)   return "very thin build, narrow frame, slim limbs, visible bone structure, minimal body mass";
  if (bmi < 18.5) return "very slim build, narrow shoulders, slim torso, slim waist, slim arms and legs";
  if (bmi < 22)   return "slim build, lean torso, slim waist, lean arms and legs";
  if (bmi < 25)   return "average build, balanced torso width, natural waist, average arms and legs";
  if (bmi < 28)   return "solid build, slightly wider torso, fuller waist, slightly thicker arms and legs";
  if (bmi < 32)   return "heavier build, visibly wider torso and shoulders, fuller waist and midsection, thicker arms and legs, soft body contours";
  if (bmi < 36)   return "plus-size build, broad torso, wide waist and hips, full midsection, thick arms and legs, rounded body shape";
  if (bmi < 42)   return "very plus-size build, very broad torso and shoulders, very wide waist and hips, large midsection, thick limbs, rounded full-bodied shape";
  return "extra-large body mass build, extremely broad torso and shoulders, very wide waist and hips, very large midsection, very thick limbs, fully rounded silhouette — DO NOT clamp or shrink the body";
}

function describeSubject(b?: CreateBody["bodyProfileSummary"]) {
  // BODY GENDER LOCK: subject gender comes ONLY from the user's body profile.
  // It is never inferred from the product. A male user wearing a women's
  // garment must still be rendered as a male-proportioned MANNEQUIN wearing
  // that garment.
  const g = (b?.gender || "").toLowerCase();
  if (g === "female" || g === "feminine" || g === "woman") return "female mannequin";
  if (g === "male" || g === "masculine" || g === "man") return "male mannequin";
  return "neutral mannequin";
}

function sizeSilhouette(size: string) {
  const s = (size || "M").toUpperCase();
  if (s === "XS" || s === "S") return "tight body-skimming silhouette, sleeves hugging the arm, hem high on the hip, fabric pulled close with visible tension";
  if (s === "L") return "relaxed silhouette with visible chest room, softer waist, slightly longer hem, soft drape";
  if (s === "XL" || s === "XXL") return "oversized silhouette with dropped shoulders, generous chest and waist volume, hem near mid-thigh, deep folds and excess fabric";
  return "fitted regular silhouette with natural ease, shoulder seam at the joint, hem at the hip";
}

function regionPhrase(regions?: RegionFitLite[]) {
  if (!regions?.length) return "";
  const parts = regions
    .filter((r) => r?.region && r?.fit)
    .slice(0, 6)
    .map((r) => `${r.region.toLowerCase()} ${r.fit.replace(/-/g, " ")}`);
  return parts.length ? `Region-by-region fit: ${parts.join("; ")}.` : "";
}

function isBagCategory(cat?: string | null) {
  return /bag|backpack|tote|purse|clutch|handbag|messenger|crossbody/i.test(cat || "");
}

// ── GLOBAL MANNEQUIN VISUAL LOCK ────────────────────────────────────────────
// HARD RULE: every FIT image is a faceless mannequin. No real humans. No
// editorial / lifestyle / influencer photography. Same visual system across
// all sizes — only the garment changes.
const MANNEQUIN_STYLE_LOCK =
  "VISUAL MODEL TYPE LOCK (HARD RULE — HIGHEST PRIORITY): The subject MUST be a faceless display MANNEQUIN — a smooth matte fiberglass / plastic store-display dummy, NOT a real human. NO real person, NO human face, NO human identity, NO realistic facial features (no eyes, nose, mouth, eyebrows, ears), NO hair, NO skin pores or skin micro-detail, NO makeup, NO expression, NO lifestyle photography, NO streetwear photo, NO influencer pose, NO editorial fashion shot, NO posed model. The mannequin has a smooth featureless head OR the frame is cropped from the neck down. Body surface is uniform matte mannequin material — clearly artificial, clearly a display dummy. Studio fit-visualization aesthetic only.";

const MANNEQUIN_NEGATIVES =
  "STRICT NEGATIVES — NEVER GENERATE: real person, human model, model face, realistic skin, hair, lifestyle photo, streetwear photography, influencer style, posed fashion shot, magazine editorial, candid snapshot, mixed half-human half-mannequin hybrid, broken or duplicated body parts, floating garment pieces, torn seams.";

function buildCleanStudioPrompt(body: CreateBody): string {
  const subject = describeSubject(body.bodyProfileSummary);
  const build = describeBuild(body.bodyProfileSummary);
  const h = body.bodyProfileSummary?.heightCm;
  const w = body.bodyProfileSummary?.weightKg;
  const heightLine = h ? `, approximately ${h} cm tall` : "";
  const weightLine = w ? ` and approximately ${w} kg equivalent body mass` : "";
  const bmi = h && w ? Math.round((w / Math.pow(h / 100, 2)) * 10) / 10 : null;
  const garmentLabel = body.productName?.trim() || body.productCategory || "the garment";
  const silhouette = sizeSilhouette(body.selectedSize);
  const regions = regionPhrase(body.regions);
  const isBag = isBagCategory(body.productCategory);

  const verdict = body.baselineVerdict;
  const consequenceLine = verdict?.consequence
    ? `PHYSICAL CONSEQUENCE OF THIS SIZE ON THIS BODY (NON-NEGOTIABLE): ${verdict.consequence}. This is the ONLY acceptable way the garment can render — do not normalize, do not flatter, do not make a wrong size look correct.`
    : "";
  const fallbackLine = verdict?.fallbackMode
    ? "Brand size chart unavailable — using gender+weight baseline. Fit must reflect the calculated baseline verdict, not a generic regular fit."
    : "";

  // Mannequin proportions still mirror the user's height + weight so a 100kg
  // body reads as a 100kg mannequin, not a slim default dummy.
  const physicalSpec = h && w
    ? `MANNEQUIN PROPORTIONS (NON-NEGOTIABLE): the mannequin is sculpted to approximately ${h} cm tall with body volume equivalent to a ${w} kg human (BMI ${bmi}). Torso width, waist circumference, arm and leg thickness, and overall mannequin volume MUST match this mass. Heavier weight → wider torso, fuller waist, thicker limbs on the mannequin. Lower weight → slimmer mannequin. Proportions extend monotonically beyond typical ranges — DO NOT clamp or normalize extreme weights to a default mannequin.`
    : `Use average mannequin proportions.`;

  const genderLockLine = subject === "neutral mannequin"
    ? `Render a gender-neutral mannequin shape — do NOT infer gender from the garment.`
    : `MANNEQUIN GENDER LOCK (HIGHEST PRIORITY): the mannequin is a ${subject}. Based ONLY on the user's saved BODY tab profile, NEVER on the garment. ${subject === "female mannequin" ? "Narrower shoulders, defined waist, female hip curve, female chest contour — sculpted into the mannequin form." : "Broader shoulders, flatter chest, straighter waist, male shoulder line — sculpted into the mannequin form."}. If the garment is typically worn by another gender, the mannequin STILL stays a ${subject} wearing that garment. Cross-gender wear is allowed; gender swap of the mannequin body is FORBIDDEN.`;

  const safeModeSuffixEarly = body.safeMode
    ? " SAFE RENDER MODE (RETRY): previous attempt produced a malformed or off-style image. Render with EXTRA stability — clean faceless mannequin, full body cleanly framed neck-down, garment fully visible with no clipping at sleeves, hem, shoulders, or sides; sharp clean edges, no torn or melted regions, no floating fabric, no duplicated limbs, no blurred or low-resolution areas. High-resolution sharp final image. Prefer simplicity and structural integrity over stylistic flourishes."
    : "";

  if (isBag) {
    const bagScale = consequenceLine
      ? `Scale the bag relative to the mannequin so the consequence above is visible: ${verdict?.consequence ?? ""}.`
      : `Scale the bag naturally to the mannequin — small mannequin makes a large bag look oversized; large mannequin makes a small bag look dwarfed.`;
    return [
      `A clean studio fit-visualization render of a ${build} ${subject}${heightLine}${weightLine}, holding or wearing ${garmentLabel}.`,
      MANNEQUIN_STYLE_LOCK,
      genderLockLine,
      physicalSpec,
      `LOCKED MANNEQUIN BODY: torso width, waist, hips, arm and leg thickness, posture, and overall silhouette MUST stay IDENTICAL across every size variation — only the BAG/ACCESSORY changes between sizes.`,
      bagScale,
      consequenceLine,
      fallbackLine,
      `Bag rendering: preserve the EXACT shape, color, hardware, and material of the reference product. Show on the mannequin's shoulder, crossbody, or held in a sculpted mannequin hand naturally.`,
      `Background: plain seamless white or light-gray studio backdrop, soft even studio lighting, subtle grounding shadow only — NO harsh shadows cutting the body.`,
      MANNEQUIN_NEGATIVES,
      `Strictly NO bathroom, NO mirror, NO room interior, NO household objects, NO selfie framing, NO duplicate limbs, NO text, NO watermark, NO logos other than those on the product.`,
      safeModeSuffixEarly,
    ].filter(Boolean).join(" ");
  }

  return [
    `A clean studio fit-visualization render of a ${build} ${subject}${heightLine}${weightLine}, wearing ${garmentLabel} in size ${body.selectedSize}.`,
    MANNEQUIN_STYLE_LOCK,
    genderLockLine,
    physicalSpec,
    `LOCKED MANNEQUIN BODY: torso width, waist, hips, arm and leg thickness, posture, and overall silhouette MUST stay IDENTICAL across every size variation of this same mannequin — only the GARMENT changes between sizes, the mannequin NEVER changes. Do NOT slim, enlarge, restyle, or adjust the mannequin in any way based on the garment size.`,
    `Mannequin proportions must match the height and weight specified — do NOT default to a slim display dummy, but also do NOT modify the mannequin to compensate for a tighter or looser garment.`,
    `Preserve the EXACT style, color, print, and construction of the garment shown in the reference image.`,
    `Render the garment with a ${silhouette}.`,
    consequenceLine,
    fallbackLine,
    `Translate fit purely into FABRIC BEHAVIOR on the unchanged mannequin: tight (S) = visible tension lines, stretched fabric, pulled seams, minimal ease; fitted (M) = clean follow of the form with natural ease; regular (L) = visible chest/waist room, soft drape, slightly longer hem; oversized (XL/XXL) = exaggerated dropped shoulders past the natural shoulder line, sleeves extending past the mannequin hands, hem extended well past the hip, deep folds. Differences MUST be visible at chest, shoulders, waist, sleeve width, and garment length.`,
    regions,
    `Pose: neutral front-facing standing mannequin pose, arms relaxed straight at the sides or in a static display position. NOT a fashion-model pose, NOT lifestyle, NOT candid. Focus is silhouette and garment fit only.`,
    `Framing: neck-down crop OR smooth featureless mannequin head. NEVER a real face.`,
    `Background: plain seamless white or light-gray studio backdrop, soft even studio lighting, subtle grounding shadow only — NO harsh shadows cutting the body.`,
    MANNEQUIN_NEGATIVES,
    `Strictly NO bathroom, NO mirror, NO room interior, NO sink, NO household objects, NO handheld props, NO bag (unless the garment IS a bag), NO phone, NO selfie framing, NO original photo background, NO copy-paste overlay artifacts, NO floating clothes, NO duplicate limbs, NO text, NO watermark, NO logos other than those on the garment, NO visible face, NO facial features, NO identity, NO real person.`,
    `Output must look like a CONSISTENT MANNEQUIN SYSTEM render — same mannequin base across all sizes, only the garment fit and fabric behavior changes. Model-type consistency (faceless mannequin) is more important than photographic realism.`,
    safeModeSuffixEarly,
  ].filter(Boolean).join(" ");
}

// ─── REPLICATE IDM-VTON CALL ────────────────────────────────────────────────
type GenResult =
  | { kind: "success"; imageUrl: string }
  | { kind: "throttled"; error: string; retryAfterMs: number }
  | { kind: "credits_exhausted"; error: string }
  | { kind: "error"; code: FailureCode; error: string };

function buildGarmentDescription(body: CreateBody): string {
  const label = body.productName?.trim() || body.productCategory || "garment";
  return `${label} in size ${body.selectedSize}`;
}

function inferCategory(body: CreateBody): "upper_body" | "lower_body" | "dresses" {
  const c = (body.productCategory || "").toLowerCase();
  if (/(pant|trouser|jean|short|skirt|legging)/.test(c)) return "lower_body";
  if (/(dress|gown|jumpsuit)/.test(c)) return "dresses";
  return "upper_body";
}

async function generateCleanFitImage(apiKey: string, body: CreateBody): Promise<GenResult> {
  if (!body.userImageUrl) {
    return { kind: "error", code: "missing_output", error: "user_body_image_required_for_tryon" };
  }

  logRouter("REPLICATE_START", {
    productKey: body.productKey,
    size: body.selectedSize,
    model: MODEL_ID,
    category: inferCategory(body),
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SERVER_TIMEOUT_MS);

  try {
    // 1) Create prediction
    const createRes = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Token ${apiKey}`,
        "Content-Type": "application/json",
        Prefer: "wait=5",
      },
      body: JSON.stringify({
        version: MODEL_VERSION,
        input: {
          human_img: body.userImageUrl,
          garm_img: body.productImageUrl,
          garment_des: buildGarmentDescription(body),
          category: inferCategory(body),
          crop: false,
          seed: 42,
          steps: 30,
        },
      }),
    });

    if (createRes.status === 429) {
      const txt = await createRes.text().catch(() => "");
      return { kind: "throttled", error: txt.slice(0, 220) || "rate_limited", retryAfterMs: 8_000 };
    }
    if (createRes.status === 402) {
      const txt = await createRes.text().catch(() => "");
      return { kind: "credits_exhausted", error: txt.slice(0, 220) || "Replicate credits exhausted" };
    }
    if (!createRes.ok) {
      const txt = await createRes.text().catch(() => "");
      return { kind: "error", code: "provider_error", error: `replicate ${createRes.status}: ${txt.slice(0, 200)}` };
    }

    let prediction = await createRes.json().catch(() => ({} as any));
    const predId: string | undefined = prediction?.id;

    // 2) Poll until terminal state or timeout
    const deadline = Date.now() + SERVER_TIMEOUT_MS - 2000;
    while (
      prediction &&
      prediction.status !== "succeeded" &&
      prediction.status !== "failed" &&
      prediction.status !== "canceled" &&
      Date.now() < deadline
    ) {
      await new Promise((r) => setTimeout(r, REPLICATE_POLL_INTERVAL_MS));
      const pollRes = await fetch(`https://api.replicate.com/v1/predictions/${predId}`, {
        headers: { Authorization: `Token ${apiKey}` },
        signal: controller.signal,
      });
      if (!pollRes.ok) {
        const txt = await pollRes.text().catch(() => "");
        return { kind: "error", code: "provider_error", error: `replicate poll ${pollRes.status}: ${txt.slice(0, 160)}` };
      }
      prediction = await pollRes.json().catch(() => ({}));
    }

    if (prediction?.status === "succeeded") {
      const out = prediction.output;
      const url = Array.isArray(out) ? out[0] : typeof out === "string" ? out : null;
      if (!url) return { kind: "error", code: "missing_output", error: "no_image_in_response" };
      return { kind: "success", imageUrl: url };
    }

    if (prediction?.status === "failed" || prediction?.status === "canceled") {
      return { kind: "error", code: "generation_failed", error: prediction?.error || "replicate_failed" };
    }

    return { kind: "error", code: "timeout", error: "replicate_timeout" };
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      return { kind: "error", code: "timeout", error: "replicate_timeout" };
    }
    return { kind: "error", code: "provider_error", error: e instanceof Error ? e.message : "replicate_failed" };
  } finally {
    clearTimeout(timer);
  }
}

// ─── LOVABLE AI STUDIO (NANO BANANA — image-conditioned) ────────────────────
// Default FIT mode. Uses Gemini 2.5 Flash Image (Nano Banana) via the Lovable
// AI Gateway. The PRODUCT IMAGE is passed as visual reference so the generated
// model wears the EXACT same garment — same color, same print, same design.
async function generateStudioFitImage(_replicateKey: string, body: CreateBody): Promise<GenResult> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    return { kind: "error", code: "provider_error", error: "LOVABLE_API_KEY missing" };
  }

  logRouter("LOVABLE_STUDIO_START", {
    productKey: body.productKey,
    size: body.selectedSize,
    model: "google/gemini-2.5-flash-image",
  });

  const prompt = [
    buildCleanStudioPrompt(body),
    "CRITICAL GARMENT FIDELITY: The garment in the generated image MUST match the reference product image EXACTLY — same color, same print/graphic, same pattern, same fabric texture, same neckline, same sleeve style, same construction details, same trims. Do not restyle, recolor, redesign, or substitute the garment. Treat the reference product image as the ground truth for the garment's appearance; only the body wearing it and the studio setting are newly generated.",
  ].join(" ");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SERVER_TIMEOUT_MS);

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: body.productImageUrl } },
            ],
          },
        ],
        modalities: ["image", "text"],
      }),
    });

    if (res.status === 429) {
      const txt = await res.text().catch(() => "");
      return { kind: "throttled", error: txt.slice(0, 220) || "rate_limited", retryAfterMs: 8_000 };
    }
    if (res.status === 402) {
      const txt = await res.text().catch(() => "");
      return { kind: "credits_exhausted", error: txt.slice(0, 220) || "Lovable AI credits exhausted" };
    }
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return { kind: "error", code: "provider_error", error: `lovable-ai ${res.status}: ${txt.slice(0, 200)}` };
    }

    const data = await res.json().catch(() => ({} as any));
    const url: string | undefined = data?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!url) {
      return { kind: "error", code: "missing_output", error: "no_image_in_response" };
    }
    return { kind: "success", imageUrl: url };
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      return { kind: "error", code: "timeout", error: "lovable_ai_timeout" };
    }
    return { kind: "error", code: "provider_error", error: e instanceof Error ? e.message : "lovable_ai_failed" };
  } finally {
    clearTimeout(timer);
  }
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
      provider: "replicate",
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
    ok: true, imageUrl, provider: "replicate",
    selectedSize: row.selected_size, status: "succeeded",
    predictionId: null, requestId: row.id,
  };
}

// ─── PERSIST GENERATED IMAGE TO STORAGE ─────────────────────────────────────
// Replicate output URLs expire. Copy the asset into our public `fit-composites`
// bucket so the saved try-on stays valid long-term.
async function persistImageToStorage(
  admin: ReturnType<typeof createClient>,
  sourceUrl: string,
  userId: string | null,
  productKey: string,
  selectedSize: string,
): Promise<string> {
  try {
    const res = await fetch(sourceUrl);
    if (!res.ok) {
      logRouter("PERSIST_FETCH_FAILED", { status: res.status, sourceUrl: sourceUrl.slice(0, 80) });
      return sourceUrl;
    }
    const contentType = res.headers.get("content-type") || "image/png";
    const ext = contentType.includes("webp") ? "webp" : contentType.includes("jpeg") || contentType.includes("jpg") ? "jpg" : "png";
    const bytes = new Uint8Array(await res.arrayBuffer());
    const safeKey = productKey.replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 80);
    const safeSize = selectedSize.replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 16);
    const folder = userId || "anon";
    const path = `${folder}/${safeKey}_${safeSize}_${Date.now()}.${ext}`;
    const { error } = await admin.storage.from("fit-composites").upload(path, bytes, {
      contentType, upsert: true, cacheControl: "31536000",
    });
    if (error) {
      logRouter("PERSIST_UPLOAD_FAILED", { error: error.message });
      return sourceUrl;
    }
    const { data: pub } = admin.storage.from("fit-composites").getPublicUrl(path);
    logRouter("PERSIST_OK", { path });
    return pub?.publicUrl || sourceUrl;
  } catch (e) {
    logRouter("PERSIST_EXCEPTION", { error: e instanceof Error ? e.message : String(e) });
    return sourceUrl;
  }
}

// ─── MAIN ENTRYPOINTS ───────────────────────────────────────────────────────
async function handleCreate(admin: ReturnType<typeof createClient>, apiKey: string, userId: string | null, body: CreateBody): Promise<TryOnResponse> {
  const mode: "studio" | "vton" = body.mode === "vton" ? "vton" : "studio";
  const generatorTag = mode === "vton" ? "replicate-idm-vton" : "lovable-ai-nano-banana";
  const modelIdForRecord = mode === "vton" ? VTON_MODEL_ID : "google/gemini-2.5-flash-image";

  // Cache key includes mode so studio + vton results don't clobber each other.
  const cacheKey = `${body.productKey}::${mode}`;
  const existing = userId ? await getTryOnByIdentity(admin, userId, { ...body, productKey: cacheKey }) : null;

  if (existing && !body.forceRegenerate && existing.status === "succeeded" && existing.result_image_url) {
    logRouter("CACHE_HIT", { id: existing.id, mode });
    return toSuccess(existing, existing.result_image_url);
  }

  const record = userId
    ? await upsertTryOnRecord(admin, userId, { ...body, productKey: cacheKey }, {
        status: "processing",
        prediction_id: null,
        result_image_url: null,
        error_message: null,
        model_id: modelIdForRecord,
        metadata: { generator: generatorTag, mode, retryAfterUntil: null },
      })
    : null;

  const result = mode === "vton"
    ? await generateCleanFitImage(apiKey, body)
    : await generateStudioFitImage(apiKey, body);

  if (result.kind === "success") {
    // Persist immediately so the UI never depends on Replicate's expiring URL.
    const persistedUrl = await persistImageToStorage(admin, result.imageUrl, userId, body.productKey, body.selectedSize);
    if (record) {
      await updateTryOnRecord(admin, record.id, {
        status: "succeeded",
        result_image_url: persistedUrl,
        error_message: null,
        metadata: { ...(record.metadata || {}), retryAfterUntil: null, sourceUrl: result.imageUrl },
      });
      return toSuccess(record, persistedUrl);
    }
    return { ok: true, imageUrl: persistedUrl, provider: "replicate", selectedSize: body.selectedSize, status: "succeeded", requestId: null, predictionId: null };
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
    if (!REPLICATE_API_TOKEN) {
      return json(failure("provider_error", "REPLICATE_API_TOKEN missing"), 500);
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
    // NOTE: rate_limited & pending return 200 so the client SDK can read the
    // body (supabase.functions.invoke discards bodies on non-2xx, which causes
    // a RUNTIME_ERROR / blank screen). The body carries status="throttled"
    // and retryAfterMs so the frontend can fall back gracefully.
    const statusCode = response.ok ? 200 : response.code === "credits_exhausted" ? 200 : response.code === "rate_limited" ? 200 : response.code === "pending" ? 200 : 500;
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

    const response = await handleCreate(admin, REPLICATE_API_TOKEN, userId, createBody);
    logRouter("RESPONSE_OUT", { code: response.ok ? "ok" : response.code, requestId: response.requestId, elapsedMs: Date.now() - requestStartedAt });

    const statusCode = response.ok ? 200 : response.code === "credits_exhausted" ? 200 : response.code === "rate_limited" ? 200 : response.code === "pending" ? 200 : response.code === "missing_output" ? 422 : response.code === "timeout" ? 504 : 500;
    return json(response, statusCode);
  } catch (error) {
    const out = failure("provider_error", error instanceof Error ? error.message : "Unknown error");
    logRouter("CRASH", { error: out.error, elapsedMs: Date.now() - requestStartedAt });
    return json(out, 500);
  }
});
