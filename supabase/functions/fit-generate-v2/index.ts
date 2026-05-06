// Edge function: measurement-first fit pipeline.
// 1) calculateFit  2) interpretFit  3) buildPrompt  4) generate image
// Always returns a usable JSON payload — never 504s, never blocks the UI.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type BodyMeasurements = {
  height: number; weight: number; chest: number; waist: number;
  hips: number; shoulder: number; armLength: number;
};
type GarmentMeasurements = { chest: number; length: number; shoulder: number; sleeve: number };

const idealLength = (h: number) => Math.round(h * 0.4);
const round = (n: number) => Math.round(n * 10) / 10;

function calculateFit(b: BodyMeasurements, g: GarmentMeasurements) {
  return {
    chestDiff: round(g.chest - b.chest),
    shoulderDiff: round(g.shoulder - b.shoulder),
    lengthDiff: round(g.length - idealLength(b.height)),
    sleeveDiff: round(g.sleeve - b.armLength),
  };
}

function interpretFit(r: ReturnType<typeof calculateFit>) {
  const chestFit = r.chestDiff < 2 ? "tight" : r.chestDiff <= 6 ? "regular" : "loose";
  const lengthFit = r.lengthDiff < -3 ? "short" : r.lengthDiff <= 4 ? "perfect" : "long";
  const shoulderFit = r.shoulderDiff < -1 ? "tight" : r.shoulderDiff <= 2 ? "perfect" : "dropped";
  const sleeveFit = r.sleeveDiff < -3 ? "short" : r.sleeveDiff <= 3 ? "perfect" : "long";
  const score = r.chestDiff + r.shoulderDiff * 1.5;
  const overall = score < 1 ? "tight" : score <= 6 ? "regular" : score <= 14 ? "relaxed" : "oversized";
  return { chestFit, lengthFit, shoulderFit, sleeveFit, overall };
}

// ─── BODY DESCRIPTION (per spec [13]–[16]) ──────────────────────────────────
// BMI category drives a deterministic, vivid body description that the visual
// model can render. The BODY MUST visibly differ across BMI categories so a
// 100kg user is never shown on a slim mannequin.
function describeBuild(b: BodyMeasurements): {
  bmi: number;
  category: "verySlim" | "slim" | "regular" | "solid" | "heavy";
  description: string;
} {
  const bmi = b.weight / Math.pow(b.height / 100, 2);
  let category: "verySlim" | "slim" | "regular" | "solid" | "heavy";
  let description: string;
  if (bmi < 18.5) {
    category = "verySlim";
    description = "very slim build with narrow shoulders, thin chest and arms, tight small waist, slender thighs and minimal body volume";
  } else if (bmi < 22) {
    category = "slim";
    description = "lean build with light frame, slim chest, thin arms and a clearly defined small waist";
  } else if (bmi < 25) {
    category = "regular";
    description = "balanced regular build with proportional chest, normal arm thickness and neutral waist";
  } else if (bmi < 30) {
    category = "solid";
    description = "solid build with thicker torso, wider waist, fuller chest and noticeably thicker arms and thighs";
  } else {
    category = "heavy";
    description = "heavy large build with a noticeably thick chest and belly, wide waist, large arms and thick thighs — visibly heavyset";
  }
  return { bmi: Math.round(bmi * 10) / 10, category, description };
}

function overallToFitType(overall: string): "TIGHT" | "PERFECT" | "LOOSE" | "OVERSIZED" {
  if (overall === "tight") return "TIGHT";
  if (overall === "regular") return "PERFECT";
  if (overall === "relaxed") return "LOOSE";
  return "OVERSIZED";
}

// ─── PROMPT (per spec [6]–[8], [13]–[18]) ───────────────────────────────────
// Hard rules baked in:
//   • body proportions follow BMI/height/weight, never aesthetics
//   • faceless mannequin only — no human, no face, no skin texture
//   • body identity locked across all sizes (only garment changes)
//   • fit visibly matches the COMPUTED label (TIGHT / PERFECT / LOOSE / OVERSIZED)
//   • per-region details: chest pulling, dropped shoulders, sleeve length, etc.
function buildPrompt(args: {
  body: BodyMeasurements;
  analysis: ReturnType<typeof interpretFit>;
  garmentLabel: string;
  genderPresentation?: string;
  selectedSize: string;
  /** Optional Garment DNA from the client (V3.6). When present, drives realism. */
  garmentDNA?: {
    garmentType?: string;
    fabricType?: string;
    fabricWeight?: string;
    stiffness?: string;
    elasticity?: string;
    drapeLevel?: string;
    stretchLevel?: string;
    intendedFit?: string;
    silhouette?: string;
    shoulderStructure?: string;
    waistbandBehavior?: string;
    sleeveLength?: string;
    oversizedRatio?: number;
  };
  /** Optional per-region physics instructions (V3.6). */
  visualInstructionLines?: string[];
  /** V3.8 — numeric size correlation directives (e.g. "chest tightens by 4cm"). */
  generationDirectives?: string[];
  /** V3.8 — selected-size summary copy ("Size M is 3cm smaller than your chest"). */
  sizeCorrelationCopy?: string;
}) {
  const bodyGender = args.genderPresentation === "feminine" ? "female"
    : args.genderPresentation === "masculine" ? "male"
    : "gender-neutral";
  const build = describeBuild(args.body);
  const fitType = overallToFitType(args.analysis.overall);

  // Per-region descriptors — surface the actual fit math in plain English.
  const regionDetails: string[] = [];
  if (args.analysis.chestFit === "tight")    regionDetails.push("fabric stretched tight across the chest with visible tension lines");
  if (args.analysis.chestFit === "loose")    regionDetails.push("clear extra fabric around the chest");
  if (args.analysis.shoulderFit === "tight") regionDetails.push("fabric pulling at the shoulder seams");
  if (args.analysis.shoulderFit === "dropped") regionDetails.push("shoulder seams dropped well past the natural shoulder line");
  if (args.analysis.sleeveFit === "short")   regionDetails.push("short sleeves that ride up");
  if (args.analysis.sleeveFit === "long")    regionDetails.push("long sleeves extending over the hands");
  if (args.analysis.lengthFit === "short")   regionDetails.push("short hem sitting above the natural length");
  if (args.analysis.lengthFit === "long")    regionDetails.push("extended hem reaching well below the hip");
  const regionLine = regionDetails.length
    ? `Visible per-region fit details: ${regionDetails.join("; ")}.`
    : "Per-region fit is balanced.";

  const fitRules: Record<typeof fitType, string> = {
    TIGHT:     "Garment is visibly TIGHT on this body. Fabric stretched, tension lines around chest/shoulders/arms/waist, slightly compressed silhouette. Do NOT shrink the body to 'make it fit'.",
    PERFECT:   "Garment fits CORRECTLY. Clean natural drape, no tension and no excess volume, balanced proportions.",
    LOOSE:     "Garment is visibly LOOSE on this body. Clear extra space between fabric and body, soft folds at waist/sleeves/hem, roomy silhouette.",
    OVERSIZED: "Garment is visibly OVERSIZED. Dropped shoulders past the natural shoulder line, sleeves extending over the hands, hem extended well past the hip, silhouette much larger than the body.",
  };

  // ── Base coverage layer (per modesty rule) ──
  const label = (args.garmentLabel || "").toLowerCase();
  const isBottom = /(pant|trouser|jean|short|skirt|legging|chino|slack|denim|cargo|joggers?)/.test(label);
  const isFootwear = /(shoe|sneaker|boot|heel|loafer|sandal|trainer)/.test(label);
  const isFullBody = /(dress|jumpsuit|romper|overall|gown|coverall)/.test(label);

  let baseLayerLine: string;
  if (isFullBody) {
    baseLayerLine = "The garment covers the full body — no additional base layer needed. Mannequin is never shown bare.";
  } else if (isBottom) {
    baseLayerLine = "Mannequin wears a plain neutral white short-sleeve crew T-shirt as a base layer covering the entire torso, shoulders and upper arms. The T-shirt is generic, unbranded, lightweight cotton — clearly a base layer, never the focus. The provided garment is the BOTTOM and must be the visual focus.";
  } else if (isFootwear) {
    baseLayerLine = "Mannequin wears a plain neutral white crew T-shirt and plain neutral light gray slim trousers as base layers. Both are generic and unbranded. The provided garment is the FOOTWEAR and must be the visual focus.";
  } else {
    baseLayerLine = "Mannequin wears plain neutral light gray slim trousers as a base layer covering hips, legs and ankles. The trousers are generic, unbranded, matte fabric — clearly a base layer, never the focus. The provided garment is the TOP/OUTERWEAR and must be the visual focus.";
  }

  // ── Garment DNA line (V3.6) — fabric, stiffness, drape, stretch ──
  const dna = args.garmentDNA;
  const dnaLine = dna
    ? `GARMENT DNA: type=${dna.garmentType ?? "unknown"}, fabric=${dna.fabricType ?? "unknown"} (${dna.fabricWeight ?? "medium"} weight), stiffness=${dna.stiffness ?? "low"}, elasticity=${dna.elasticity ?? "medium"}, drape=${dna.drapeLevel ?? "medium"}, stretch=${dna.stretchLevel ?? "medium"}, intended fit=${dna.intendedFit ?? "regular"}, silhouette=${dna.silhouette ?? "regular"}, shoulder=${dna.shoulderStructure ?? "natural"}, sleeve=${dna.sleeveLength ?? "n/a"}. Cloth must behave according to these properties: stiff fabrics form sharp folds; elastic fabrics stretch smoothly; high-drape fabrics flow with gravity; low-drape fabrics hold their structure.`
    : "";

  // ── Region physics lines (V3.6) — per-region tension/drape instructions ──
  const physicsBlock = (args.visualInstructionLines && args.visualInstructionLines.length)
    ? `PER-REGION FIT PHYSICS:\n${args.visualInstructionLines.join("\n")}`
    : "";

  // ── Numeric size correlation directives (V3.8) — fabric must respond to
  //    the actual per-region delta computed against the user's body.
  const correlationBlock = (args.generationDirectives && args.generationDirectives.length)
    ? `SIZE CORRELATION DIRECTIVES (numeric body↔garment relation):\n${args.generationDirectives.map((l) => `• ${l}`).join("\n")}`
    : "";
  const correlationCopy = args.sizeCorrelationCopy
    ? `SIZE-NUMBERS CONTEXT: ${args.sizeCorrelationCopy} The render must reflect this exact relationship — never reshape the body to compensate.`
    : "";


  return [
    `Studio fit visualization on a FACELESS MANNEQUIN. NOT a real person, NO visible face, NO facial features, NO skin texture, NO realism noise — smooth featureless head, neutral matte body. ${bodyGender} mannequin, neutral standing pose facing camera, arms slightly apart, full body visible.`,
    `Body proportions are LOCKED to: height ${args.body.height}cm, weight ${args.body.weight}kg, BMI ${build.bmi} → ${build.category} category. The mannequin must be a ${build.description}. Height drives vertical length; weight drives horizontal volume — DO NOT scale uniformly. Same body across all sizes; never resize the body to fit the clothing.`,
    `MODESTY RULE — STRICT: The mannequin must NEVER appear nude, in underwear, in lingerie or with bare torso/legs. ${baseLayerLine} The base layer must be visually subdued (plain, matte, neutral) so it never competes with the focus garment.`,
    `Focus garment: wear the provided ${args.garmentLabel} OVER the base layer. Preserve the garment's ORIGINAL color, structure, pattern and material EXACTLY as shown in the reference image. Do NOT redesign or restyle. Strong visual contrast between the focus garment and the muted base layer/mannequin body.`,
    dnaLine,
    `FIT CONDITION = ${fitType} for size ${args.selectedSize}. ${fitRules[fitType]} ${regionLine}`,
    physicsBlock,
    `BODY LOCK — ABSOLUTE: The subject's body is a FIXED, IMMUTABLE OBJECT. DO NOT slim the waist, DO NOT enlarge hips, DO NOT widen shoulders, DO NOT reshape torso, legs, arms or face, DO NOT beautify, DO NOT generate a different person. Identical body, identical pose, identical proportions, identical skin tone, identical camera angle, identical crop, identical scale, identical lighting, identical background across EVERY size (S, M, L, XL, XXL). The GARMENT is the only variable — it stretches, compresses, drapes or folds around this fixed body. The clothing adapts to the body; the body NEVER adapts to the clothing. If a size is too small the fabric stretches and tension lines appear — the body does not shrink. If a size is too large the fabric drapes and folds — the body does not grow. The base layer also stays identical across sizes.`,
    `Composition: plain bright studio background (white or light gray), soft even lighting, minimal shadows, full body centered. No lifestyle, no fashion editorial, no artistic effects. Goal: make the size-fit difference instantly readable.`,
  ].filter(Boolean).join(" ");
}

// Final image generation is delegated to the fit-tryon-router edge function,
// which uses Replicate IDM-VTON. Gemini is intentionally NOT used here so the
// FIT path stays on a single, paid, image-capable provider (Replicate).
async function generateImage(opts: {
  prompt: string;
  productImageUrl: string | null;
  userImageUrl: string | null;
  productKey: string;
  productName?: string;
  productCategory?: string;
  selectedSize: string;
  bodyProfileSummary?: Record<string, unknown>;
  authHeader: string;
}): Promise<{ url: string | null; error?: string }> {
  if (!opts.productImageUrl) return { url: null, error: "missing_product_image" };
  if (!opts.userImageUrl) return { url: null, error: "missing_user_body_image" };

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return { url: null, error: "supabase_env_missing" };

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 55_000);
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/fit-tryon-router`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: opts.authHeader || `Bearer ${SUPABASE_ANON_KEY}`,
        apikey: SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "create",
        productImageUrl: opts.productImageUrl,
        userImageUrl: opts.userImageUrl,
        productKey: opts.productKey,
        productName: opts.productName,
        productCategory: opts.productCategory,
        selectedSize: opts.selectedSize,
        bodyProfileSummary: opts.bodyProfileSummary,
        // The router builds its own concise prompt; ours is informational.
        fitDescriptor: opts.prompt.slice(0, 500),
      }),
    });
    clearTimeout(timer);

    const data = await resp.json().catch(() => ({} as any));
    if (data?.ok && data?.imageUrl) return { url: data.imageUrl as string };
    return { url: null, error: data?.error || `router_${resp.status}` };
  } catch (e) {
    return { url: null, error: e instanceof Error ? e.message : String(e) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const input = await req.json();
    const body = input.body as BodyMeasurements;
    const garment = input.garment as GarmentMeasurements;
    const garmentLabel = String(input.garmentLabel ?? "garment");
    const genderPresentation = input.genderPresentation as string | undefined;
    const productImageUrl = (input.productImageUrl as string | null) ?? null;
    const userImageUrl = (input.userImageUrl as string | null) ?? null;
    const productKey = String(input.productKey ?? `pkey_${garmentLabel}`).slice(0, 200);
    const productName = (input.productName as string | undefined) ?? garmentLabel;
    const productCategory = (input.productCategory as string | undefined) ?? undefined;
    const selectedSize = String(input.selectedSize ?? "M");

    if (!body || !garment) {
      return new Response(JSON.stringify({ error: "body and garment are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const bodyProfileSummary = (input.bodyProfileSummary as Record<string, unknown> | undefined) ?? {
      heightCm: body.height, weightKg: body.weight, gender: genderPresentation,
    };

    const fitResult = calculateFit(body, garment);
    const fitAnalysis = interpretFit(fitResult);
    const garmentDNA = (input.garmentDNA as any) ?? undefined;
    const visualInstructionLines = Array.isArray(input.visualInstructionLines)
      ? (input.visualInstructionLines as string[]).slice(0, 12)
      : undefined;
    const prompt = buildPrompt({ body, analysis: fitAnalysis, garmentLabel, genderPresentation, selectedSize, garmentDNA, visualInstructionLines });

    const { url, error } = await generateImage({
      prompt, productImageUrl, userImageUrl, productKey,
      productName, productCategory, selectedSize, bodyProfileSummary,
      authHeader: req.headers.get("Authorization") || "",
    });

    const status = url ? "success" : "partial";
    return new Response(JSON.stringify({
      status, fitResult, fitAnalysis, prompt, imageUrl: url, message: error,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    // Never 504. Return error payload so UI can still render fit if possible.
    return new Response(JSON.stringify({
      status: "error", message: e instanceof Error ? e.message : String(e),
      fitResult: null, fitAnalysis: null, prompt: "", imageUrl: null,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
