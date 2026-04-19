import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface QuizAnswer { occasion: string; style: string; craving: string }
interface Body {
  weather: { temp: number; condition: string; location?: string };
  aqi: { pm25: number; pm10: number; level: string };
  answers: QuizAnswer;
  gender?: "women" | "men" | "all";
}

const CATEGORY_KEYS = ["top", "bottom", "shoes", "outerwear", "accessory"];

function inferCategory(name: string, category?: string | null): string {
  const hay = `${name} ${category ?? ""}`.toLowerCase();
  if (/\b(coat|jacket|blazer|overcoat|parka|trench|cardigan)\b/.test(hay)) return "outerwear";
  if (/\b(shoe|sneaker|boot|loafer|heel|sandal|pump|mule)\b/.test(hay)) return "shoes";
  if (/\b(pant|trouser|jean|short|skirt|chino|denim|legging)\b/.test(hay)) return "bottom";
  if (/\b(bag|hat|scarf|belt|sunglass|watch|necklace|earring|jewelry|jewellery)\b/.test(hay)) return "accessory";
  if (/\b(shirt|tee|t-shirt|blouse|sweater|knit|top|hoodie|sweatshirt|tank|cami|dress)\b/.test(hay)) return "top";
  return "top";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = (await req.json()) as Body;
    const { weather, aqi, answers, gender = "all" } = body;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Pull a candidate pool from product_cache
    let q = supabase
      .from("product_cache")
      .select("id, name, brand, category, image_url, price, source_url, color_tags, style_tags")
      .eq("is_active", true)
      .not("image_url", "is", null)
      .order("trend_score", { ascending: false })
      .limit(180);

    const { data: pool, error: poolErr } = await q;
    if (poolErr) throw poolErr;

    // Light gender filter via keywords
    const filtered = (pool ?? []).filter((p) => {
      if (gender === "all") return true;
      const hay = `${p.name} ${p.category ?? ""}`.toLowerCase();
      if (gender === "women") return !/\b(men|mens|men's|boxer|necktie)\b/.test(hay);
      return !/\b(women|womens|women's|dress|skirt|blouse|heels|lingerie|bra)\b/.test(hay);
    });

    // Bucket by inferred category
    const buckets: Record<string, typeof filtered> = { top: [], bottom: [], shoes: [], outerwear: [], accessory: [] };
    for (const p of filtered) {
      const cat = inferCategory(p.name, p.category);
      buckets[cat].push(p);
    }

    // Build a compact catalog for the AI (id + name + category bucket)
    const catalog = CATEGORY_KEYS.flatMap((cat) =>
      (buckets[cat] ?? []).slice(0, 24).map((p) => ({
        id: p.id,
        name: p.name,
        brand: p.brand,
        category: cat,
        style_tags: p.style_tags ?? [],
        color_tags: p.color_tags ?? [],
      }))
    );

    if (catalog.length < 8) {
      return new Response(JSON.stringify({ error: "insufficient_catalog", looks: [] }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const systemPrompt = `You are a fashion stylist. Build 5 distinct outfit looks for today using ONLY products from the provided catalog (reference by id). Each look needs: top, bottom, shoes; optionally outerwear and one accessory. Match the weather, air quality, and the user's quiz answers. Return concise editorial titles and a 1-sentence reason.`;

    const userPrompt = `Weather: ${weather.temp}°C, ${weather.condition}${weather.location ? `, ${weather.location}` : ""}
Air quality: PM2.5 ${aqi.pm25}, PM10 ${aqi.pm10} (${aqi.level})
Quiz: occasion=${answers.occasion}, style=${answers.style}, craving=${answers.craving}
Gender: ${gender}

Catalog (use these ids only):
${JSON.stringify(catalog)}`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "return_looks",
              description: "Return 5 styled outfit looks",
              parameters: {
                type: "object",
                properties: {
                  looks: {
                    type: "array",
                    minItems: 5,
                    maxItems: 5,
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        vibe: { type: "string" },
                        reason: { type: "string" },
                        product_ids: {
                          type: "array",
                          items: { type: "string" },
                          minItems: 3,
                          maxItems: 5,
                        },
                      },
                      required: ["title", "vibe", "reason", "product_ids"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["looks"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "return_looks" } },
      }),
    });

    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI gateway error:", aiResp.status, t);
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "rate_limited" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "credits_exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      throw new Error(`AI gateway ${aiResp.status}`);
    }

    const aiJson = await aiResp.json();
    const toolCall = aiJson.choices?.[0]?.message?.tool_calls?.[0];
    const args = toolCall ? JSON.parse(toolCall.function.arguments) : { looks: [] };

    // Hydrate product ids back to full product objects
    const byId = new Map(filtered.map((p) => [p.id, p]));
    const looks = (args.looks ?? []).map((l: any, idx: number) => {
      const pieces = (l.product_ids ?? [])
        .map((id: string) => byId.get(id))
        .filter(Boolean)
        .map((p: any) => ({
          id: p.id,
          name: p.name,
          brand: p.brand,
          category: inferCategory(p.name, p.category),
          image_url: p.image_url,
          price: p.price,
          source_url: p.source_url,
          color: (p.color_tags?.[0] as string) ?? "#888888",
        }));
      return {
        id: `look-${idx}`,
        title: l.title,
        vibe: l.vibe,
        reason: l.reason,
        weatherTag: weather.condition,
        pieces,
      };
    }).filter((l: any) => l.pieces.length >= 3);

    return new Response(JSON.stringify({ looks }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("today-looks error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
