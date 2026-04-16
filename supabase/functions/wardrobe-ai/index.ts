import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── AI Provider abstraction ───

async function callPerplexity(systemPrompt: string, userPrompt: string, opts: { maxTokens?: number; temperature?: number; model?: string; timeoutMs?: number }) {
  const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");
  if (!PERPLEXITY_API_KEY) throw new Error("PERPLEXITY_API_KEY not configured");

  const controller = new AbortController();
  const timeoutMs = opts.timeoutMs || 8000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${PERPLEXITY_API_KEY}`, "Content-Type": "application/json" },
      signal: controller.signal,
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
  } finally {
    clearTimeout(timer);
  }

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
  opts: { maxTokens?: number; temperature?: number; timeoutMs?: number } = {}
): Promise<{ content: string; citations: string[]; tier: AITier }> {
  const usePerplexity = tier !== "free";
  const perplexityModel = tier === "premium" ? "sonar-pro" : "sonar";
  const temperature = tier === "premium" ? 0.45 : (opts.temperature || 0.5);
  const maxTokens = tier === "premium" ? 2000 : (opts.maxTokens || 1500);

  try {
    if (usePerplexity) {
      const result = await callPerplexity(systemPrompt, userPrompt, { maxTokens, temperature, model: perplexityModel, timeoutMs: opts.timeoutMs });
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
    if (sp.favorite_brands?.length) parts.push(`Favorite brands (reference only): ${sp.favorite_brands.join(", ")}`);
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

// ─── Unconscious behavior insight for search ───

function buildBehaviorInsight(userInfo: { styleProfile: any; recentInteractions: any[] }): string {
  const parts: string[] = [];
  
  // Analyze interaction patterns
  const likes = userInfo.recentInteractions.filter(i => i.event_type === "like");
  const dislikes = userInfo.recentInteractions.filter(i => i.event_type === "dislike");
  const saves = userInfo.recentInteractions.filter(i => i.event_type === "save");
  const views = userInfo.recentInteractions.filter(i => i.event_type === "view");
  
  if (likes.length > 3) {
    // Extract patterns from metadata
    const likedMeta = likes.map(l => l.metadata).filter(Boolean);
    const likedTabs = likedMeta.map((m: any) => m.tab).filter(Boolean);
    const uniqueTabs = [...new Set(likedTabs)];
    if (uniqueTabs.length > 0) parts.push(`User gravitates toward: ${uniqueTabs.join(", ")} categories`);
  }
  
  if (saves.length > 2) parts.push("User actively saves items — they're a deliberate shopper");
  if (dislikes.length > likes.length) parts.push("User is selective — prioritize quality over variety");
  if (views.length > 15) parts.push("User browses extensively — show diverse options");
  
  return parts.length > 0 ? `\n\nBehavior insight:\n${parts.join("\n")}` : "";
}

// ─── Product cache helpers ───

function isValidImageUrl(url: unknown): boolean {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  if (!trimmed || trimmed === "null" || trimmed === "undefined") return false;
  try {
    const u = new URL(trimmed);
    return u.protocol === "https:";
  } catch {
    return false;
  }
}

// ─── BLOCKED IMAGE DOMAINS: known unreliable or tracking-heavy sources ───
const BLOCKED_IMAGE_DOMAINS = [
  "via.placeholder.com",
  "placehold.it",
  "placekitten.com",
  "dummyimage.com",
  "fakeimg.pl",
  "picsum.photos",
  "lorempixel.com",
  "placeholder.com",
];

function isImageUrlSafe(url: string): boolean {
  if (!isValidImageUrl(url)) return false;
  try {
    const u = new URL(url);
    if (BLOCKED_IMAGE_DOMAINS.some(d => u.hostname.includes(d))) return false;
    // Block overly long URLs (likely tracking)
    if (url.length > 2000) return false;
    // Block data URIs disguised as URLs
    if (url.startsWith("data:")) return false;
    return true;
  } catch {
    return false;
  }
}

async function logImageFailures(supabase: any, products: any[], source: string) {
  const failed = products.filter(p => !isImageUrlSafe(p.image_url));
  if (failed.length === 0) return;

  const rows = failed.map(p => ({
    product_name: p.name || "Unknown",
    brand: p.brand || null,
    image_url: (p.image_url || "").slice(0, 500),
    failure_reason: !p.image_url ? "missing" : "invalid_url",
    source,
  }));

  await supabase.from("image_failures").insert(rows).then(({ error }: any) => {
    if (error) console.error("Image failure log error:", error.message);
  });
}

// ─── Smart cached product search with trust filtering ───

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
    .in("source_trust_level", ["high", "medium"]) // SECURITY: Only trusted sources
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

  let results = (data || [])
    .filter((p: any) => isImageUrlSafe(p.image_url)) // Double-check image safety
    .map((p: any) => ({
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
      platform: p.platform,
      _brand: p.brand,
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
      results.sort((a: any, b: any) => (b._relevance - a._relevance) || (b._trend - a._trend));
      const relevant = results.filter((r: any) => r._relevance > 0);
      if (relevant.length >= 4) results = relevant;
    }
  }

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

    // ─── Body description interpretation (lightweight) ───
    if (type === "body-description-interpret") {
      const descSystemPrompt = `You are a body proportion interpreter for a fashion fit system. The user describes their body in natural language (may be Korean or English). Convert this into structured adjustment signals.

Return ONLY valid JSON:
{
  "bodyType": "slim|regular|solid|heavy" or null (if no change implied),
  "hints": ["broad-shoulders", "narrow-shoulders", "long-legs", "short-legs", "short-torso", "long-torso", "thick-thighs", "slim-legs"],
  "fitPreferences": {
    "preferLonger": true/false,
    "preferLoose": true/false
  }
}

RULES:
- Only include hints that are clearly stated or strongly implied
- "어깨가 넓고" → "broad-shoulders"
- "허벅지가 두꺼운" → "thick-thighs"  
- "상체는 마르고 하체는 큼" → bodyType: "regular", hints: ["narrow-shoulders", "thick-thighs"]
- "기장은 길게" → fitPreferences.preferLonger = true
- "팔이 짧은 편" → no direct hint match, skip
- Be conservative — only return signals you're confident about`;

      const descUserPrompt = `User description: "${context.description}"
Current profile: height=${context.height}cm, weight=${context.weight}kg, type=${context.bodyType}, hints=${context.hints?.join(", ") || "none"}`;

      try {
        const result = await callLovableAI(descSystemPrompt, descUserPrompt, { maxTokens: 300, temperature: 0.2 });
        const parsed = extractJSON(result.content);
        return new Response(JSON.stringify({ adjustments: parsed || {} }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e) {
        console.error("Body description interpret error:", e);
        return new Response(JSON.stringify({ adjustments: {} }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ─── Search intent interpretation (fast, lightweight) ───
    if (action === "search-intent") {
      const personalization = buildPersonalizationContext(userInfo);
      
      // Build unconscious matching context from behavior
      const behaviorContext = buildBehaviorInsight(userInfo);
      
      // STRICT structured prompt — short output for speed (Perplexity must finish fast)
      const systemPrompt = `You convert a user's fashion search input into 6-10 real shopping search queries.

OUTPUT: ONLY a JSON object. No prose, no explanation, no markdown.

Schema:
{"queries":["..."],"category":"clothing|bags|shoes|accessories|null","style_tags":["..."],"color_direction":["..."],"fit_direction":"oversized|slim|relaxed|tailored|regular|null","emotional_tone":"...","interpreted_intent":"..."}

Rules:
- 6 to 10 queries, each 3-6 words.
- Every query MUST contain a product noun: jacket, coat, trousers, pants, jeans, shirt, hoodie, sweater, sneakers, boots, shoes, bag, tote, backpack, hat, watch, belt, blazer, dress, skirt, top, cardigan, vest, sandals, sunglasses.
- Mix categories (tops, bottoms, shoes, outerwear, bags, accessories) when input is a scenario/mood.
- For scenarios like "summer vacation": linen shirt, relaxed shorts, sandals, resort bag, sunglasses, lightweight sneakers.
- For specific items, refine with style + color + fit modifiers.
- Map moods: clean→minimal, sharp→tailored, lazy/chill→oversized, confident→bold, soft→relaxed light, dark→edgy black.
- interpreted_intent: ONE short sentence.
- Return JSON ONLY.`;

      const userPrompt = `Input: "${prompt}"${personalization}${behaviorContext}`;

      // HARD timeout inside edge function = 1800ms (frontend has its own soft 1s timeout)
      try {
        const result = await callAI(tier, systemPrompt, userPrompt, { maxTokens: 400, temperature: 0.3, timeoutMs: 1800 });
        const parsed = extractJSON(result.content);

        if (parsed?.queries?.length) {
          console.log(`search-intent OK (tier=${result.tier}, queries=${parsed.queries.length})`);
          return new Response(JSON.stringify({
            queries: parsed.queries.slice(0, 10),
            category: parsed.category || null,
            style_tags: parsed.style_tags || [],
            color_direction: parsed.color_direction || [],
            fit_direction: parsed.fit_direction || null,
            emotional_tone: parsed.emotional_tone || null,
            interpreted_intent: parsed.interpreted_intent || "",
            tier: result.tier,
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } catch (e) {
        console.error("Search intent error:", e instanceof Error ? e.message : e);
      }

      // Fallback: return raw query as-is
      return new Response(JSON.stringify({
        queries: [prompt],
        category: null,
        style_tags: [],
        interpreted_intent: prompt,
        tier: "fallback",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── Outfit image analysis (OOTD → product queries) ───
    if (action === "outfit-analyze") {
      const imageUrl = body.imageUrl;
      if (!imageUrl || typeof imageUrl !== "string") {
        return new Response(JSON.stringify({ error: "imageUrl required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const personalization = buildPersonalizationContext(userInfo);

      const analyzeSystemPrompt = `You are a fashion outfit analyzer. Analyze the outfit photo and extract structured data about what the person is wearing.

Return ONLY valid JSON:
{
  "overall_style": "minimal|street|modern|formal|casual|chic|sporty|bohemian|vintage",
  "color_palette": ["black", "white", "beige"],
  "fit_type": "oversized|slim|relaxed|tailored|regular",
  "items": [
    { "category": "TOPS|BOTTOMS|SHOES|BAGS|ACCESSORIES", "description": "black oversized hoodie", "color": "black", "fit": "oversized" },
    { "category": "BOTTOMS", "description": "baggy cargo pants", "color": "khaki", "fit": "relaxed" }
  ],
  "search_queries": [
    "oversized black hoodie streetwear",
    "baggy cargo pants khaki",
    "white chunky sneakers"
  ],
  "style_summary": "A relaxed streetwear look with oversized proportions and neutral tones.",
  "confidence": 0.85
}

Rules:
- Identify 2-5 items (top, bottom, shoes mandatory if visible; bag/accessories optional)
- Every search_query MUST include a product category keyword (hoodie, pants, sneakers, bag, etc.)
- Generate 3-6 search queries mixing the detected items
- Be specific about colors, fits, and styles
- If image is unclear, set confidence < 0.5 and provide best guess`;

      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) {
        return new Response(JSON.stringify({ error: "AI not configured" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      try {
        // Use vision model to analyze the image
        const visionResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: analyzeSystemPrompt },
              {
                role: "user",
                content: [
                  { type: "text", text: `Analyze this outfit photo and extract the style breakdown.${personalization}` },
                  { type: "image_url", image_url: { url: imageUrl } },
                ],
              },
            ],
            max_tokens: 800,
            temperature: 0.3,
          }),
        });

        if (!visionResponse.ok) {
          const errText = await visionResponse.text();
          console.error("Vision API error:", visionResponse.status, errText);
          throw new Error(`Vision API error (${visionResponse.status})`);
        }

        const visionData = await visionResponse.json();
        const content = visionData.choices?.[0]?.message?.content || "";
        const parsed = extractJSON(content);

        if (parsed && parsed.items?.length > 0) {
          return new Response(JSON.stringify({
            analysis: parsed,
            tier: tier,
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Fallback if parsing fails
        return new Response(JSON.stringify({
          analysis: {
            overall_style: "casual",
            color_palette: ["neutral"],
            fit_type: "regular",
            items: [],
            search_queries: [prompt || "casual outfit"],
            style_summary: "Could not fully analyze the outfit. Try a clearer photo.",
            confidence: 0.3,
          },
          tier: "fallback",
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e) {
        console.error("Outfit analyze error:", e);
        return new Response(JSON.stringify({
          error: e instanceof Error ? e.message : "Analysis failed",
        }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

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
    // SECURITY HARDENING: AI is ONLY used for search query interpretation and ranking.
    // AI MUST NOT fabricate products. It can only help find and rank real cached products.
    if (action === "recommend") {
      const supabase = getServiceClient();
      const itemCount = typeof body.count === "number" ? body.count : 12;

      // Step 1: Always try cache first with style-aware search
      const cachedResults = await getCachedProducts(supabase, {
        category: body.category,
        subcategory: body.subcategory,
        styles: body.styles,
        fit: body.fit,
        searchQuery: prompt,
        limit: itemCount,
      });

      if (cachedResults.length >= 4) {
        console.log(`Serving ${cachedResults.length} verified items from cache for: "${(prompt || "").slice(0, 60)}"`);
        return new Response(JSON.stringify({
          recommendations: cachedResults.slice(0, itemCount),
          tier: "cached",
          citations: [],
          fromCache: true,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Step 2: Use AI ONLY to generate better search queries for the commerce scraper
      // AI does NOT generate products — it generates search terms
      const personalization = buildPersonalizationContext(userInfo);
      
      const searchQuerySystemPrompt = `You are a fashion search query optimizer. Given a user's style request and preferences, generate 3 specific search queries that would find matching real products on fashion retailers (SSENSE, ASOS, Farfetch, Naver Shopping).

Return ONLY valid JSON:
{
  "queries": ["query1", "query2", "query3"],
  "category": "clothing|bags|shoes|accessories|null",
  "style_tags": ["tag1", "tag2"]
}

Rules:
- Queries should be concise, product-focused (e.g. "black oversized bomber jacket", "minimal leather tote bag")
- Do NOT generate product names, prices, or image URLs
- Do NOT fabricate brands or items
- Focus on searchable product descriptions`;

      const searchQueryUserPrompt = `User request: "${prompt}"${personalization}`;

      try {
        const aiResult = await callAI(tier, searchQuerySystemPrompt, searchQueryUserPrompt, { maxTokens: 300, temperature: 0.4 });
        const parsed = extractJSON(aiResult.content);
        
        if (parsed?.queries?.length) {
          // Trigger commerce scraper with AI-refined queries in background
          const baseUrl = Deno.env.get("SUPABASE_URL");
          const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
          
          if (baseUrl && serviceKey) {
            // Fire and forget — scraper will cache results for next request
            for (const q of parsed.queries.slice(0, 2)) {
              fetch(`${baseUrl}/functions/v1/commerce-scraper`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${serviceKey}`,
                },
                body: JSON.stringify({
                  query: q,
                  platforms: ["naver", "ssense", "farfetch", "asos"],
                  limit: 10,
                }),
              }).catch(e => console.error("Background scraper trigger error:", e));
            }
          }
        }
      } catch (e) {
        console.error("AI search query generation error:", e);
      }

      // Step 3: Return whatever real cached data we have (even if < 4)
      // The commerce scraper will populate the cache for future requests
      if (cachedResults.length > 0) {
        return new Response(JSON.stringify({
          recommendations: cachedResults,
          tier: "cached",
          citations: [],
          fromCache: true,
          expanding: true, // Signal to frontend that more results are being fetched
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Step 4: No cached results at all — return empty with expanding flag
      return new Response(JSON.stringify({
        recommendations: [],
        tier: "cached",
        citations: [],
        fromCache: true,
        expanding: true,
        message: "Searching for matching products. Please try again in a moment.",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── Existing type-based actions (styling advice, NOT product generation) ───
    let systemPrompt = "";
    let userPrompt = "";

    switch (type) {
      case "mood-styling": {
        const personalization = buildPersonalizationContext(userInfo);
        systemPrompt = `You are WARDROBE AI — a ${tier === "free" ? "helpful" : "premium personal"} fashion stylist. ${tier !== "free" ? "Respond in calm, confident, editorial tone." : "Be concise and helpful."} Give concise, actionable style advice under ${tier === "premium" ? "150" : "120"} words. Be specific about clothing types, colors, fabrics. Never use bullet points. Never say "I recommend." NEVER generate product listings or fake shopping results.`;
        userPrompt = `User mood: "${context.mood || "neutral"}". Weather: ${context.weather?.temp || 22}°C, ${context.weather?.condition || "clear"} in ${context.location || "unknown"}.${context.styles ? ` Style preferences: ${context.styles.join(", ")}.` : ""}${context.bodyType ? ` Body type: ${context.bodyType}.` : ""} Occasion: ${context.occasion || "daily"}.${personalization} Give personalized styling direction for today. Also suggest specific outfit pieces: a top, bottom, shoes, and optionally outerwear.`;
        break;
      }
      case "style-analysis": {
        systemPrompt = `You are a fashion analyst AI. Analyze style preferences and body data to generate a concise style profile. Be specific, editorial, and actionable. Under 150 words. NEVER generate product listings.`;
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
        const isFitPremium = body.fitMode === "premium";
        if (isFitPremium) {
          systemPrompt = `You are a premium fashion fit advisor. Provide detailed, confident analysis. Explain region-by-region fit implications, suggest styling adjustments if needed, and note brand-specific tendencies if recognizable. Be precise and editorial. Under 120 words. Never invent data.`;
          const allSizesText = context.allSizes?.map((s: any) => `${s.size}: score ${s.score}, ${s.regions}`).join(" | ") || "";
          userPrompt = `Product: ${context.productName} by ${context.productBrand} (${context.productCategory || "clothing"}, ${context.productFitType || "regular"} fit). Recommended Size: ${context.recommendedSize} (score: ${context.fitScore}/100). Alternate: ${context.alternateSize}. Product Data: ${context.productDataQuality}/100. Scan: ${context.scanQuality}/100. Regions: ${context.regionText}. All sizes: ${allSizesText}. Summary: ${context.summary}. Provide a detailed, premium fit analysis with regional insights and styling advice.`;
        } else {
          systemPrompt = `You are a concise fashion fit advisor. Never invent data. Only explain what you're given. Under 60 words.`;
          userPrompt = `Product: ${context.productName} by ${context.productBrand}. Recommended Size: ${context.recommendedSize} (score: ${context.fitScore}/100). Alternate: ${context.alternateSize}. Product Data: ${context.productDataQuality}/100. Scan: ${context.scanQuality}/100. Regions: ${context.regionText}. Summary: ${context.summary}. Write a natural, helpful explanation.`;
        }
        break;
      }
      case "body-scan-analysis": {
        const isScanPremium = body.fitMode === "premium";

        if (!LOVABLE_API_KEY) {
          return new Response(JSON.stringify({
            quality: context.hasBackPhoto ? 80 : 73,
            silhouette: "balanced",
            issues: ["AI not configured"],
            landmarks: {},
            measurements: null,
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        const baseScanPrompt = `You are a body proportion analyzer for fashion fit. Analyze the uploaded body scan photo(s) and estimate proportions for clothing size recommendation.

Return ONLY valid JSON:
{
  "quality": <number 50-95, based on image clarity, full body visibility, pose>,
  "silhouette": "<inverted-triangle|rectangle|trapezoid|hourglass|triangle|balanced>",
  "issues": ["<warning1>", "<warning2>"],
  "landmarks": {
    "head_visible": true/false,
    "feet_visible": true/false,
    "full_body": true/false,
    "pose_quality": "good|fair|poor",
    "lighting": "good|fair|poor",
    "clothing_fit": "fitted|moderate|loose"
  },
  "measurements": {
    "height_cm": <estimated or null>,
    "shoulder_width_cm": <estimated or null>,
    "chest_cm": <estimated or null>,
    "waist_cm": <estimated or null>,
    "hip_cm": <estimated or null>,
    "inseam_cm": <estimated or null>
  }
}

RULES:
- If head or feet are cut off, lower quality and add issue
- If clothing is very loose, note reduced accuracy for waist/hip
- Estimate proportions RELATIVE to each other even if absolute values are uncertain
- If only front photo, note depth estimation is limited
- Set measurements to null if you cannot estimate them
- Be conservative — never overstate confidence`;

        const premiumScanAddendum = `

PREMIUM MODE — Additional requirements:
- Cross-reference front and side photos for depth estimation
- Estimate shoulder-to-hip ratio more precisely using both angles
- Infer torso depth from side photo for chest/waist accuracy
- Classify frame type: narrow, medium, broad
- Add "frame_type" and "torso_depth_cm" to measurements if estimable
- Increase quality score ceiling to 98 if images are excellent
- Be more precise with measurements — use narrower estimation ranges`;

        const scanSystemPrompt = isScanPremium
          ? baseScanPrompt + premiumScanAddendum
          : baseScanPrompt;

        const messageContent: any[] = [
          { type: "text", text: `Analyze ${context.imageCount} body scan photo(s) (${context.imageTypes?.join(", ")}). Has back photo: ${context.hasBackPhoto}. Mode: ${isScanPremium ? "PREMIUM — high precision" : "standard"}.` },
        ];

        if (context.images?.length > 0) {
          for (const img of context.images) {
            if (img.dataUrl && img.dataUrl.startsWith("data:image")) {
              messageContent.push({ type: "image_url", image_url: { url: img.dataUrl } });
            }
          }
        }

        // Premium mode: use more capable model
        const scanModel = isScanPremium ? "google/gemini-2.5-pro" : "google/gemini-2.5-flash";
        const scanMaxTokens = isScanPremium ? 800 : 500;

        try {
          const visionResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: scanModel,
              messages: [
                { role: "system", content: scanSystemPrompt },
                { role: "user", content: messageContent },
              ],
              max_tokens: scanMaxTokens,
              temperature: 0.2,
            }),
          });

          if (!visionResponse.ok) {
            const errText = await visionResponse.text();
            console.error("Vision scan error:", visionResponse.status, errText);
            throw new Error(`Vision error (${visionResponse.status})`);
          }

          const visionData = await visionResponse.json();
          const content = visionData.choices?.[0]?.message?.content || "";
          const parsed = extractJSON(content);

          return new Response(JSON.stringify(parsed || {
            quality: context.hasBackPhoto ? 82 : 75,
            silhouette: "balanced",
            issues: [],
            landmarks: {},
            measurements: null,
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        } catch (e) {
          console.error("Body scan vision error:", e);
          return new Response(JSON.stringify({
            quality: context.hasBackPhoto ? 80 : 73,
            silhouette: "balanced",
            issues: ["Vision analysis failed — using basic assessment"],
            landmarks: {},
            measurements: null,
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }
      case "ootd-feedback": {
        systemPrompt = `You are a fashion community AI that gives brief, supportive style feedback on outfit photos. Be specific about what works and one subtle suggestion. Under 50 words. NEVER generate product listings.`;
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
