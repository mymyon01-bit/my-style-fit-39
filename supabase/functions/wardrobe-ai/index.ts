import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");
    if (!PERPLEXITY_API_KEY) throw new Error("PERPLEXITY_API_KEY is not configured");

    const { type, context } = await req.json();

    let systemPrompt = "";
    let userPrompt = "";

    switch (type) {
      case "mood-styling": {
        systemPrompt = `You are WARDROBE AI — a premium personal fashion stylist. Respond in calm, confident, editorial tone. Give concise, actionable style advice under 120 words. Be specific about clothing types, colors, fabrics. Never use bullet points. Never say "I recommend."`;
        userPrompt = `User mood: "${context.mood || "neutral"}". Weather: ${context.weather?.temp || 22}°C, ${context.weather?.condition || "clear"} in ${context.location || "unknown"}.${context.styles ? ` Style preferences: ${context.styles.join(", ")}.` : ""}${context.bodyType ? ` Body type: ${context.bodyType}.` : ""} Occasion: ${context.occasion || "daily"}. Give personalized styling direction for today. Also suggest specific outfit pieces: a top, bottom, shoes, and optionally outerwear. For each piece, provide: name, category (tops/bottoms/shoes/outerwear), style description, and a suggested color.`;
        break;
      }
      case "style-analysis": {
        systemPrompt = `You are a fashion analyst AI. Analyze style preferences and body data to generate a concise style profile. Be specific, editorial, and actionable. Under 150 words.`;
        userPrompt = `User data:
Height: ${context.height || "unknown"}cm, Weight: ${context.weight || "unknown"}kg
Preferred styles: ${context.preferredStyles?.join(", ") || "not specified"}
Disliked styles: ${context.dislikedStyles?.join(", ") || "not specified"}
Fit preference: ${context.fitPreference || "regular"}
Budget: ${context.budget || "mid-range"}

Generate: 1) A short style profile summary (2 sentences). 2) Silhouette recommendation. 3) Color direction. 4) 3 key style rules for this person.`;
        break;
      }
      case "fit-explanation": {
        systemPrompt = `You are a concise fashion fit advisor. Never invent data. Only explain what you're given. Under 60 words.`;
        userPrompt = `Product: ${context.productName} by ${context.productBrand}. Recommended Size: ${context.recommendedSize} (score: ${context.fitScore}/100). Alternate: ${context.alternateSize}. Product Data: ${context.productDataQuality}/100. Scan: ${context.scanQuality}/100. Regions: ${context.regionText}. Summary: ${context.summary}. Write a natural, helpful explanation.`;
        break;
      }
      case "ootd-feedback": {
        systemPrompt = `You are a fashion community AI that gives brief, supportive style feedback on outfit photos. Be specific about what works and one subtle suggestion. Under 50 words.`;
        userPrompt = `Outfit caption: "${context.caption || ""}". Style tags: ${context.styleTags?.join(", ") || "none"}. Weather: ${context.weather || "unknown"}. Occasion: ${context.occasion || "daily"}. Give brief style feedback.`;
        break;
      }
      default:
        return new Response(JSON.stringify({ error: "Unknown request type" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 400,
        temperature: 0.5,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Perplexity error:", response.status, errText);
      return new Response(JSON.stringify({ error: `AI service error (${response.status})` }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({ response: content, citations: data.citations || [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("wardrobe-ai error:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
