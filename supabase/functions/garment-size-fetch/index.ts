// ─── GARMENT SIZE FETCHER ───────────────────────────────────────────────────
// On-demand: when the client doesn't find DB measurements for a (productKey,
// size) pair, it calls this function. We fetch the product page, ask Lovable
// AI (gemini-2.5-flash-lite — cheapest tier per project rules) to extract the
// size chart, then upsert into garment_measurements.
//
// Always returns 200 with { ok, inserted, error } so the client can decide
// whether to re-run resolveGarmentSize() or fall back to the estimator.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LOVABLE_MODEL = "google/gemini-2.5-flash-lite"; // cheapest tier
const FETCH_TIMEOUT_MS = 12_000;
const AI_TIMEOUT_MS = 22_000;

interface RequestBody {
  productKey: string;
  productId?: string | null;
  productUrl?: string | null;
  productName?: string | null;
  brand?: string | null;
  category?: string | null;
  selectedSize: string;
}

interface SizeRow {
  size_label: string;
  shoulder_cm?: number | null;
  chest_cm?: number | null;
  waist_cm?: number | null;
  hip_cm?: number | null;
  sleeve_cm?: number | null;
  total_length_cm?: number | null;
  thigh_cm?: number | null;
  inseam_cm?: number | null;
  rise_cm?: number | null;
  stretch_factor?: number | null;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function fetchProductHtml(url: string): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    clearTimeout(t);
    if (!res.ok) return null;
    const html = await res.text();
    return html.slice(0, 200_000); // cap to keep AI prompt manageable
  } catch {
    return null;
  }
}

/** Strip script/style/svg and collapse whitespace so the AI sees less noise. */
function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 50_000);
}

interface AiExtractionResult {
  rows: SizeRow[];
  category?: string | null;
}

async function aiExtractSizeChart(
  apiKey: string,
  args: { productName?: string | null; brand?: string | null; category?: string | null; text: string },
): Promise<AiExtractionResult | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), AI_TIMEOUT_MS);
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      signal: ctrl.signal,
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: LOVABLE_MODEL,
        messages: [
          {
            role: "system",
            content:
              "Extract garment size measurements from raw product page text. Return values in centimeters. If the page lists inches, convert (1 in = 2.54 cm). If a size or measurement is absent, omit it (do NOT guess). Use the exact size labels printed on the page (e.g. XS, S, M, L, XL, 28, 30, 32, EU 38).",
          },
          {
            role: "user",
            content: `Product: ${args.productName ?? ""}\nBrand: ${args.brand ?? ""}\nCategory: ${args.category ?? ""}\n\nText:\n${args.text}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "save_size_chart",
              description: "Save extracted size chart rows.",
              parameters: {
                type: "object",
                properties: {
                  category: { type: "string", description: "tops|shirts|hoodies|jackets|outerwear|dresses|pants|jeans|skirts|bottoms|other" },
                  rows: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        size_label: { type: "string" },
                        shoulder_cm: { type: "number" },
                        chest_cm: { type: "number" },
                        waist_cm: { type: "number" },
                        hip_cm: { type: "number" },
                        sleeve_cm: { type: "number" },
                        total_length_cm: { type: "number" },
                        thigh_cm: { type: "number" },
                        inseam_cm: { type: "number" },
                        rise_cm: { type: "number" },
                        stretch_factor: { type: "number" },
                      },
                      required: ["size_label"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["rows"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "save_size_chart" } },
      }),
    });
    clearTimeout(t);
    if (!res.ok) {
      console.warn("[size-fetch] AI status", res.status);
      return null;
    }
    const data = await res.json();
    const tc = data?.choices?.[0]?.message?.tool_calls?.[0];
    if (!tc?.function?.arguments) return null;
    const parsed = JSON.parse(tc.function.arguments);
    if (!Array.isArray(parsed?.rows)) return null;
    return { rows: parsed.rows as SizeRow[], category: parsed.category ?? null };
  } catch (e) {
    console.warn("[size-fetch] AI call failed", e);
    return null;
  } finally {
    clearTimeout(t);
  }
}

function normalizeSize(s: string): string {
  return (s || "").trim().toUpperCase();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

  try {
    const body = (await req.json()) as RequestBody;
    if (!body?.productKey || !body?.selectedSize) {
      return json({ ok: false, error: "productKey + selectedSize required" }, 400);
    }
    if (!LOVABLE_API_KEY) {
      return json({ ok: false, error: "LOVABLE_API_KEY missing" }, 200);
    }
    if (!body.productUrl) {
      return json({ ok: false, error: "no_product_url_to_scrape" }, 200);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Idempotency: skip if we already have this size in the last 7 days.
    const { data: fresh } = await admin
      .from("garment_measurements")
      .select("id, updated_at")
      .eq("product_key", body.productKey)
      .eq("size_label", normalizeSize(body.selectedSize))
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (fresh) {
      const ageMs = Date.now() - new Date(fresh.updated_at).getTime();
      if (ageMs < 7 * 24 * 60 * 60 * 1000) {
        return json({ ok: true, cached: true, inserted: 0 });
      }
    }

    const html = await fetchProductHtml(body.productUrl);
    if (!html) return json({ ok: false, error: "fetch_failed" });

    const text = stripHtml(html);
    const extracted = await aiExtractSizeChart(LOVABLE_API_KEY, {
      productName: body.productName,
      brand: body.brand,
      category: body.category,
      text,
    });
    if (!extracted || extracted.rows.length === 0) {
      return json({ ok: false, error: "no_size_chart_found" });
    }

    const category =
      (extracted.category || body.category || "other").toLowerCase();
    const rows = extracted.rows
      .filter((r) => r.size_label)
      .map((r) => ({
        product_key: body.productKey,
        product_id: body.productId ?? null,
        size_label: normalizeSize(r.size_label),
        category,
        source: "scrape",
        source_url: body.productUrl ?? null,
        confidence: "medium",
        shoulder_cm: r.shoulder_cm ?? null,
        chest_cm: r.chest_cm ?? null,
        waist_cm: r.waist_cm ?? null,
        hip_cm: r.hip_cm ?? null,
        sleeve_cm: r.sleeve_cm ?? null,
        total_length_cm: r.total_length_cm ?? null,
        thigh_cm: r.thigh_cm ?? null,
        inseam_cm: r.inseam_cm ?? null,
        rise_cm: r.rise_cm ?? null,
        stretch_factor: r.stretch_factor ?? null,
        raw_extraction: r as unknown as Record<string, unknown>,
      }));

    // Upsert one row at a time so we don't lose all rows on a single conflict.
    let inserted = 0;
    for (const row of rows) {
      const { error } = await admin
        .from("garment_measurements")
        .upsert(row, { onConflict: "product_key,size_label" });
      if (!error) inserted += 1;
      else console.warn("[size-fetch] upsert error", error.message);
    }

    return json({ ok: true, inserted, total: rows.length });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : String(e) });
  }
});
