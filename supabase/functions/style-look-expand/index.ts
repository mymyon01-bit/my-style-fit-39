import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Piece { name: string; color: string; style: string; }
interface Outfit {
  label?: string;
  outfit: { top?: Piece; bottom?: Piece; shoes?: Piece; outerwear?: Piece | null; accessories?: Piece | null };
  explanation?: string;
}

function describeOutfit(o: Outfit): string {
  const parts: string[] = [];
  const add = (label: string, p?: Piece | null) => {
    if (!p) return;
    parts.push(`${label}: ${p.color || ""} ${p.name}${p.style ? ` (${p.style})` : ""}`.trim());
  };
  add("top", o.outfit.top);
  add("bottom", o.outfit.bottom);
  add("shoes", o.outfit.shoes);
  add("outerwear", o.outfit.outerwear);
  add("accessories", o.outfit.accessories);
  return parts.join(", ");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const { outfit, generateImage = true, generateVariations = true } =
      (await req.json().catch(() => ({}))) as {
        outfit: Outfit;
        generateImage?: boolean;
        generateVariations?: boolean;
      };

    if (!outfit?.outfit) {
      return new Response(JSON.stringify({ error: "outfit required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const description = describeOutfit(outfit);

    // 1. Image generation (Nano Banana)
    const imagePromise = generateImage
      ? fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-image",
            messages: [{
              role: "user",
              content: `Editorial fashion lookbook photo, full body, clean neutral studio background, natural soft lighting, model wearing: ${description}. Minimalist Korean street style aesthetic. High fashion magazine quality, no text, no watermark.`,
            }],
            modalities: ["image", "text"],
          }),
        }).then(r => r.json()).catch(() => null)
      : Promise.resolve(null);

    // 2. Variation generation (text)
    const variationsPromise = generateVariations
      ? fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: "You are a fashion stylist. Reply ONLY with valid JSON, no markdown." },
              { role: "user", content: `Given this base look: "${outfit.label || description}" (${description})

Generate 3 alternative styling variations that share the same vibe but differ in mood or formality. Each must be distinct.

Return JSON: { "variations": [{ "label": "...", "outfit": { "top": { "name": "...", "color": "...", "style": "..." }, "bottom": {...}, "shoes": {...}, "outerwear": null, "accessories": null }, "explanation": "One short sentence why this twist works." }] }` },
            ],
          }),
        }).then(r => r.json()).catch(() => null)
      : Promise.resolve(null);

    const [imgRes, varRes] = await Promise.all([imagePromise, variationsPromise]);

    let imageUrl: string | null = null;
    if (imgRes) {
      imageUrl = imgRes?.choices?.[0]?.message?.images?.[0]?.image_url?.url || null;
    }

    let variations: Outfit[] = [];
    if (varRes) {
      const content = varRes?.choices?.[0]?.message?.content || "";
      try {
        const m = content.match(/\{[\s\S]*\}/);
        if (m) {
          const parsed = JSON.parse(m[0]);
          variations = Array.isArray(parsed.variations) ? parsed.variations : [];
        }
      } catch { /* ignore */ }
    }

    return new Response(JSON.stringify({ imageUrl, variations }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("style-look-expand error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
