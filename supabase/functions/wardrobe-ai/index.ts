import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── AI Provider abstraction ───

async function callPerplexity(systemPrompt: string, userPrompt: string, opts: { maxTokens?: number; temperature?: number; model?: string }) {
  const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");
  if (!PERPLEXITY_API_KEY) throw new Error("PERPLEXITY_API_KEY not configured");

  const response = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${PERPLEXITY_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: opts.model || "sonar",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: opts.maxTokens || 1500,
      temperature: opts.temperature || 0.5,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("Perplexity error:", response.status, errText);
    throw new Error(`Perplexity error (${response.status})`);
  }

  const data = await response.json();
  return {
    content: data.choices?.[0]?.message?.content || "",
    citations: data.citations || [],
  };
}

async function callLovableAI(systemPrompt: string, userPrompt: string, opts: { maxTokens?: number; temperature?: number }) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: opts.maxTokens || 1500,
      temperature: opts.temperature || 0.5,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("Lovable AI error:", response.status, errText);
    if (response.status === 429) throw new Error("Rate limited — please try again shortly.");
    if (response.status === 402) throw new Error("AI credits exhausted.");
    throw new Error(`Lovable AI error (${response.status})`);
  }

  const data = await response.json();
  return {
    content: data.choices?.[0]?.message?.content || "",
    citations: [],
  };
}

// ─── Tier routing ───

type AITier = "free" | "user" | "premium" | "homepage";

function determineTier(body: any, userId: string | null, isPremium: boolean): AITier {
  // Homepage always gets Perplexity
  if (body.source === "homepage") return "homepage";
  // Premium users get enhanced Perplexity
  if (isPremium) return "premium";
  // Logged-in users get standard Perplexity
  if (userId) return "user";
  // Free/guest gets Lovable AI
  return "free";
}

async function callAI(
  tier: AITier,
  systemPrompt: string,
  userPrompt: string,
  opts: { maxTokens?: number; temperature?: number } = {}
): Promise<{ content: string; citations: string[]; tier: AITier }> {
  const usePerplexity = tier !== "free";
  const perplexityModel = tier === "premium" ? "sonar-pro" : "sonar";
  const temperature = tier === "premium" ? 0.45 : (opts.temperature || 0.5);
  const maxTokens = tier === "premium" ? 2000 : (opts.maxTokens || 1500);

  try {
    if (usePerplexity) {
      const result = await callPerplexity(systemPrompt, userPrompt, { maxTokens, temperature, model: perplexityModel });
      return { ...result, tier };
    } else {
      const result = await callLovableAI(systemPrompt, userPrompt, { maxTokens, temperature });
      return { ...result, tier };
    }
  } catch (e) {
    // Fallback: if Perplexity fails, fall back to Lovable AI
    if (usePerplexity) {
      console.warn(`Perplexity failed for tier "${tier}", falling back to Lovable AI:`, e);
      try {
        const result = await callLovableAI(systemPrompt, userPrompt, { maxTokens: opts.maxTokens || 1500, temperature: opts.temperature || 0.5 });
        return { ...result, tier: "free" };
      } catch (fallbackErr) {
        console.error("Lovable AI fallback also failed:", fallbackErr);
        throw fallbackErr;
      }
    }
    throw e;
  }
}

// ─── Helpers ───

function extractJSON(content: string): any | null {
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
  } catch {}
  try {
    const arrMatch = content.match(/\[[\s\S]*\]/);
    if (arrMatch) return JSON.parse(arrMatch[0]);
  } catch {}
  return null;
}

async function getUserInfo(req: Request): Promise<{ userId: string | null; isPremium: boolean }> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return { userId: null, isPremium: false };

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const token = authHeader.replace("Bearer ", "");
  // Skip if it's the anon key itself
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (token === anonKey) return { userId: null, isPremium: false };

  try {
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return { userId: null, isPremium: false };

    const { data: sub } = await supabase
      .from("subscriptions")
      .select("plan, status, trial_end_date")
      .eq("user_id", user.id)
      .maybeSingle();

    const isPremium = !!(sub && (sub.plan === "premium_trial" || sub.plan === "premium") &&
      sub.status === "active" &&
      (!sub.trial_end_date || new Date(sub.trial_end_date) > new Date()));

    return { userId: user.id, isPremium };
  } catch {
    return { userId: null, isPremium: false };
  }
}

// ─── Main handler ───

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const { type, context, action, prompt, quizAnswers, source } = body;

    // Determine AI tier
    const { userId, isPremium } = await getUserInfo(req);
    const tier = determineTier(body, userId, isPremium);
    console.log(`AI routing: tier=${tier}, userId=${userId?.slice(0, 8) || "guest"}, source=${source || "discover"}`);

    // ─── Recommend action ───
    if (action === "recommend") {
      const itemCount = body.count || (tier === "premium" ? "10-12" : tier === "user" ? "8-10" : "6-8");
      const excludeIds = body.excludeIds || [];
      const excludeClause = excludeIds.length > 0 ? `\nDo NOT include items with these IDs: ${excludeIds.join(", ")}. Generate completely different products.` : "";

      const systemPrompt = `You are WARDROBE AI — a ${tier === "free" ? "helpful" : "premium"} fashion recommendation engine. Based on the user's style description, generate ${itemCount} curated product recommendations.

IMPORTANT: Return ONLY valid JSON, no markdown, no explanation text.

Return format:
{
  "recommendations": [
    {
      "id": "unique-id",
      "name": "Product Name",
      "brand": "Brand Name",
      "price": "$XXX",
      "category": "tops|bottoms|outerwear|shoes|accessories|bags|jewelry",
      "reason": "Short explanation why this fits the user",
      "style_tags": ["tag1", "tag2"],
      "color": "#hex color of the item",
      "fit": "oversized|regular|slim",
      "image_url": "https://images.unsplash.com/photo-XXXXX?w=400&q=80"
    }
  ]
}

Rules:
- Recommend REAL brands and realistic products
- Match the user's stated preferences precisely
- Include variety across categories
- Prices should be realistic
- Colors should be hex values
- Keep reasons under 15 words
- Each id must be unique (use brand-name-slug format)
- For image_url: Use real Unsplash image URLs that match the product type. Use format: https://images.unsplash.com/photo-{id}?w=400&q=80. Choose fashion/clothing photos that match the item category and color.${excludeClause}${tier === "premium" ? "\n- Provide deeper style reasoning in explanations\n- Include more niche/designer brands alongside mainstream" : ""}`;

      const quizContext = quizAnswers
        ? `\nQuiz answers: Styles: ${quizAnswers.preferredStyles?.join(", ")}. Fit: ${quizAnswers.fitPreference}. Colors: ${quizAnswers.colorPreference}. Vibe: ${quizAnswers.dailyVibe}. Occasion: ${quizAnswers.occasionPreference}. Budget: ${quizAnswers.budgetRange}. Avoid: ${quizAnswers.dislikedStyles?.join(", ")}.`
        : "";

      const userPrompt = `User style request: "${prompt}"${quizContext}\n\nGenerate curated product recommendations.`;

      const result = await callAI(tier, systemPrompt, userPrompt, { maxTokens: 2200, temperature: 0.6 });
      const parsed = extractJSON(result.content);

      // Validate and clean recommendations
      const recs = (parsed?.recommendations || []).map((r: any, i: number) => ({
        ...r,
        id: r.id || `rec-${Date.now()}-${i}`,
        image_url: r.image_url && r.image_url.startsWith("http") ? r.image_url : null,
      }));

      return new Response(JSON.stringify({
        recommendations: recs,
        tier: result.tier,
        citations: result.citations,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── Existing type-based actions ───
    let systemPrompt = "";
    let userPrompt = "";

    switch (type) {
      case "mood-styling": {
        systemPrompt = `You are WARDROBE AI — a ${tier === "free" ? "helpful" : "premium personal"} fashion stylist. ${tier !== "free" ? "Respond in calm, confident, editorial tone." : "Be concise and helpful."} Give concise, actionable style advice under ${tier === "premium" ? "150" : "120"} words. Be specific about clothing types, colors, fabrics. Never use bullet points. Never say "I recommend."`;
        userPrompt = `User mood: "${context.mood || "neutral"}". Weather: ${context.weather?.temp || 22}°C, ${context.weather?.condition || "clear"} in ${context.location || "unknown"}.${context.styles ? ` Style preferences: ${context.styles.join(", ")}.` : ""}${context.bodyType ? ` Body type: ${context.bodyType}.` : ""} Occasion: ${context.occasion || "daily"}. Give personalized styling direction for today. Also suggest specific outfit pieces: a top, bottom, shoes, and optionally outerwear.`;
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

    const result = await callAI(tier, systemPrompt, userPrompt, { maxTokens: 400, temperature: 0.5 });

    return new Response(JSON.stringify({
      response: result.content,
      citations: result.citations,
      tier: result.tier,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("wardrobe-ai error:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    const status = msg.includes("Rate limited") ? 429 : msg.includes("credits") ? 402 : 500;
    return new Response(JSON.stringify({ error: msg }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
