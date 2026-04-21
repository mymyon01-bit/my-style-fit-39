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

async function generateImage(prompt: string, productImageUrl: string | null): Promise<{ url: string | null; error?: string }> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return { url: null, error: "LOVABLE_API_KEY missing" };

  const content: any[] = [{ type: "text", text: prompt }];
  if (productImageUrl) content.push({ type: "image_url", image_url: { url: productImageUrl } });

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 45_000);
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-pro-image-preview",
        messages: [{ role: "user", content }],
        modalities: ["image", "text"],
      }),
    });
    clearTimeout(timer);

    if (!resp.ok) {
      const txt = await resp.text();
      return { url: null, error: `gateway ${resp.status}: ${txt.slice(0, 200)}` };
    }
    const data = await resp.json();
    const url = data?.choices?.[0]?.message?.images?.[0]?.image_url?.url ?? null;
    return { url };
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
    const genderPresentation = input.genderPresentation as string | undefined;

    if (!body || !garment) {
      return new Response(JSON.stringify({ error: "body and garment are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
