// ─── FIT EXPLAIN — Lovable AI (no Perplexity) ───────────────────────────────
// Generates a short shopper-friendly fit explanation using Lovable AI Gateway.
// Perplexity has been removed from all FIT flows.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const body = await req.json();
    const {
      summary, recommendedSize, alternateSize, fitScore,
      productName, productBrand, productDataQuality, scanQuality, regions,
    } = body;

    const regionText = (regions || [])
      .map((r: any) => `${r.region}: ${r.fit} (delta: ${r.delta}cm)`)
      .join(", ");

    const prompt = `You are a premium fashion fit advisor. Given these structured fit results, write a concise, shopper-friendly explanation in 2-3 sentences. Be precise and honest about fit. Do NOT invent measurements or override the scoring.

Product: ${productName} by ${productBrand}
Recommended Size: ${recommendedSize} (score: ${fitScore}/100)
Alternate Size: ${alternateSize}
Product Data Quality: ${productDataQuality}/100
Scan Quality: ${scanQuality}/100
Region Breakdown: ${regionText}
Algorithm Summary: ${summary}

Write a natural, helpful explanation. If confidence is low, mention it. Keep it under 60 words.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are a concise fashion fit advisor. Never invent data. Only explain what you're given." },
          { role: "user", content: prompt },
        ],
        max_tokens: 200,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Lovable AI error [${response.status}]: ${err}`);
    }

    const data = await response.json();
    const explanation = data.choices?.[0]?.message?.content || summary;

    return new Response(JSON.stringify({ explanation }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("fit-explain error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
