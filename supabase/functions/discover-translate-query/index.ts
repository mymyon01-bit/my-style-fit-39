// discover-translate-query
// ------------------------
// Translates a Korean (or mixed) fashion shopping query into 3-5 natural,
// LLM-style English search queries that real shoppers would type. This lets
// the Discover pipeline ALSO hit English-only sources (Farfetch, SSENSE,
// ASOS, etc.) when the user types in Korean.
//
// Returns: { ok: true, queries: string[] } on success.
// Soft-fails on rate limit / credits / timeout (returns ok:false, queries:[]).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MODEL = "google/gemini-2.5-flash-lite";

const SYSTEM_PROMPT = `You translate Korean (or mixed Korean/English) fashion shopping queries into natural English search queries.

Rules:
- Output 3 to 5 short English queries a real shopper would type into Google or a fashion site.
- DO NOT translate word-for-word. Capture the intent, vibe, occasion, season, and category.
- Include category nouns (jacket, coat, sneakers, bag, dress, etc.) when the Korean implies them.
- Add useful modifiers when implied: gender (women's/men's), season, mood (minimal, oversized, streetwear), occasion (work, date, rainy day, wedding).
- Each query must be 2-7 words. Lowercase. No punctuation.
- No duplicates. No brands unless the original mentions a brand.

Always respond by calling the tool "translate_queries".`;

const TOOL = {
  type: "function",
  function: {
    name: "translate_queries",
    description: "Return 3-5 natural English fashion search queries for the given Korean query.",
    parameters: {
      type: "object",
      properties: {
        queries: {
          type: "array",
          items: { type: "string" },
          minItems: 3,
          maxItems: 5,
        },
      },
      required: ["queries"],
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
    const timer = setTimeout(() => ctrl.abort(), 8000);
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
        tool_choice: { type: "function", function: { name: "translate_queries" } },
      }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);

    if (resp.status === 429 || resp.status === 402 || !resp.ok) {
      const reason =
        resp.status === 402 ? "credits_exhausted" :
        resp.status === 429 ? "rate_limited" : "gateway_error";
      if (!resp.ok && resp.status !== 402 && resp.status !== 429) {
        const txt = await resp.text().catch(() => "");
        console.error("[discover-translate-query] gateway error", resp.status, txt.slice(0, 300));
      } else {
        console.warn("[discover-translate-query]", reason);
      }
      return new Response(
        JSON.stringify({ ok: false, reason, queries: [], durationMs: Date.now() - t0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await resp.json();
    const call = data?.choices?.[0]?.message?.tool_calls?.[0];
    const argsStr = call?.function?.arguments;
    if (!argsStr) {
      return new Response(
        JSON.stringify({ ok: false, reason: "no_tool_call", queries: [], durationMs: Date.now() - t0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    let parsed: { queries?: string[] };
    try { parsed = JSON.parse(argsStr); }
    catch {
      return new Response(
        JSON.stringify({ ok: false, reason: "invalid_tool_args", queries: [], durationMs: Date.now() - t0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const queries = Array.isArray(parsed.queries)
      ? parsed.queries
          .map((q) => String(q || "").trim().toLowerCase())
          .filter((q) => q.length >= 2 && q.length <= 80)
          .slice(0, 5)
      : [];

    return new Response(
      JSON.stringify({ ok: true, query, queries, durationMs: Date.now() - t0 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = (e as Error).message || "unknown";
    const aborted = msg.includes("abort");
    console.warn("[discover-translate-query]", aborted ? "timeout" : "fatal", msg);
    return new Response(
      JSON.stringify({ ok: false, reason: aborted ? "timeout" : "error", queries: [], durationMs: Date.now() - t0 }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
