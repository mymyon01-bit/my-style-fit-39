// ─── FIT VISION ANALYZE ────────────────────────────────────────────────────
// Single edge function for all vision checks in the FIT pipeline. Uses
// Lovable AI (Gemini Flash) so we don't ship ML weights to the client.
//
// Modes:
//   "body"     → detect person bbox + pose quality on a user photo
//   "garment"  → detect garment type (upper/lower/full) + background
//   "output"   → validate a Replicate result against the original garment
//
// Always returns a stable JSON shape; never throws to the client.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Mode = "body" | "garment" | "output";

interface Body {
  mode: Mode;
  imageUrl?: string;        // body OR garment OR output to validate
  garmentImageUrl?: string; // for "output" mode (the original garment)
}

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const TOOLS_BY_MODE: Record<Mode, any> = {
  body: {
    type: "function",
    function: {
      name: "report_body",
      description: "Report person detection results for a try-on input photo.",
      parameters: {
        type: "object",
        properties: {
          person_present: { type: "boolean" },
          confidence: { type: "number", description: "0–1" },
          bbox: {
            type: "object",
            description: "Normalized 0–1 bounding box of the person.",
            properties: {
              x: { type: "number" }, y: { type: "number" },
              w: { type: "number" }, h: { type: "number" },
            },
            required: ["x", "y", "w", "h"],
            additionalProperties: false,
          },
          pose: { type: "string", enum: ["front", "three_quarter", "side", "back", "unclear"] },
          framing: { type: "string", enum: ["full_body", "upper_body", "head_only", "torso_crop"] },
          tilt_degrees: { type: "number", description: "Approximate rotation; 0 means upright." },
          issues: { type: "array", items: { type: "string" } },
        },
        required: ["person_present", "confidence", "bbox", "pose", "framing", "tilt_degrees", "issues"],
        additionalProperties: false,
      },
    },
  },
  garment: {
    type: "function",
    function: {
      name: "report_garment",
      description: "Classify a garment image for try-on.",
      parameters: {
        type: "object",
        properties: {
          garment_present: { type: "boolean" },
          type: { type: "string", enum: ["upper", "lower", "full", "accessory", "unknown"] },
          on_model: { type: "boolean", description: "True if the garment is shown on a person." },
          background_clean: { type: "boolean" },
          confidence: { type: "number" },
          issues: { type: "array", items: { type: "string" } },
        },
        required: ["garment_present", "type", "on_model", "background_clean", "confidence", "issues"],
        additionalProperties: false,
      },
    },
  },
  output: {
    type: "function",
    function: {
      name: "report_output",
      description: "Validate a generated try-on image.",
      parameters: {
        type: "object",
        properties: {
          person_present: { type: "boolean" },
          garment_visible: { type: "boolean" },
          garment_anchored: { type: "boolean", description: "True if the garment sits on the body, not floating." },
          mannequin: { type: "boolean" },
          duplicate_clothing: { type: "boolean" },
          distortion: { type: "string", enum: ["none", "mild", "severe"] },
          matches_garment: { type: "boolean", description: "True if the rendered garment matches the reference garment." },
          quality_score: { type: "number", description: "0–1 overall quality." },
          issues: { type: "array", items: { type: "string" } },
        },
        required: ["person_present", "garment_visible", "garment_anchored", "mannequin", "duplicate_clothing", "distortion", "matches_garment", "quality_score", "issues"],
        additionalProperties: false,
      },
    },
  },
};

const PROMPT_BY_MODE: Record<Mode, string> = {
  body:
    "Analyse the provided image as a try-on input photo. Detect the main person, " +
    "their normalized bounding box (0–1 coordinates from the top-left), pose orientation, " +
    "framing, and approximate upright tilt. List any issues that would hurt a virtual try-on.",
  garment:
    "Analyse the provided product image. Classify the garment as upper, lower, full, accessory, or unknown. " +
    "Note whether it is shown on a model and whether the background is clean.",
  output:
    "Compare the GENERATED try-on image (FIRST) against the REFERENCE garment (SECOND). " +
    "Verify a real person is present, the garment is anchored on the body (not floating, not centered as a sticker), " +
    "no mannequin, no duplicated clothing, no severe distortion, and the rendered garment matches the reference.",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY not configured" }, 500);

  try {
    const body = (await req.json()) as Body;
    if (!body?.mode || !body?.imageUrl) return json({ error: "mode and imageUrl required" }, 400);
    const tool = TOOLS_BY_MODE[body.mode];
    const prompt = PROMPT_BY_MODE[body.mode];
    if (!tool) return json({ error: "invalid mode" }, 400);

    const content: any[] = [{ type: "text", text: prompt }];
    content.push({ type: "image_url", image_url: { url: body.imageUrl } });
    if (body.mode === "output" && body.garmentImageUrl) {
      content.push({ type: "image_url", image_url: { url: body.garmentImageUrl } });
    }

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [{ role: "user", content }],
        tools: [tool],
        tool_choice: { type: "function", function: { name: tool.function.name } },
      }),
    });

    if (!r.ok) {
      const t = await r.text().catch(() => "");
      console.error("[fit-vision-analyze] gateway error", r.status, t.slice(0, 300));
      if (r.status === 429) return json({ error: "rate_limited" }, 429);
      if (r.status === 402) return json({ error: "credits_exhausted" }, 402);
      return json({ error: "vision_failed", status: r.status }, 502);
    }

    const data = await r.json();
    const call = data?.choices?.[0]?.message?.tool_calls?.[0];
    const argsStr = call?.function?.arguments;
    if (!argsStr) return json({ error: "no_tool_call" }, 502);

    let parsed: unknown;
    try {
      parsed = typeof argsStr === "string" ? JSON.parse(argsStr) : argsStr;
    } catch (e) {
      console.error("[fit-vision-analyze] parse failed", e);
      return json({ error: "bad_json" }, 502);
    }

    return json({ mode: body.mode, result: parsed });
  } catch (e) {
    console.error("[fit-vision-analyze] error", e);
    return json({ error: e instanceof Error ? e.message : "unknown" }, 500);
  }
});
