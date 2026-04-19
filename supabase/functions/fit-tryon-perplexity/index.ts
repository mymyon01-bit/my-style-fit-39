// ─── PERPLEXITY FALLBACK FOR FIT TRY-ON ────────────────────────────────────
// Perplexity is NOT a true virtual try-on engine. It cannot generate a
// pixel-accurate dressed-person image. We use it as a structured visual
// interpretation fallback when Replicate fails: it returns a best-effort
// reference image URL (from the live web) that visually represents the
// garment + size + fit context, so the UI can still show *something* labelled
// as a fallback rather than a dead state.
//
// Response shape (consumed by fit-tryon-router):
//   { ok: true,  provider: "perplexity", imageUrl: "...", fallbackUsed: true }
//   { ok: false, provider: "perplexity", error: "..." }

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface FallbackBody {
  productImageUrl: string;
  productCategory?: string;
  selectedSize: string;
  fitDescriptor?: string;
  garmentDescription?: string;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function sizeBehavior(size: string): string {
  const s = (size || "M").toUpperCase();
  if (s === "XS" || s === "S") return "tight, body-skimming, fitted close to torso";
  if (s === "L") return "relaxed with generous ease, soft folds at waist";
  if (s === "XL" || s === "XXL") return "oversized, dropped shoulders, billowing hem";
  return "true-to-size, natural drape, comfortable room";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, provider: "perplexity", error: "method_not_allowed" }, 405);

  const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");
  if (!PERPLEXITY_API_KEY) {
    console.warn("[perplexity-fallback] PERPLEXITY_API_KEY missing");
    return json({ ok: false, provider: "perplexity", error: "perplexity_api_key_missing" }, 200);
  }

  let body: FallbackBody;
  try {
    body = (await req.json()) as FallbackBody;
  } catch {
    return json({ ok: false, provider: "perplexity", error: "invalid_json" }, 400);
  }

  if (!body?.productImageUrl || !body?.selectedSize) {
    return json({ ok: false, provider: "perplexity", error: "missing_required_fields" }, 400);
  }

  const cat = (body.productCategory || "garment").toLowerCase();
  const fit = body.fitDescriptor || "regular";
  const behavior = sizeBehavior(body.selectedSize);
  const desc = body.garmentDescription || `${cat} (${fit} fit, ${behavior})`;

  const t0 = Date.now();
  try {
    // Ask Perplexity for a JSON-structured editorial reference: a single
    // public image URL of a person wearing a similar garment in a similar fit.
    const r = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          {
            role: "system",
            content:
              "You are a fashion image search assistant. Reply ONLY with strict JSON of the form {\"image_url\":\"https://...\",\"source\":\"https://...\"} pointing to a single public, hot-linkable JPG/PNG of a real person wearing the requested garment style in the requested fit. No markdown, no commentary.",
          },
          {
            role: "user",
            content: `Find one editorial photo of a person wearing a ${desc}. Size feel: ${behavior}. Return JSON only.`,
          },
        ],
        max_tokens: 300,
        temperature: 0.2,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "fit_reference",
            schema: {
              type: "object",
              properties: {
                image_url: { type: "string" },
                source: { type: "string" },
              },
              required: ["image_url"],
            },
          },
        },
      }),
    });

    const latency = Date.now() - t0;

    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      console.error("[perplexity-fallback] http", r.status, txt.slice(0, 300));
      return json(
        { ok: false, provider: "perplexity", error: `perplexity_http_${r.status}`, latency_ms: latency },
        200
      );
    }

    const data = await r.json().catch(() => ({}));
    const content = data?.choices?.[0]?.message?.content || "";
    let parsed: { image_url?: string; source?: string } = {};
    try {
      parsed = typeof content === "string" ? JSON.parse(content) : content;
    } catch {
      // Try to salvage a URL from the text
      const m = String(content).match(/https?:\/\/\S+\.(?:jpg|jpeg|png|webp)/i);
      if (m) parsed = { image_url: m[0] };
    }

    const imageUrl = parsed?.image_url;
    if (!imageUrl || !/^https?:\/\//i.test(imageUrl)) {
      console.warn("[perplexity-fallback] no usable image", { content: String(content).slice(0, 200) });
      return json(
        { ok: false, provider: "perplexity", error: "no_usable_image", latency_ms: latency },
        200
      );
    }

    console.log("[perplexity-fallback] ok", { latency, source: parsed?.source });
    return json({
      ok: true,
      provider: "perplexity",
      imageUrl,
      sourceUrl: parsed?.source || null,
      fallbackUsed: true,
      latency_ms: latency,
    });
  } catch (e) {
    console.error("[perplexity-fallback] error", e);
    return json(
      {
        ok: false,
        provider: "perplexity",
        error: e instanceof Error ? e.message : "perplexity_unknown_error",
      },
      200
    );
  }
});
