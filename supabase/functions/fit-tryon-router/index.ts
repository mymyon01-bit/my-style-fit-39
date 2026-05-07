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

import { createClient } from "npm:@supabase/supabase-js@2.45.0";

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
const STUDIO_IMAGE_MODEL = Deno.env.get("FIT_STUDIO_IMAGE_MODEL") || "google/gemini-3.1-flash-image-preview";
const STUDIO_RENDER_VERSION = "mannequin-bodylock-v8";

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
    bodyType?: string | null;
    shoulderCm?: number | null;
    chestCm?: number | null;
    waistCm?: number | null;
    hipCm?: number | null;
    armLengthCm?: number | null;
    inseamCm?: number | null;
    userBodyImageUrl?: string | null;
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
  /** V3.9 — gendered sizing directive (single line) appended to the prompt. */
  genderDirective?: string;
  /** V3.9 — gendered sizing context (used by analytics/debug logging). */
  genderedSizing?: {
    targetGender?: string;
    isCrossGender?: boolean;
    sizeSystem?: string;
    confidence?: string;
  };
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
  // that garment, and vice-versa.
  //
  // FALLBACK: when the body profile is missing a gender (anonymous visitor,
  // or the user skipped the BODY tab), default to a MALE mannequin instead
  // of "neutral". A neutral subject lets the image model silently infer the
  // mannequin's sex from the garment, which produced unwanted female
  // mannequins for male users picking women's items. The male base is the
  // explicit absolute fallback per product spec.
  const g = (b?.gender || "").toLowerCase();
  if (g === "female" || g === "feminine" || g === "woman") return "female mannequin";
  return "male mannequin";
}

// V4.5 — BODY-RELATIVE silhouette. The size label means NOTHING by itself.
// The visual fit is derived from the per-region fit verdicts the client
// already computed from (garment_cm − body_cm) deltas. We collapse those
// region verdicts into a single descriptive silhouette phrase.
function silhouetteFromRegions(regions?: RegionFitLite[]): string {
  if (!regions?.length) {
    return "BALANCED silhouette: render the garment with the natural ease implied by the per-region measurement deltas — do not add tightness or looseness that the measurements do not justify";
  }
  const norm = (f: string) => (f || "").toLowerCase().replace(/_/g, "-");
  let tight = 0, loose = 0, oversized = 0, regular = 0;
  for (const r of regions) {
    const f = norm(r.fit);
    if (/(too-tight|tight|short|small)/.test(f)) tight++;
    else if (/(too-large|oversized|blanket|too-long|too-loose)/.test(f)) oversized++;
    else if (/(loose|relaxed|long|dropped)/.test(f)) loose++;
    else regular++;
  }
  if (oversized >= 2 || (oversized >= 1 && loose >= 1))
    return "OVERSIZED silhouette: dropped shoulders past the natural shoulder line, generous chest and waist volume, sleeves extending past the hands, longer hem, deep folds, blanket-like drape — only because the garment measurements are clearly larger than the body measurements in multiple regions";
  if (tight >= 2)
    return "TIGHT silhouette: fabric stretched across the body with visible horizontal tension lines, pulled seams, shorter visible coverage — only because the garment measurements are smaller than the body measurements in multiple regions";
  if (loose >= 2)
    return "RELAXED silhouette: extra room across torso and arms, soft natural folds, slightly longer hem — only because the garment measurements exceed the body measurements with comfortable ease";
  if (tight >= 1)
    return "SLIGHTLY TIGHT silhouette: mild tension where the garment is smaller than the body, otherwise clean drape";
  if (loose >= 1)
    return "SLIGHTLY RELAXED silhouette: mild extra ease where the garment exceeds the body, otherwise clean drape";
  return "FITTED silhouette: clean follow of the form with natural ease, shoulder seam on the joint, hem at the hip, no tension lines, no excess volume";
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
  "STRICT NEGATIVES — NEVER GENERATE: real person, human model, model face, realistic skin, hair, lifestyle photo, streetwear photography, influencer style, posed fashion shot, magazine editorial, candid snapshot, mixed half-human half-mannequin hybrid, broken or duplicated body parts, floating garment pieces, torn seams, NUDE mannequin, BARE torso, BARE legs, lingerie, bikini, swimsuit, lacy underwear, exposed skin areas, mannequin in only the focus garment with nothing covering the rest of the body, MALE mannequin wearing a SKIRT or DRESS as base, FEMALE mannequin in a bra of any color other than the specified solid black sports bra base layer, base layer in any color other than solid matte black.";

// ── UNIVERSAL BASE LAYER LOCK ───────────────────────────────────────────────
// HARD RULE: every mannequin wears solid MATTE BLACK athletic underlayer
// under / around the focus garment. The base layer differs by mannequin
// gender (sports bra + briefs for female; fitted boxer briefs for male;
// fitted black tank + briefs for neutral) but is ALWAYS solid black.
//   • female mannequin → solid black sports bra + solid black sports briefs
//   • male mannequin   → solid black fitted square-cut boxer briefs (with bare
//                         mannequin torso — still smooth matte mannequin
//                         material, NOT real skin)
//   • neutral mannequin → solid black fitted athletic tank + solid black briefs
// This gives every fit render an identical visual baseline so size-difference
// is the ONLY thing that changes between renders.
function buildUniversalBaseLayerLine(
  focusCategoryRaw?: string | null,
  subject?: string,
): string {
  const c = (focusCategoryRaw || "").toLowerCase();
  const isTop = /(shirt|tee|t-?shirt|top|blouse|sweater|knit|hoodie|jacket|coat|outer|blazer|cardigan|vest)/.test(c);
  const isBottom = /(pant|trouser|jean|short|skirt|legging|chino|slack|denim|cargo|joggers?)/.test(c);
  const isFullBody = /(dress|gown|jumpsuit|romper|overall|coverall)/.test(c);
  const isFootwear = /(shoe|sneaker|boot|heel|loafer|sandal|trainer)/.test(c);

  // Full-body garments cover the whole body — no base layer fights with them.
  if (isFullBody) {
    return "BASE LAYER (universal): the focus garment is full-body and covers torso + legs by itself. If any limb is exposed by the garment cut, it stays as smooth matte mannequin material, NOT skin. NEVER bare skin, NEVER lingerie.";
  }

  const isFemale = subject === "female mannequin";
  const isMale = subject === "male mannequin";

  // Per-gender SOLID BLACK athletic base layer description.
  const baseSpec = isFemale
    ? "BASE LAYER (universal, female mannequin): the mannequin ALWAYS wears a SOLID MATTE BLACK athletic SPORTS BRA (racerback or scoop-neck cut, opaque, unbranded, full chest coverage) AND SOLID MATTE BLACK athletic SPORTS BRIEFS / boyshorts (mid-rise, full hip and seat coverage, opaque, unbranded). Both pieces are plain solid pure black (#000000), matte performance fabric, generic, no logos, no patterns, no stripes."
    : isMale
    ? "BASE LAYER (universal, male mannequin): the mannequin ALWAYS wears SOLID MATTE BLACK fitted SQUARE-CUT BOXER BRIEFS (athletic compression cut, mid-thigh length, opaque, unbranded, sits on the natural waist with full hip and seat coverage). The torso remains smooth matte mannequin material (NOT real human skin). Plain solid pure black (#000000), matte performance fabric, generic, no logos, no patterns, no stripes."
    : "BASE LAYER (universal, neutral mannequin): the mannequin ALWAYS wears a SOLID MATTE BLACK fitted athletic TANK TOP (full torso coverage, opaque, unbranded) AND SOLID MATTE BLACK athletic BRIEFS (mid-rise, full hip and seat coverage, opaque, unbranded). Both pieces are plain solid pure black (#000000), matte performance fabric, generic, no logos, no patterns, no stripes.";

  const colorLock = "STRICT COLOR LOCK on base layer: solid pure black only — NEVER white, NEVER gray, NEVER skin tone, NEVER any other color. Base layer is visually subdued so it NEVER competes with the focus garment.";

  if (isBottom) {
    return `${baseSpec} ${colorLock} The focus garment is the BOTTOM and is worn OVER the black base briefs (briefs may be partially visible at the waistband or hem if the focus bottom is shorter or sheer). The mannequin is NEVER bare-legged below the briefs hem — exposed limbs stay smooth matte mannequin material.`;
  }
  if (isFootwear) {
    return `${baseSpec} ${colorLock} The focus garment is FOOTWEAR. The black athletic base layer remains fully visible on torso and hips.`;
  }
  if (isTop) {
    return `${baseSpec} ${colorLock} The focus garment is the TOP/OUTERWEAR and is worn OVER the black base layer (black base may peek out at neckline / sleeves / hem if the focus top is shorter, sheer, or open — that is fine and intended).`;
  }
  // Accessories / unknown
  return `${baseSpec} ${colorLock} The focus item is an accessory; the black athletic base layer remains fully visible on the mannequin.`;
}

// ── BODY TAB PROFILE BLOCK ──────────────────────────────────────────────────
// Dedicated block that surfaces the user's saved Body tab values verbatim
// to the image model. The mannequin must match these proportions instead of
// defaulting to a generic display dummy. Body gender is the source of truth
// for the rendered body — never inferred from the garment.
function buildBodyTabBlock(b?: CreateBody["bodyProfileSummary"]): string {
  if (!b) return "";
  const fmt = (v: number | null | undefined, unit: string) =>
    typeof v === "number" && Number.isFinite(v) ? `${v} ${unit}` : "not specified";
  const lines = [
    `- Gender: ${b.gender ?? "not specified"}`,
    `- Height: ${fmt(b.heightCm ?? null, "cm")}`,
    `- Weight: ${fmt(b.weightKg ?? null, "kg")}`,
    `- Body type: ${b.bodyType ?? b.build ?? "not specified"}`,
    `- Shoulder width: ${fmt(b.shoulderCm ?? null, "cm")}`,
    `- Chest/Bust: ${fmt(b.chestCm ?? null, "cm")}`,
    `- Waist: ${fmt(b.waistCm ?? null, "cm")}`,
    `- Hips: ${fmt(b.hipCm ?? null, "cm")}`,
    `- Arm length: ${fmt(b.armLengthCm ?? null, "cm")}`,
    `- Inseam / leg length: ${fmt(b.inseamCm ?? null, "cm")}`,
  ].join("\n");
  const refImageNote = b.userBodyImageUrl
    ? "USER BODY REFERENCE IMAGE PROVIDED: use the uploaded reference only for body proportions, posture, silhouette, and scale. Do NOT copy face identity. Crop or hide the face. Keep the final image clean and fashion-studio-like."
    : "No body reference image provided — use the numeric values above as the source of truth for the mannequin proportions.";
  return [
    "USER BODY PROFILE (from the Body tab — source of truth for the rendered body):",
    lines,
    "Generate the mannequin/body using these proportions. Do NOT create an ideal fashion model. Do NOT slim down, stretch, feminize, masculinize, or beautify the body. Match the saved body profile as closely as possible. Body gender comes ONLY from this profile — if the garment is for the opposite gender, still render this body wearing that garment (cross-gender wear is allowed; gender swap of the body is FORBIDDEN).",
    refImageNote,
  ].join(" ");
}

// ── BODY MASS CLASSIFICATION + USER BODY LOCK (spec patch) ──────────────────
// Per FIT IMAGE GENERATION PATCH — height/weight body proportion lock.
// The Body tab is the ONLY source of truth for the rendered body.
function classifyBodyMass(bmi: number): string {
  if (!Number.isFinite(bmi)) return "normal body";
  if (bmi < 18.5) return "very slim / underweight body";
  if (bmi < 22.5) return "slim to normal body";
  if (bmi < 25) return "normal body";
  if (bmi < 28) return "slightly overweight body";
  if (bmi < 32) return "overweight body with visible body mass";
  return "large heavy body with clear volume";
}

function buildBodyProportionPrompt(b?: CreateBody["bodyProfileSummary"]): string {
  if (!b?.heightCm || !b?.weightKg) return "";
  const heightM = b.heightCm / 100;
  const bmi = b.weightKg / (heightM * heightM);
  const massClass = classifyBodyMass(bmi);
  const gender = b.gender || "not specified";
  return [
    "USER BODY LOCK (NON-NEGOTIABLE — overrides any default fashion-model proportions):",
    `- Gender: ${gender}`,
    `- Height: ${b.heightCm} cm`,
    `- Weight: ${b.weightKg} kg`,
    `- BMI: ${bmi.toFixed(1)}`,
    `- Body mass class: ${massClass}`,
    "Generate the body using realistic proportions for this exact height and weight.",
    "Do not create a generic fashion model.",
    "Do not slim down the body.",
    "Do not beautify, stretch, lengthen legs, narrow waist, reduce belly, reduce thighs, or reduce shoulders.",
    "Do not normalize the body toward an average mannequin.",
    "The generated body must visually communicate:",
    `- the real mass implied by ${b.weightKg} kg`,
    `- the real vertical scale implied by ${b.heightCm} cm`,
    "- realistic torso width",
    "- realistic shoulder width",
    "- realistic waist and hip volume",
    "- realistic arm and thigh thickness",
    "- realistic neck-to-leg proportions",
    "If the user is heavy for their height, show visible body volume.",
    "If the user is slim for their height, show a naturally slim frame.",
    "If the user is tall and light, show a long but thin body.",
    "If the user is short and heavy, show a compact body with more volume.",
  ].join(" ");
}

function buildBodyTypeModifier(b?: CreateBody["bodyProfileSummary"]): string {
  const bt = b?.bodyType || b?.build || null;
  return [
    "Body type modifier:",
    bt ? bt : "not specified",
    "Use this only to refine the height/weight-based body.",
    "Do not ignore height and weight. Height and weight are more important than body type.",
  ].join(" ");
}

function buildFitVisualPrompt(body: CreateBody): string {
  const sel = body.selectedSize;
  const regions = (body.regions || []).filter((r) => r?.region && r?.fit);
  const findFit = (key: RegExp) => regions.find((r) => key.test(r.region))?.fit || "regular";
  const chest = findFit(/chest|bust/i);
  const waist = findFit(/waist/i);
  const shoulder = findFit(/shoulder/i);
  const length = findFit(/length|hem|inseam/i);
  return [
    "CALCULATED CLOTHING FIT (visualize on top of the LOCKED user body — never resize the body):",
    `- Selected size: ${sel}`,
    `- Chest fit: ${chest}`,
    `- Waist fit: ${waist}`,
    `- Shoulder fit: ${shoulder}`,
    `- Length fit: ${length}`,
    "If tight: show fabric tension; show pulling around chest, waist, shoulder, arms, or hips; show shorter-looking garment coverage if the body volume stretches the garment.",
    "If loose: show extra fabric volume; show relaxed drape; show dropped shoulder when applicable.",
    "If oversized: show visibly oversized silhouette; show larger garment volume over the same locked body.",
    "The body must NOT shrink or expand to fit the clothes. Only the clothing changes around the fixed body.",
  ].join(" ");
}

// Spec-mandated extra negative rules layered ON TOP of MANNEQUIN_NEGATIVES.
const SPEC_NEGATIVE_BODY_RULES = [
  "NEGATIVE BODY RULES (HARD):",
  "Do not generate a model-like body unless the Body tab values actually imply it.",
  "Do not generate a slim mannequin when BMI is high.",
  "Do not generate a muscular/athletic body unless body_type explicitly says athletic.",
  "Do not generate a tall body when height_cm is short.",
  "Do not generate a short body when height_cm is tall.",
  "Do not use default runway proportions.",
  "Do not use anime, doll, avatar, or idealized body proportions.",
  "Do not make the waist artificially small.",
  "Do not make legs artificially long.",
  "Do not hide body mass under perfect clothing drape.",
  "Do not change the user's body gender.",
  "Do not change the user's body size.",
  "Do not make the body slimmer to make the garment look better.",
  "Do not resize the body to match the selected clothing size.",
  "Do not hide tightness. Do not hide looseness.",
].join(" ");

function buildCleanStudioPrompt(body: CreateBody): string {
  const subject = describeSubject(body.bodyProfileSummary);
  const build = describeBuild(body.bodyProfileSummary);
  const h = body.bodyProfileSummary?.heightCm;
  const w = body.bodyProfileSummary?.weightKg;
  const heightLine = h ? `, approximately ${h} cm tall` : "";
  const weightLine = w ? ` and approximately ${w} kg equivalent body mass` : "";
  const bmi = h && w ? Math.round((w / Math.pow(h / 100, 2)) * 10) / 10 : null;
  const garmentLabel = body.productName?.trim() || body.productCategory || "the garment";
  const silhouette = silhouetteFromRegions(body.regions);
  const regions = regionPhrase(body.regions);
  const isBag = isBagCategory(body.productCategory);
  const baseLayerLine = buildUniversalBaseLayerLine(body.productCategory, subject);
  const bodyTabBlock = buildBodyTabBlock(body.bodyProfileSummary);
  const bodyProportionPrompt = buildBodyProportionPrompt(body.bodyProfileSummary);
  const bodyTypePrompt = buildBodyTypeModifier(body.bodyProfileSummary);
  const fitVisualPrompt = buildFitVisualPrompt(body);

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
    ? " SAFE RENDER MODE (RETRY): previous render failed quality control because the BODY changed or the image was malformed. Preserve EXACT body silhouette, pose, crop, scale, and proportions from the reference body — do NOT alter waist, hips, legs, shoulders, torso, or posture. Render with EXTRA stability — clean faceless mannequin, full body cleanly framed neck-down, garment fully visible with no clipping at sleeves, hem, shoulders, or sides; sharp clean edges, no torn or melted regions, no floating fabric, no duplicated limbs, no blurred or low-resolution areas. High-resolution sharp final image. Prefer simplicity and structural integrity over stylistic flourishes."
    : "";

  if (isBag) {
    const bagScale = consequenceLine
      ? `Scale the bag relative to the mannequin so the consequence above is visible: ${verdict?.consequence ?? ""}.`
      : `Scale the bag naturally to the mannequin — small mannequin makes a large bag look oversized; large mannequin makes a small bag look dwarfed.`;
    return [
      `A clean studio fit-visualization render of a ${build} ${subject}${heightLine}${weightLine}, holding or wearing ${garmentLabel}.`,
      bodyTabBlock,
      bodyProportionPrompt,
      bodyTypePrompt,
      MANNEQUIN_STYLE_LOCK,
      genderLockLine,
      physicalSpec,
      baseLayerLine,
      `LOCKED MANNEQUIN BODY: torso width, waist, hips, arm and leg thickness, posture, and overall silhouette MUST stay IDENTICAL across every size variation — only the BAG/ACCESSORY changes between sizes.`,
      bagScale,
      consequenceLine,
      fallbackLine,
      `Bag rendering: preserve the EXACT shape, color, hardware, and material of the reference product. Show on the mannequin's shoulder, crossbody, or held in a sculpted mannequin hand naturally.`,
      `FRAMING: full-body shot with at least 10–14% empty headroom above the top of the head and 5–8% space below the feet. NEVER crop the head, top of skull, hands, or feet. The mannequin head must be ENTIRELY inside the frame.`,
      `Background: plain seamless white or light-gray studio backdrop, soft even studio lighting, subtle grounding shadow only — NO harsh shadows cutting the body.`,
      MANNEQUIN_NEGATIVES,
      SPEC_NEGATIVE_BODY_RULES,
      `Strictly NO bathroom, NO mirror, NO room interior, NO household objects, NO selfie framing, NO duplicate limbs, NO text, NO watermark, NO logos other than those on the product.`,
      safeModeSuffixEarly,
    ].filter(Boolean).join(" ");
  }

  // ── LEAD SENTENCE (per FIT spec §7) — front-loads the most important
  // signals: GENDER → HEIGHT/WEIGHT → BUILD → SIZE → REGION FIT — so the
  // image generator weighs them first.
  const leadFitSummary = body.regions?.length
    ? body.regions
        .filter((r) => r?.region && r?.fit && !/^regular$/i.test(r.fit))
        .slice(0, 4)
        .map((r) => `${r.fit.replace(/-/g, " ")} at ${r.region.toLowerCase()}`)
        .join(", ")
    : "";
  const leadSentence = `A ${build} ${subject}${heightLine}${weightLine} wearing ${garmentLabel} in size ${body.selectedSize}${leadFitSummary ? `, with ${leadFitSummary}` : ""}. The mannequin's sex is ${subject} regardless of which gender the garment was originally designed for.`;

  return [
    leadSentence,
    bodyTabBlock,
    bodyProportionPrompt,
    bodyTypePrompt,
    `A clean studio fit-visualization render of a ${build} ${subject}${heightLine}${weightLine}, wearing ${garmentLabel} in size ${body.selectedSize}.`,
    MANNEQUIN_STYLE_LOCK,
    genderLockLine,
    physicalSpec,
    baseLayerLine,
    `LOCKED MANNEQUIN BODY: torso width, waist, hips, arm and leg thickness, posture, and overall silhouette MUST stay IDENTICAL across every size variation of this same mannequin — only the GARMENT changes between sizes, the mannequin NEVER changes. Do NOT slim, enlarge, restyle, or adjust the mannequin in any way based on the garment size.`,
    `LOCKED CAMERA + POSE (CONSISTENCY SYSTEM): same front-facing camera angle at chest height, same focal length, same framing, same standing posture across all size variations — straight standing, feet shoulder-width apart, arms slightly away from the body in a neutral display pose (NOT against the hips, NOT crossed, NOT a fashion pose). Only the garment fit and fabric behavior change between S/M/L/XL — the mannequin, camera, lighting, and pose stay identical.`,
    `Mannequin proportions must match the height and weight specified — do NOT default to a slim display dummy, but also do NOT modify the mannequin to compensate for a tighter or looser garment.`,
    `Preserve the EXACT style, color, print, and construction of the garment shown in the reference image.`,
    `Render the garment with a ${silhouette}.`,
    fitVisualPrompt,
    consequenceLine,
    fallbackLine,
    `BODY-RELATIVE FIT RULE (V4.5 — MANDATORY): the size label "${body.selectedSize}" by itself means NOTHING. Whether this garment looks tight, regular, relaxed, or oversized depends ONLY on the relationship between the garment measurements and this user's body measurements (the per-region directives above). A small body in a "small" size may render REGULAR. A large body in a "large" size may still render TIGHT. A slim body in an "XL" oversized cut renders OVERSIZED. Visualize the silhouette implied by the per-region measurement deltas, NOT by the size letter.`,
    `Garment behavior: garment must wrap correctly around the mannequin, respect gravity and drape, no floating clothing, no broken sleeves, no missing parts, no torn seams. Hoodies/jackets show outer-layer volume, pants show waist/thigh/length changes, tops emphasize chest and shoulders.`,
    regions,
    `Pose: neutral front-facing standing mannequin pose, arms slightly away from the sides in a static display position. NOT a fashion-model pose, NOT lifestyle, NOT candid. Focus is silhouette and garment fit only.`,
    `FRAMING + COMPOSITION (HARD RULE — HIGHEST PRIORITY): Render a COMPLETE FULL-BODY shot. The ENTIRE mannequin must fit inside the frame from the TOP OF THE HEAD down to BELOW THE FEET, with clear empty studio space (HEADROOM) of at least 10–14% of the image height ABOVE the top of the head, and at least 5–8% below the feet. NEVER crop, cut, chop, slice, or clip the head, top of skull, neck, shoulders, hands, fingers, hips, knees, ankles, or feet. The top of the mannequin's head MUST be clearly visible with breathing room above it — it MUST NOT touch or exceed the top edge of the frame. Camera is centered at chest height, slightly pulled back so the full standing figure is visible. The smooth featureless mannequin head must be ENTIRELY inside the frame; a half-cropped or partially-decapitated head is FORBIDDEN. Alternative neck-down crop is acceptable ONLY if cleanly cut at the lower neck — never mid-head, never mid-skull.`,
    `Background: plain seamless white or light-gray studio backdrop, soft even studio lighting, subtle grounding shadow only — NO harsh shadows cutting the body, NO environment, NO lifestyle context.`,
    MANNEQUIN_NEGATIVES,
    SPEC_NEGATIVE_BODY_RULES,
    `Strictly NO cropped head, NO chopped head, NO half-head, NO decapitated mannequin, NO head touching the top edge, NO bathroom, NO mirror, NO room interior, NO sink, NO household objects, NO handheld props, NO bag (unless the garment IS a bag), NO phone, NO selfie framing, NO original photo background, NO copy-paste overlay artifacts, NO floating clothes, NO duplicate limbs, NO text, NO watermark, NO logos other than those on the garment, NO visible face, NO facial features, NO identity, NO real person.`,
    `Output must look like a CONSISTENT MANNEQUIN SYSTEM render — same mannequin base, same camera, same pose, same lighting across all sizes; only the garment fit and fabric behavior change. Visual clarity of the size difference is more important than photographic realism. Model-type consistency (faceless mannequin) is mandatory.`,
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
async function runStudioRenderAttempt(apiKey: string, body: CreateBody, modelOverride?: string): Promise<GenResult> {
  const LOVABLE_API_KEY = apiKey || Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    return { kind: "error", code: "provider_error", error: "LOVABLE_API_KEY missing" };
  }
  const model = modelOverride || STUDIO_IMAGE_MODEL;

  logRouter("LOVABLE_STUDIO_START", {
    productKey: body.productKey,
    size: body.selectedSize,
    model,
    safeMode: !!body.safeMode,
  });

  const userBodyRef = body.bodyProfileSummary?.userBodyImageUrl || body.userImageUrl || null;
  const bodyRefLine = userBodyRef
    ? "SECOND REFERENCE IMAGE = the user's actual body photo. Use it to LOCK the mannequin's body proportions (height, weight, shoulder width, torso, waist, hips, arms, legs) so the mannequin matches the real user. Convert the person to a faceless smooth mannequin (NO face, NO skin texture, NO identity), but PRESERVE the exact body silhouette, mass and proportions. The body MUST stay identical across every size — only the garment changes."
    : "";

  const genderDirectiveLine = body.genderDirective
    ? `GENDERED SIZING CONTEXT — ${body.genderDirective} The body silhouette MUST stay locked to the user's body DNA; only garment behavior changes.`
    : "";

  const prompt = [
    `FIT RENDER SYSTEM VERSION: ${STUDIO_RENDER_VERSION}.`,
    buildCleanStudioPrompt(body),
    bodyRefLine,
    genderDirectiveLine,
    "CRITICAL GARMENT FIDELITY: The garment in the generated image MUST match the FIRST reference image (the product) EXACTLY — same color, same print/graphic, same pattern, same fabric texture, same neckline, same sleeve style, same construction details, same trims. Do not restyle, recolor, redesign, or substitute the garment. Treat the first reference image as the ground truth for the garment's appearance; only the faceless mannequin wearing it and the studio setting are newly generated. The mannequin/model-type lock above always overrides any human-photo cues that might come from the reference image.",
  ].filter(Boolean).join(" ");

  // ── DEBUG: confirm Body tab values reach AI generation ──────────────────
  const dbgB = body.bodyProfileSummary;
  const dbgBmi = dbgB?.heightCm && dbgB?.weightKg
    ? dbgB.weightKg / Math.pow(dbgB.heightCm / 100, 2)
    : null;
  console.log("[BODY_TAB_RAW]", body.bodyProfileSummary);
  console.log("[FIT_IMAGE_BODY_LOCK]", {
    gender: dbgB?.gender ?? null,
    height_cm: dbgB?.heightCm ?? null,
    weight_kg: dbgB?.weightKg ?? null,
    body_type: dbgB?.bodyType ?? dbgB?.build ?? null,
    body_reference_image_url: dbgB?.userBodyImageUrl ?? null,
  });
  console.log("[FIT_IMAGE_BMI]", dbgBmi);
  console.log("[FIT_IMAGE_BODY_MASS_CLASS]", dbgBmi != null ? classifyBodyMass(dbgBmi) : null);
  console.log("[FIT_IMAGE_SELECTED_SIZE]", body.selectedSize);
  console.log("[FIT_IMAGE_FIT_RESULT]", { regions: body.regions, baselineVerdict: body.baselineVerdict });
  console.log("[FIT_IMAGE_GENDERED_SIZING]", body.genderedSizing ?? null, body.genderDirective ?? null);
  console.log("[FIT_IMAGE_USER_BODY_REF]", userBodyRef ? userBodyRef.slice(0, 80) : null);
  console.log("[FIT_IMAGE_FINAL_PROMPT]", prompt);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SERVER_TIMEOUT_MS);

  const messageContent: Array<Record<string, unknown>> = [
    { type: "text", text: prompt },
    { type: "image_url", image_url: { url: body.productImageUrl } },
  ];
  if (userBodyRef) {
    messageContent.push({ type: "image_url", image_url: { url: userBodyRef } });
  }

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "user", content: messageContent },
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

// Fallback chain — primary model first, then more stable alternates if the
// preview model is rate-limited or out of credits. Order matters.
const STUDIO_FALLBACK_MODELS = [
  "google/gemini-2.5-flash-image",
  "google/gemini-3-flash-preview",
];

async function generateStudioFitImage(replicateKey: string, body: CreateBody): Promise<GenResult> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    return { kind: "error", code: "provider_error", error: "LOVABLE_API_KEY missing" };
  }

  // Build ordered list, dedup, primary first.
  const tried = new Set<string>();
  const chain = [STUDIO_IMAGE_MODEL, ...STUDIO_FALLBACK_MODELS].filter((m) => {
    if (tried.has(m)) return false;
    tried.add(m);
    return true;
  });

  let last: GenResult | null = null;
  for (const model of chain) {
    const result = await runStudioRenderAttempt(LOVABLE_API_KEY, body, model);
    last = result;
    // Only fall through on transient/quota issues — success or hard errors stop here.
    if (result.kind === "throttled" || result.kind === "credits_exhausted") {
      logRouter("LOVABLE_STUDIO_FALLBACK", { failedModel: model, reason: result.kind });
      continue;
    }
    return result;
  }

  // V4.5 — final fallback to Replicate IDM-VTON when ALL Lovable AI models
  // are exhausted/throttled AND we have a usable user body photo. Better a
  // VTON composite than no fit at all.
  if ((last?.kind === "credits_exhausted" || last?.kind === "throttled") && body.userImageUrl && replicateKey) {
    logRouter("REPLICATE_FALLBACK_AFTER_STUDIO", { reason: last.kind });
    const vton = await generateCleanFitImage(replicateKey, body);
    if (vton.kind === "success") return vton;
    logRouter("REPLICATE_FALLBACK_FAILED", { kind: vton.kind, error: (vton as any).error });
  }

  return last ?? { kind: "error", code: "provider_error", error: "no_studio_model_available" };
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

async function processTryOnInBackground(
  admin: ReturnType<typeof createClient>,
  apiKey: string,
  userId: string,
  body: CreateBody,
  record: TryOnRow,
  mode: "studio" | "vton",
) {
  try {
    const result = mode === "vton"
      ? await generateCleanFitImage(apiKey, body)
      : await generateStudioFitImage(apiKey, body);

    if (result.kind === "success") {
      const persistedUrl = await persistImageToStorage(admin, result.imageUrl, userId, body.productKey, body.selectedSize);
      await updateTryOnRecord(admin, record.id, {
        status: "succeeded",
        result_image_url: persistedUrl,
        error_message: null,
        metadata: {
          ...(record.metadata || {}),
          retryAfterUntil: null,
          sourceUrl: result.imageUrl,
          renderVersion: mode === "studio" ? STUDIO_RENDER_VERSION : record.metadata?.renderVersion ?? null,
        },
      });
      logRouter("ASYNC_COMPLETE", { requestId: record.id, mode });
      return;
    }

    if (result.kind === "throttled") {
      await updateTryOnRecord(admin, record.id, {
        status: "throttled",
        error_message: result.error,
        metadata: { ...(record.metadata || {}), retryAfterUntil: Date.now() + result.retryAfterMs },
      });
      logRouter("ASYNC_THROTTLED", { requestId: record.id, retryAfterMs: result.retryAfterMs, mode });
      return;
    }

    const failureMessage = result.error;
    await updateTryOnRecord(admin, record.id, {
      status: "failed",
      error_message: failureMessage,
    });
    logRouter("ASYNC_FAILED", {
      requestId: record.id,
      code: result.kind === "credits_exhausted" ? "credits_exhausted" : result.code,
      error: failureMessage,
      mode,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown background error";
    await updateTryOnRecord(admin, record.id, {
      status: "failed",
      error_message: message,
    });
    logRouter("ASYNC_CRASH", { requestId: record.id, error: message, mode });
  }
}

// ─── MAIN ENTRYPOINTS ───────────────────────────────────────────────────────
async function handleCreate(admin: ReturnType<typeof createClient>, apiKey: string, userId: string | null, body: CreateBody): Promise<TryOnResponse> {
  const mode: "studio" | "vton" = body.mode === "vton" ? "vton" : "studio";
  const generatorTag = mode === "vton" ? "replicate-idm-vton" : "lovable-ai-nano-banana";
  const modelIdForRecord = mode === "vton" ? VTON_MODEL_ID : "google/gemini-2.5-flash-image";

  // Cache key includes mode so studio + vton results don't clobber each other.
  const cacheKey = mode === "studio"
    ? `${body.productKey}::${mode}::${STUDIO_RENDER_VERSION}`
    : `${body.productKey}::${mode}`;
  const existing = userId ? await getTryOnByIdentity(admin, userId, { ...body, productKey: cacheKey }) : null;
  const existingMeta = (existing?.metadata || {}) as Record<string, unknown>;
  const studioCacheApproved = mode !== "studio"
    || existingMeta.renderVersion === STUDIO_RENDER_VERSION;

  if (existing && !body.forceRegenerate && existing.status === "succeeded" && existing.result_image_url && studioCacheApproved) {
    logRouter("CACHE_HIT", { id: existing.id, mode });
    return toSuccess(existing, existing.result_image_url);
  }

  if (!userId) {
    const result = mode === "vton"
      ? await generateCleanFitImage(apiKey, body)
      : await generateStudioFitImage(apiKey, body);

    if (result.kind === "success") {
      const persistedUrl = await persistImageToStorage(admin, result.imageUrl, userId, body.productKey, body.selectedSize);
      return { ok: true, imageUrl: persistedUrl, provider: "replicate", selectedSize: body.selectedSize, status: "succeeded", requestId: null, predictionId: null };
    }

    if (result.kind === "throttled") {
      return pending("rate_limited", { error: result.error, selectedSize: body.selectedSize, status: "throttled", requestId: null, retryAfterMs: result.retryAfterMs });
    }

    if (result.kind === "credits_exhausted") {
      return failure("credits_exhausted", result.error, body.selectedSize, null);
    }

    return failure(result.code, result.error, body.selectedSize, null);
  }

  const record = await upsertTryOnRecord(admin, userId, { ...body, productKey: cacheKey }, {
    status: "processing",
    prediction_id: null,
    result_image_url: null,
    error_message: null,
    model_id: modelIdForRecord,
    metadata: { generator: generatorTag, mode, retryAfterUntil: null, renderVersion: STUDIO_RENDER_VERSION },
  });

  if (!record) {
    return failure("provider_error", "could_not_create_try_on_job", body.selectedSize, null);
  }

  EdgeRuntime.waitUntil(processTryOnInBackground(admin, apiKey, userId, body, record, mode));
  logRouter("ASYNC_QUEUED", { requestId: record.id, mode });
  return pending("pending", {
    error: null,
    selectedSize: body.selectedSize,
    status: "processing",
    requestId: record.id,
  });
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
