import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Optional auth — guests are now welcome
    let user: { id: string } | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      try {
        const token = authHeader.replace("Bearer ", "");
        const { data } = await supabase.auth.getUser(token);
        if (data?.user) user = { id: data.user.id };
      } catch {/* ignore — treat as guest */}
    }

    const body = await req.json().catch(() => ({}));
    const {
      type = "daily",
      weather,
      location,
      mood,
      searchQuery,
      searchTags = [],
      searchProducts = [],
    } = body || {};

    // Determine premium tier (used to pick model). All users get recs now.
    let isPremium = false;
    let style: any = null;
    let bodyProfile: any = null;
    let interactions: any[] = [];
    const recentOutfits: any[] = [];

    if (user) {
      const [subRes, styleRes, bodyRes, interactionsRes, recentRecsRes] = await Promise.all([
        supabase.from("subscriptions").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("style_profiles").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("body_profiles").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("interactions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
        supabase.from("daily_recommendations").select("outfits").eq("user_id", user.id).order("recommendation_date", { ascending: false }).limit(3),
      ]);
      const sub = subRes.data;
      isPremium = !!(sub && (sub.plan === "premium_trial" || sub.plan === "premium") &&
        sub.status === "active" &&
        (!sub.trial_end_date || new Date(sub.trial_end_date) > new Date()));
      style = styleRes.data;
      bodyProfile = bodyRes.data;
      interactions = interactionsRes.data || [];
      recentOutfits.push(...(recentRecsRes.data || []));
    }

    const recentOutfitSummary = recentOutfits.map((r: any) => {
      const outfits = r.outfits || [];
      return outfits.map((o: any) => o.label || o.top?.name).filter(Boolean).join(", ");
    }).filter(Boolean).join(" | ");

    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const today = new Date();
    const dayOfWeek = dayNames[today.getDay()];

    // Build search-signal context block (new)
    const searchContext = (() => {
      const lines: string[] = [];
      if (searchQuery) lines.push(`Current search intent: "${searchQuery}"`);
      if (Array.isArray(searchTags) && searchTags.length) lines.push(`Style signals: ${searchTags.slice(0, 8).join(", ")}`);
      if (Array.isArray(searchProducts) && searchProducts.length) {
        const sample = searchProducts.slice(0, 6).map((p: any) =>
          `${p.brand || ""} ${p.name || p.title || ""}`.trim()
        ).filter(Boolean);
        if (sample.length) lines.push(`Items they're browsing: ${sample.join(" | ")}`);
      }
      return lines.join("\n");
    })();

    const styleLine = style?.preferred_styles?.join(", ") || (searchTags.slice(0, 3).join(", ") || "minimal, clean");
    const dislikedLine = style?.disliked_styles?.join(", ") || "none";
    const fitLine = style?.preferred_fit || "regular";
    const budgetLine = style?.budget || "mid-range";
    const bodyLine = `${bodyProfile?.height_cm || "175"}cm, ${bodyProfile?.weight_kg || "70"}kg, ${bodyProfile?.silhouette_type || "balanced"} build`;

    // Helper: call AI (Perplexity for premium, Lovable AI for free)
    async function callAI(systemPrompt: string, userPrompt: string, maxTokens: number) {
      if (isPremium && PERPLEXITY_API_KEY) {
        const r = await fetch("https://api.perplexity.ai/chat/completions", {
          method: "POST",
          headers: { "Authorization": `Bearer ${PERPLEXITY_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "sonar",
            messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
            max_tokens: maxTokens,
            temperature: 0.65,
          }),
        });
        if (!r.ok) throw new Error(`Perplexity error ${r.status}`);
        const d = await r.json();
        return d.choices?.[0]?.message?.content || "";
      }
      // Fallback / free tier: Lovable AI Gateway
      if (!LOVABLE_API_KEY) throw new Error("No AI provider configured");
      const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
        }),
      });
      if (r.status === 429) throw new Error("rate_limited");
      if (r.status === 402) throw new Error("payment_required");
      if (!r.ok) throw new Error(`Lovable AI error ${r.status}`);
      const d = await r.json();
      return d.choices?.[0]?.message?.content || "";
    }

    if (type === "weekly") {
      const systemPrompt = `You are WARDROBE AI — a personal fashion stylist creating a weekly outfit plan. Respond ONLY with valid JSON, no markdown.`;
      const userPrompt = `Create a 5-day styling plan (Monday-Friday).
Style: ${styleLine}
Disliked: ${dislikedLine}
Fit: ${fitLine}
Budget: ${budgetLine}
Body: ${bodyLine}
Weather: ${weather?.temp || 22}°C, ${weather?.condition || "clear"} in ${location || "city"}
Recent outfits to AVOID: ${recentOutfitSummary || "none"}
${searchContext ? "\n" + searchContext : ""}

Return JSON: { "days": [{ "day": "Monday", "label": "Clean Work Fit", "mood_tag": "sharp", "outfit": { "top": { "name": "...", "color": "...", "style": "..." }, "bottom": {...}, "shoes": {...}, "outerwear": null, "accessories": null }, "explanation": "One sentence." }] }`;

      const content = await callAI(systemPrompt, userPrompt, 1200);
      let parsed: any;
      try {
        const m = content.match(/\{[\s\S]*\}/);
        parsed = m ? JSON.parse(m[0]) : { days: [] };
      } catch { parsed = { days: [], raw: content }; }

      if (user) {
        await supabase.from("daily_recommendations").upsert({
          user_id: user.id,
          recommendation_date: today.toISOString().split("T")[0],
          recommendation_type: "weekly",
          outfits: parsed.days || [],
          context: { weather, location, mood, searchQuery },
        }, { onConflict: "user_id,recommendation_date,recommendation_type" });
      }

      return new Response(JSON.stringify({ plan: parsed.days || [], cached: false, tier: isPremium ? "premium" : (user ? "trial" : "guest") }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Daily
    const count = searchContext ? 4 : 3;
    const systemPrompt = `You are WARDROBE AI — a personal fashion stylist. Respond ONLY with a valid JSON array, no markdown.`;
    const userPrompt = `Generate ${count} complete outfit options for today (${dayOfWeek}) that would look great on this person${searchContext ? " given what they're currently browsing" : ""}.
- Style: ${styleLine}
- Disliked: ${dislikedLine}
- Fit: ${fitLine}
- Budget: ${budgetLine}
- Body: ${bodyLine}
- Weather: ${weather?.temp || 22}°C, ${weather?.condition || "clear"} in ${location || "city"}
- Mood: ${mood || "neutral"}
- Recent outfits to avoid repeating: ${recentOutfitSummary || "none"}
${searchContext ? "\n" + searchContext : ""}

Return JSON array: [{ "label": "Effortless Minimal", "outfit": { "top": { "name": "...", "color": "...", "style": "..." }, "bottom": {...}, "shoes": {...}, "outerwear": null, "accessories": null }, "explanation": "Two short sentences on why this look suits them today." }]
Each outfit must be distinctly different in vibe and color.`;

    const content = await callAI(systemPrompt, userPrompt, 1000);
    let parsed: any[];
    try {
      const m = content.match(/\[[\s\S]*\]/);
      parsed = m ? JSON.parse(m[0]) : [];
    } catch { parsed = []; }

    if (user) {
      await supabase.from("daily_recommendations").upsert({
        user_id: user.id,
        recommendation_date: today.toISOString().split("T")[0],
        recommendation_type: searchQuery ? "search_recs" : "daily",
        outfits: parsed,
        context: { weather, location, mood, searchQuery },
      }, { onConflict: "user_id,recommendation_date,recommendation_type" });
    }

    return new Response(JSON.stringify({ outfits: parsed, cached: false, tier: isPremium ? "premium" : (user ? "trial" : "guest") }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("daily-stylist error:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    const status = msg === "rate_limited" ? 429 : msg === "payment_required" ? 402 : 500;
    return new Response(JSON.stringify({ error: msg }), {
      status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
