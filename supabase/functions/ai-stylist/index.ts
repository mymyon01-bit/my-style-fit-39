import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");
    if (!PERPLEXITY_API_KEY) {
      return new Response(JSON.stringify({ error: "PERPLEXITY_API_KEY is not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { mood, weather, location, styles, bodyType, occasion } = await req.json();

    const systemPrompt = `You are WARDROBE AI — a premium personal fashion stylist. You respond in a calm, confident, editorial tone. You give concise, actionable style advice.

Rules:
- Keep responses under 120 words
- Be specific about clothing types, colors, fabrics
- Reference the user's mood, weather, and body context naturally
- Sound like a luxury fashion editor, not a chatbot
- Use line breaks between distinct suggestions
- Never use bullet points or numbered lists
- Never say "I recommend" — just state what works`;

    const userPrompt = `The user feels "${mood || "neutral"}". 
Weather: ${weather?.temp || 22}°C, ${weather?.condition || "clear"} in ${location || "their city"}.
Style preferences: ${styles?.join(", ") || "minimal, clean"}.
Body type: ${bodyType || "balanced proportions"}.
Occasion: ${occasion || "daily"}.

Give them a personalized styling direction for today.`;

    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${PERPLEXITY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 300,
        temperature: 0.6,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Perplexity API error:", response.status, errText);
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
    console.error("ai-stylist error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
