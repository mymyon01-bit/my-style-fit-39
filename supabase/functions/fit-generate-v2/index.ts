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

  return [
    // ── Subject (locked faceless mannequin per spec [7]) ──
    `Studio fit visualization on a FACELESS MANNEQUIN. NOT a real person, NO visible face, NO facial features, NO skin texture, NO realism noise — smooth featureless head, neutral matte body. ${bodyGender} mannequin, neutral standing pose facing camera, arms slightly apart, full body visible.`,

    // ── Body proportions (per spec [13]–[16] — height + weight independent axes) ──
    `Body proportions are LOCKED to: height ${args.body.height}cm, weight ${args.body.weight}kg, BMI ${build.bmi} → ${build.category} category. The mannequin must be a ${build.description}. Height drives vertical length; weight drives horizontal volume — DO NOT scale uniformly. Same body across all sizes; never resize the body to fit the clothing.`,

    // ── Garment ──
    `Garment: wear the provided ${args.garmentLabel}. Preserve the garment's ORIGINAL color, structure, pattern and material EXACTLY as shown in the reference image. Do NOT redesign or restyle. Strong visual contrast between clothing and the matte mannequin body.`,

    // ── Fit translation (per spec [6] + [11]) ──
    `FIT CONDITION = ${fitType} for size ${args.selectedSize}. ${fitRules[fitType]} ${regionLine}`,

    // ── Hard consistency rules (per spec [8] + [17] + [18]) ──
    `CRITICAL: The BODY MUST stay identical across every size variant — only the garment changes. The clothing adapts to the body, NEVER the reverse. If the body looks slim despite a heavy weight value, regenerate.`,

    // ── Composition ──
    `Composition: plain bright studio background (white or light gray), soft even lighting, minimal shadows, full body centered. No lifestyle, no fashion editorial, no artistic effects. Goal: make the size-fit difference instantly readable.`,
  ].join(" ");
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
    const prompt = buildPrompt({ body, analysis: fitAnalysis, garmentLabel, genderPresentation, selectedSize });

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
