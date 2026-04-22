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

function describeBuild(b: BodyMeasurements) {
  const bmi = b.weight / Math.pow(b.height / 100, 2);
  if (bmi < 22) return "slim";
  if (bmi < 28) return "athletic";
  return "heavy";
}

function overallToFitType(overall: string): "TIGHT" | "PERFECT" | "LOOSE" | "OVERSIZED" {
  if (overall === "tight") return "TIGHT";
  if (overall === "regular") return "PERFECT";
  if (overall === "relaxed") return "LOOSE";
  return "OVERSIZED";
}

function buildPrompt(args: {
  body: BodyMeasurements;
  analysis: ReturnType<typeof interpretFit>;
  garmentLabel: string;
  genderPresentation?: string;
  selectedSize: string;
}) {
  const bodyType = args.genderPresentation === "feminine" ? "female"
    : args.genderPresentation === "masculine" ? "male"
    : "gender-neutral";
  const build = describeBuild(args.body); // slim | athletic | heavy
  const fitType = overallToFitType(args.analysis.overall);

  const fitRules: Record<typeof fitType, string> = {
    TIGHT: "Visible fabric tension and pulling around shoulders, chest, arms and waist. Fabric is stretched against the body with subtle stress lines. Slightly compressed silhouette. NO body resizing.",
    PERFECT: "Clean natural drape, correct proportions, balanced fit. Fabric sits smoothly with no tension and no excess volume. No distortion.",
    LOOSE: "Clear extra space between body and fabric. Relaxed draping with soft folds at the waist, sleeves and hem. Visibly roomier than the body.",
    OVERSIZED: "Exaggerated looseness. Dropped shoulders past the natural shoulder line, extended sleeve length covering the hands, hem extended well past the hip. Silhouette visibly much larger than the body.",
  };

  return [
    `Clean, high-clarity clothing FIT VISUALIZATION on a neutral mannequin-style body.`,
    `Subject: a ${bodyType} ${build}-build mannequin / fitting dummy. NOT a real person. No visible face, no facial features, no identity — smooth featureless head. No skin texture, no realism, no fashion-model styling. Neutral posture: standing straight, front-facing, arms relaxed at the sides.`,
    `Garment: wear the provided ${args.garmentLabel}. Preserve the garment's original color, structure, pattern and material EXACTLY as shown in the reference image. Do NOT redesign or restyle the garment. Ensure strong visual contrast between the clothing and the mannequin body.`,
    `FIT CONDITION = ${fitType} (size ${args.selectedSize}). ${fitRules[fitType]}`,
    `CRITICAL: The body MUST stay identical regardless of size. Do NOT resize, slim or enlarge the body to fit the clothing. The clothing adapts to the body, never the reverse.`,
    `Composition: plain bright studio background (white or light gray), soft even lighting with minimal shadows, full body visible, centered framing.`,
    `Goal: the fit difference (TIGHT vs PERFECT vs LOOSE vs OVERSIZED) must be instantly recognizable at a glance. Communicate size and fit clearly — not fashion, not aesthetics. Avoid artistic effects, realism noise and unnecessary detail.`,
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
    const prompt = buildPrompt({ body, analysis: fitAnalysis, garmentLabel, genderPresentation });

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
