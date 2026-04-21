// discover-intent-expand
// ----------------------
// Lovable AI fallback for vague / emotional / mixed-language Discover queries.
// Called ONLY when the deterministic intent parser produces no useful signal
// (no category, no brand, no color, no alias hits). Returns structured
// expansion tokens via tool-calling so the response is parseable JSON.
//
// Cost-control: model = google/gemini-2.5-flash-lite (cheapest), max 8s.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MODEL = "google/gemini-2.5-flash-lite";

const SYSTEM_PROMPT = `You are a fashion search query interpreter.
The user typed a vague, emotional, slang, or mixed Korean/English fashion query.
Extract the structured shopping intent. Always respond by calling the tool "expand_intent".
- categories: pick from [bags, shoes, outerwear, tops, bottoms, dresses, accessories] only.
- styleTags: short EN words (e.g. "minimal", "streetwear", "oversized", "tailored", "vintage").
- moodTags: short EN vibe words (e.g. "effortless", "edgy", "romantic", "clean", "bold").
- enTokens: 4-8 lowercase EN search tokens to OR-match against product titles.
- color: a single color name or null.
- brand: a single brand name or null.
- weather: rainy|snowy|hot|cold|null.
- occasion: short EN phrase like "date night", "office", "wedding" or null.
Be concise. Never invent brands.`;

const TOOL = {
  type: "function",
  function: {
    name: "expand_intent",
    description: "Return structured shopping intent extracted from the user's query.",
    parameters: {
      type: "object",
      properties: {
        categories: {
          type: "array",
          items: {
            type: "string",
            enum: ["bags", "shoes", "outerwear", "tops", "bottoms", "dresses", "accessories"],
          },
        },
        styleTags: { type: "array", items: { type: "string" } },
        moodTags:  { type: "array", items: { type: "string" } },
        enTokens:  { type: "array", items: { type: "string" } },
        color:     { type: ["string", "null"] },
        brand:     { type: ["string", "null"] },
        weather:   { type: ["string", "null"], enum: ["rainy", "snowy", "hot", "cold", null] },
        occasion:  { type: ["string", "null"] },
      },
      required: ["categories", "styleTags", "moodTags", "enTokens"],
      additionalProperties: false,
    },
  },
};

interface ReqBody { query?: string }

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST only" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: ReqBody;
  try { body = await req.json(); }
  catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const query = (body.query || "").trim();
  if (!query || query.length > 200) {
    return new Response(JSON.stringify({ error: "query required (1-200 chars)" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "LOVABLE_API_KEY missing" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const t0 = Date.now();
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20000);
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: query },
        ],
        tools: [TOOL],
        tool_choice: { type: "function", function: { name: "expand_intent" } },
      }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);

    // Soft-fail on rate limit / credits / gateway errors — client falls back to deterministic baseline.
    if (resp.status === 429 || resp.status === 402 || !resp.ok) {
      const reason =
        resp.status === 402 ? "credits_exhausted" :
        resp.status === 429 ? "rate_limited" : "gateway_error";
      if (!resp.ok && resp.status !== 402 && resp.status !== 429) {
        const txt = await resp.text().catch(() => "");
        console.error("[discover-intent-expand] gateway error", resp.status, txt.slice(0, 300));
      } else {
        console.warn("[discover-intent-expand]", reason);
      }
      return new Response(
        JSON.stringify({ ok: false, reason, intent: null, durationMs: Date.now() - t0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await resp.json();
    const call = data?.choices?.[0]?.message?.tool_calls?.[0];
    const argsStr = call?.function?.arguments;
    if (!argsStr) {
      return new Response(JSON.stringify({ error: "no_tool_call", raw: data }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    let parsed: Record<string, unknown>;
    try { parsed = JSON.parse(argsStr); }
    catch {
      return new Response(JSON.stringify({ error: "invalid_tool_args", argsStr }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, query, durationMs: Date.now() - t0, intent: parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = (e as Error).message || "unknown";
    const aborted = msg.includes("abort");
    console.warn("[discover-intent-expand]", aborted ? "timeout" : "fatal", msg);
    // Return 200 with null intent so the client falls back gracefully (no console error spam).
    return new Response(
      JSON.stringify({ ok: false, reason: aborted ? "timeout" : "error", durationMs: Date.now() - t0, intent: null }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
