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
  if (bmi < 19) return "slim";
  if (bmi < 24) return "regular";
  if (bmi < 28) return "athletic";
  return "broad";
}

function buildPrompt(args: {
  body: BodyMeasurements;
  analysis: ReturnType<typeof interpretFit>;
  garmentLabel: string;
  genderPresentation?: string;
}) {
  const subject = args.genderPresentation === "feminine" ? "female" : args.genderPresentation === "masculine" ? "male" : "person";
  const build = describeBuild(args.body);
  const chest = args.analysis.chestFit === "tight" ? "The chest area is slightly tight."
    : args.analysis.chestFit === "loose" ? "The chest area sits relaxed with extra room."
    : "The chest fits naturally.";
  const sleeve = args.analysis.sleeveFit === "short" ? "The sleeves end above the wrist."
    : args.analysis.sleeveFit === "long" ? "The sleeves cover past the wrist."
    : "The sleeves end at the wrist.";
  const shoulder = args.analysis.shoulderFit === "tight" ? "The shoulder seam sits slightly inward."
    : args.analysis.shoulderFit === "dropped" ? "The shoulder seam drops past the natural shoulder."
    : "The shoulder seam sits at the natural shoulder line.";
  const length = args.analysis.lengthFit === "short" ? "The garment length is shorter than ideal."
    : args.analysis.lengthFit === "long" ? "The garment length is longer than ideal."
    : "The garment length sits at an ideal hem position.";
  return [
    `A ${build} ${subject}, ${args.body.height}cm, wearing a ${args.garmentLabel}.`,
    chest, sleeve, shoulder, length,
    "Realistic fashion photography, clean studio background, neutral lighting, full-body front view.",
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
    const productImageUrl = (input.productImageUrl as string | null) ?? null;
    const userImageUrl = (input.userImageUrl as string | null) ?? null;
    const productKey = String(input.productKey ?? `pkey_${garmentLabel}`).slice(0, 200);
    const productName = (input.productName as string | undefined) ?? garmentLabel;
    const productCategory = (input.productCategory as string | undefined) ?? undefined;
    const selectedSize = String(input.selectedSize ?? "M");
    const bodyProfileSummary = (input.bodyProfileSummary as Record<string, unknown> | undefined) ?? {
      heightCm: body.height, weightKg: body.weight, gender: genderPresentation,
    };

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
    return new Response(JSON.stringify({
      status: "error", message: e instanceof Error ? e.message : String(e),
      fitResult: null, fitAnalysis: null, prompt: "", imageUrl: null,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
    }

    const fitResult = calculateFit(body, garment);
    const fitAnalysis = interpretFit(fitResult);
    const prompt = buildPrompt({ body, analysis: fitAnalysis, garmentLabel, genderPresentation });

    const { url, error } = await generateImage(prompt, productImageUrl);

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
