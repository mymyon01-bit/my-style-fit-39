// Virtual try-on edge function — composes a try-on image of the user wearing
// a selected product using the Lovable AI gateway (Gemini image edit).
// Hardcoded contract: { userImageUrl, productImageUrl, category } -> { resultImageUrl }

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface TryOnRequest {
  userImageUrl: string;
  productImageUrl: string;
  category?: string;
  bodyProfile?: Record<string, unknown>;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as TryOnRequest;
    if (!body?.userImageUrl || !body?.productImageUrl) {
      return new Response(
        JSON.stringify({ error: "userImageUrl and productImageUrl are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const category = body.category || "garment";
    const instruction =
      `Generate a realistic virtual try-on image. Take the person from the first image and dress them in the ${category} from the second image. ` +
      `Preserve the person's face, body proportions, pose, and background exactly. Replace only the relevant clothing region with the new ${category}. ` +
      `Match lighting, fabric drape, and shadows realistically. Output a single full-body photo.`;

    const aiResponse = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-pro-image-preview",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: instruction },
                { type: "image_url", image_url: { url: body.userImageUrl } },
                { type: "image_url", image_url: { url: body.productImageUrl } },
              ],
            },
          ],
          modalities: ["image", "text"],
        }),
      }
    );

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit reached. Try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errText = await aiResponse.text();
      console.error("[fit-tryon] AI gateway error", aiResponse.status, errText);
      return new Response(
        JSON.stringify({ error: "Try-on generation failed" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await aiResponse.json();
    const resultImageUrl =
      data?.choices?.[0]?.message?.images?.[0]?.image_url?.url ?? null;

    if (!resultImageUrl) {
      console.error("[fit-tryon] No image in response", JSON.stringify(data).slice(0, 500));
      return new Response(
        JSON.stringify({ error: "No try-on image returned" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ resultImageUrl, status: "complete" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[fit-tryon] error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
