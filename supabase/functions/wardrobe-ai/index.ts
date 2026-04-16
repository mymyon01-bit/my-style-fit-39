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
  if (body.source === "homepage") return "homepage";
  if (isPremium) return "premium";
  if (userId) return "user";
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

function getServiceClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(supabaseUrl, supabaseKey);
}

async function getUserInfo(req: Request): Promise<{
  userId: string | null;
  isPremium: boolean;
  styleProfile: any | null;
  bodyProfile: any | null;
  recentInteractions: any[];
}> {
  const authHeader = req.headers.get("Authorization");
  const empty = { userId: null, isPremium: false, styleProfile: null, bodyProfile: null, recentInteractions: [] };
  if (!authHeader || !authHeader.startsWith("Bearer ")) return empty;

  const supabase = getServiceClient();
  const token = authHeader.replace("Bearer ", "");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (token === anonKey) return empty;

  try {
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return empty;

    const [subRes, styleRes, bodyRes, interactionsRes] = await Promise.all([
      supabase.from("subscriptions").select("plan, status, trial_end_date").eq("user_id", user.id).maybeSingle(),
      supabase.from("style_profiles").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("body_profiles").select("height_cm, weight_kg, shoulder_width_cm, waist_cm, silhouette_type").eq("user_id", user.id).maybeSingle(),
      supabase.from("interactions").select("target_id, event_type, metadata").eq("user_id", user.id).order("created_at", { ascending: false }).limit(30),
    ]);

    const sub = subRes.data;
    const isPremium = !!(sub && (sub.plan === "premium_trial" || sub.plan === "premium") &&
      sub.status === "active" &&
      (!sub.trial_end_date || new Date(sub.trial_end_date) > new Date()));

    return {
      userId: user.id,
      isPremium,
      styleProfile: styleRes.data || null,
      bodyProfile: bodyRes.data || null,
      recentInteractions: interactionsRes.data || [],
    };
  } catch {
    return empty;
  }
}

function buildPersonalizationContext(userInfo: { styleProfile: any; bodyProfile: any; recentInteractions: any[] }): string {
  const parts: string[] = [];

  if (userInfo.styleProfile) {
    const sp = userInfo.styleProfile;
    if (sp.preferred_styles?.length) parts.push(`Preferred styles: ${sp.preferred_styles.join(", ")}`);
    if (sp.disliked_styles?.length) parts.push(`Disliked styles: ${sp.disliked_styles.join(", ")} — AVOID these`);
    if (sp.preferred_fit) parts.push(`Preferred fit: ${sp.preferred_fit}`);
    if (sp.budget) parts.push(`Budget range: ${sp.budget}`);
    if (sp.favorite_brands?.length) parts.push(`Favorite brands (reference only, do NOT limit to these): ${sp.favorite_brands.join(", ")}`);
    if (sp.occasions?.length) parts.push(`Common occasions: ${sp.occasions.join(", ")}`);
  }

  if (userInfo.bodyProfile) {
    const bp = userInfo.bodyProfile;
    const bodyParts: string[] = [];
    if (bp.height_cm) bodyParts.push(`${bp.height_cm}cm tall`);
    if (bp.weight_kg) bodyParts.push(`${bp.weight_kg}kg`);
    if (bp.silhouette_type) bodyParts.push(`${bp.silhouette_type} build`);
    if (bodyParts.length) parts.push(`Body: ${bodyParts.join(", ")}`);
  }

  const liked = userInfo.recentInteractions.filter(i => i.event_type === "like").map(i => i.target_id);
  const disliked = userInfo.recentInteractions.filter(i => i.event_type === "dislike").map(i => i.target_id);
  if (liked.length) parts.push(`Recently liked items: ${liked.slice(0, 8).join(", ")}`);
  if (disliked.length) parts.push(`Recently disliked items: ${disliked.slice(0, 5).join(", ")} — avoid similar`);

  return parts.length > 0 ? `\n\nUser personalization data:\n${parts.join("\n")}` : "";
}

// ─── Product cache helpers ───

function isValidImageUrl(url: unknown): boolean {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  if (!trimmed || trimmed === "null" || trimmed === "undefined") return false;
  try {
    const u = new URL(trimmed);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

async function cacheProducts(supabase: any, products: any[], searchQuery: string) {
  const validProducts = products.filter(p => isValidImageUrl(p.image_url));
  if (validProducts.length === 0) return;

  const rows = validProducts.map(p => ({
    external_id: p.id,
    name: p.name,
    brand: p.brand || null,
    price: p.price || null,
    category: p.category || null,
    subcategory: p.subcategory || null,
    style_tags: p.style_tags || [],
    color_tags: p.color ? [p.color] : [],
    fit: p.fit || null,
    image_url: p.image_url,
    source_url: p.source_url || null,
    store_name: p.store_name || p.brand || null,
    reason: p.reason || null,
    image_valid: true,
    search_query: searchQuery.slice(0, 500),
  }));

  const { error } = await supabase
    .from("product_cache")
    .upsert(rows, { onConflict: "external_id", ignoreDuplicates: false });

  if (error) console.error("Cache insert error:", error.message);
  else console.log(`Cached ${rows.length} products for query: "${searchQuery.slice(0, 60)}"`);
}

async function logImageFailures(supabase: any, products: any[], source: string) {
  const failed = products.filter(p => !isValidImageUrl(p.image_url));
  if (failed.length === 0) return;

  const rows = failed.map(p => ({
    product_name: p.name || "Unknown",
    brand: p.brand || null,
    image_url: p.image_url || null,
    failure_reason: !p.image_url ? "missing" : "invalid_url",
    source,
  }));

  await supabase.from("image_failures").insert(rows).then(({ error }: any) => {
    if (error) console.error("Image failure log error:", error.message);
  });
}

// ─── Smart cached product search with style/text matching ───

async function getCachedProducts(supabase: any, opts: {
  category?: string;
  subcategory?: string;
  styles?: string[];
  fit?: string;
  color?: string;
  searchQuery?: string;
  limit?: number;
  excludeBrands?: string[];
}): Promise<any[]> {
  let query = supabase
    .from("product_cache")
    .select("*")
    .eq("image_valid", true)
    .eq("is_active", true)
    .order("trend_score", { ascending: false })
    .limit(opts.limit || 30);

  if (opts.category) query = query.eq("category", opts.category);
  if (opts.subcategory) query = query.eq("subcategory", opts.subcategory);
  if (opts.fit) query = query.eq("fit", opts.fit);
  if (opts.styles?.length) query = query.overlaps("style_tags", opts.styles);

  const { data, error } = await query;
  if (error) {
    console.error("Cache query error:", error.message);
    return [];
  }

  let results = (data || []).map((p: any) => ({
    id: p.external_id || p.id,
    name: p.name,
    brand: p.brand,
    price: p.price,
    category: p.category,
    subcategory: p.subcategory,
    reason: p.reason || "From your curated collection",
    style_tags: p.style_tags || [],
    color: (p.color_tags || [])[0] || "",
    fit: p.fit || "regular",
    image_url: p.image_url,
    source_url: p.source_url,
    store_name: p.store_name,
    _brand: p.brand, // keep for diversity
    _trend: p.trend_score || 0,
  }));

  // Text-based relevance scoring if searchQuery provided
  if (opts.searchQuery) {
    const terms = opts.searchQuery.toLowerCase().split(/\s+/).filter(t => t.length > 2);
    if (terms.length > 0) {
      results = results.map(r => {
        const text = `${r.name} ${r.brand} ${r.category} ${(r.style_tags || []).join(" ")} ${r.color} ${r.fit}`.toLowerCase();
        const matchCount = terms.filter(t => text.includes(t)).length;
        return { ...r, _relevance: matchCount / terms.length };
      });
      // Sort by relevance first, then trend
      results.sort((a: any, b: any) => (b._relevance - a._relevance) || (b._trend - a._trend));
      // Only keep items with some relevance
      const relevant = results.filter((r: any) => r._relevance > 0);
      if (relevant.length >= 4) results = relevant;
    }
  }

  // Apply brand diversity: max 2 items per brand in top results
  results = applyBrandDiversity(results, 2);

  return results.slice(0, opts.limit || 20);
}

// ─── Brand diversity enforcement ───

function applyBrandDiversity(items: any[], maxPerBrand: number): any[] {
  const brandCount: Record<string, number> = {};
  const diverse: any[] = [];
  const overflow: any[] = [];

  for (const item of items) {
    const brand = (item.brand || item._brand || "unknown").toLowerCase();
    const count = brandCount[brand] || 0;
    if (count < maxPerBrand) {
      diverse.push(item);
      brandCount[brand] = count + 1;
    } else {
      overflow.push(item);
    }
  }

  // Append overflow at the end for completeness
  return [...diverse, ...overflow];
}

// ─── Main handler ───

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const { type, context, action, prompt, quizAnswers, source } = body;

    const userInfo = await getUserInfo(req);
    const tier = determineTier(body, userInfo.userId, userInfo.isPremium);
    console.log(`AI routing: tier=${tier}, userId=${userInfo.userId?.slice(0, 8) || "guest"}, source=${source || "discover"}`);

    // ─── Browse action (DB-first, no AI) ───
    if (action === "browse") {
      const supabase = getServiceClient();
      const cached = await getCachedProducts(supabase, {
        category: body.category,
        subcategory: body.subcategory,
        styles: body.styles,
        fit: body.fit,
        searchQuery: body.searchQuery,
        limit: body.count || 20,
      });

      return new Response(JSON.stringify({
        recommendations: cached,
        tier: "cached",
        citations: [],
        fromCache: true,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── Recommend action ───
    if (action === "recommend") {
      const supabase = getServiceClient();
      const itemCount = body.count || (tier === "premium" ? "10-12" : tier === "user" ? "8-10" : "6-8");
      const excludeIds = body.excludeIds || [];
      const excludeClause = excludeIds.length > 0 ? `\nDo NOT include items with these IDs: ${excludeIds.join(", ")}. Generate completely different products.` : "";

      // Try cache first — for both browse AND search queries
      const cachedResults = await getCachedProducts(supabase, {
        category: body.category,
        subcategory: body.subcategory,
        styles: body.styles,
        fit: body.fit,
        searchQuery: prompt,
        limit: typeof itemCount === "number" ? itemCount : 12,
      });

      if (cachedResults.length >= 6) {
        console.log(`Serving ${cachedResults.length} items from cache for: "${(prompt || "").slice(0, 60)}"`);
        return new Response(JSON.stringify({
          recommendations: cachedResults.slice(0, typeof itemCount === "number" ? itemCount : 8),
          tier: "cached",
          citations: [],
          fromCache: true,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const personalization = buildPersonalizationContext(userInfo);

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
      "category": "clothing|bags|shoes|accessories",
      "subcategory": "e.g. sneakers|tote|formal|casual|boots|watch|belt",
      "reason": "Short explanation why this fits the user",
      "style_tags": ["tag1", "tag2"],
      "color": "#hex color of the item",
      "fit": "oversized|regular|slim",
      "image_url": "https://images.unsplash.com/photo-XXXXX?w=400&q=80",
      "source_url": "https://www.brandname.com/product-page",
      "store_name": "Brand Official Store"
    }
  ]
}

Category structure:
- clothing → men, women, unisex, formal, casual, street, sportswear
- bags → handbag, tote, crossbody, clutch, backpack
- shoes → sneakers, dress-shoes, boots, sandals
- accessories → belt, watch, sunglasses, hat, jewelry

CRITICAL RULES:
- BRAND DIVERSITY: Use a WIDE variety of brands. No single brand should appear more than twice. Include mainstream AND niche brands. Do NOT default to a small set of repeated brands.
- Interpret the user's query as a STYLE FEELING — match the aesthetic, mood, and vibe, not just keywords.
- Recommend REAL brands and realistic products
- Match the user's stated preferences precisely
- Always assign the correct category AND subcategory
- Include variety across categories unless a specific category is requested
- Prices should be realistic for the brand
- Colors should be hex values
- Keep reasons under 15 words
- Each id must be unique (use brand-name-slug format)
- Every product MUST have a valid image_url from a RELIABLE source.
  ALLOWED image sources (pick the most relevant):
  • Pexels: https://images.pexels.com/photos/{id}/pexels-photo-{id}.jpeg?auto=compress&w=400
  • Pixabay: https://cdn.pixabay.com/photo/{year}/{month}/{day}/{time}_{hash}.jpg
  • Brand CDN images from real retailer sites (e.g. images.asos-media.com, lp2.hm.com, static.zara.net, images.nike.com)
  DO NOT use Unsplash URLs — they frequently break.
  DO NOT use placeholder or generated URLs.
  Each image must be a real, publicly accessible fashion product photo.
- For source_url: Provide the REAL product page URL on the brand's official website or major retailer
- For store_name: Name of the retailer or brand store
- Use style_tags to describe the item's aesthetic (e.g. minimal, street, classic, edgy, chic, vintage, bohemian, sporty)${excludeClause}${personalization}${tier === "premium" ? "\n- Provide deeper style reasoning in explanations\n- Include more niche/designer brands alongside mainstream\n- Consider body profile for fit recommendations" : ""}`;

      const quizContext = quizAnswers
        ? `\nQuiz answers: Styles: ${quizAnswers.preferredStyles?.join(", ")}. Fit: ${quizAnswers.fitPreference}. Colors: ${quizAnswers.colorPreference}. Vibe: ${quizAnswers.dailyVibe}. Occasion: ${quizAnswers.occasionPreference}. Budget: ${quizAnswers.budgetRange}. Avoid: ${quizAnswers.dislikedStyles?.join(", ")}.`
        : "";

      const userPrompt = `User style request: "${prompt}"${quizContext}\n\nGenerate curated product recommendations. IMPORTANT: Use diverse brands — do not repeat the same brand more than twice.`;

      const result = await callAI(tier, systemPrompt, userPrompt, { maxTokens: 2200, temperature: 0.65 });
      const parsed = extractJSON(result.content);

      // Validate, filter imageless, and clean recommendations
      const allRecs = (parsed?.recommendations || []).map((r: any, i: number) => ({
        ...r,
        id: r.id || `rec-${Date.now()}-${i}`,
        image_url: r.image_url && isValidImageUrl(r.image_url) ? r.image_url : null,
        source_url: r.source_url && r.source_url.startsWith("http") ? r.source_url : null,
        store_name: r.store_name || r.brand || null,
      }));

      // STRICT: Only return products with valid images
      let recs = allRecs.filter((r: any) => isValidImageUrl(r.image_url));

      // Apply brand diversity on AI results too
      recs = applyBrandDiversity(recs, 2);

      // Cache valid products + log failures in background
      const cachePromise = cacheProducts(supabase, recs, prompt || "");
      const failurePromise = logImageFailures(supabase, allRecs, source || "discover");
      
      // Don't await — fire and forget
      Promise.all([cachePromise, failurePromise]).catch(e => console.error("Background task error:", e));

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
        const personalization = buildPersonalizationContext(userInfo);
        systemPrompt = `You are WARDROBE AI — a ${tier === "free" ? "helpful" : "premium personal"} fashion stylist. ${tier !== "free" ? "Respond in calm, confident, editorial tone." : "Be concise and helpful."} Give concise, actionable style advice under ${tier === "premium" ? "150" : "120"} words. Be specific about clothing types, colors, fabrics. Never use bullet points. Never say "I recommend."`;
        userPrompt = `User mood: "${context.mood || "neutral"}". Weather: ${context.weather?.temp || 22}°C, ${context.weather?.condition || "clear"} in ${context.location || "unknown"}.${context.styles ? ` Style preferences: ${context.styles.join(", ")}.` : ""}${context.bodyType ? ` Body type: ${context.bodyType}.` : ""} Occasion: ${context.occasion || "daily"}.${personalization} Give personalized styling direction for today. Also suggest specific outfit pieces: a top, bottom, shoes, and optionally outerwear.`;
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
