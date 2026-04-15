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
    if (!PERPLEXITY_API_KEY) throw new Error("PERPLEXITY_API_KEY not configured");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from JWT
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error("Unauthorized");

    const { type, weather, location, mood } = await req.json();
    // type: "daily" | "weekly"

    // Check subscription
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    const isPremium = sub && (sub.plan === "premium_trial" || sub.plan === "premium") &&
      sub.status === "active" &&
      (!sub.trial_end_date || new Date(sub.trial_end_date) > new Date());

    if (!isPremium) {
      return new Response(JSON.stringify({ error: "premium_required", message: "Upgrade to Premium for daily styling" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch user data
    const [styleRes, bodyRes, interactionsRes, recentRecsRes] = await Promise.all([
      supabase.from("style_profiles").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("body_profiles").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("interactions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
      supabase.from("daily_recommendations").select("outfits").eq("user_id", user.id).order("recommendation_date", { ascending: false }).limit(3),
    ]);

    const style = styleRes.data;
    const body = bodyRes.data;
    const interactions = interactionsRes.data || [];
    const recentOutfits = recentRecsRes.data || [];

    // Build context for AI
    const recentOutfitSummary = recentOutfits.map((r: any) => {
      const outfits = r.outfits || [];
      return outfits.map((o: any) => o.label || o.top?.name).filter(Boolean).join(", ");
    }).filter(Boolean).join(" | ");

    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const today = new Date();
    const dayOfWeek = dayNames[today.getDay()];

    if (type === "weekly") {
      // Generate 5-day plan
      const systemPrompt = `You are WARDROBE AI — a premium personal fashion stylist creating a weekly outfit plan. Respond ONLY with valid JSON, no markdown.`;

      const userPrompt = `Create a 5-day styling plan (Monday-Friday) for someone with these details:
Style preferences: ${style?.preferred_styles?.join(", ") || "minimal, clean"}
Disliked styles: ${style?.disliked_styles?.join(", ") || "none"}
Fit preference: ${style?.preferred_fit || "regular"}
Budget: ${style?.budget || "mid-range"}
Body: ${body?.height_cm || "175"}cm, ${body?.weight_kg || "70"}kg, ${body?.silhouette_type || "balanced"} build
Current weather: ${weather?.temp || 22}°C, ${weather?.condition || "clear"} in ${location || "city"}
Recent outfits to AVOID repeating: ${recentOutfitSummary || "none"}

Return JSON: { "days": [{ "day": "Monday", "label": "Clean Work Fit", "mood_tag": "sharp", "outfit": { "top": { "name": "...", "color": "...", "style": "..." }, "bottom": { "name": "...", "color": "...", "style": "..." }, "shoes": { "name": "...", "color": "...", "style": "..." }, "outerwear": null, "accessories": null }, "explanation": "One sentence why this works today." }] }
Each day should have a different vibe. Ensure variety in colors and silhouettes across the week.`;

      const response = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${PERPLEXITY_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "sonar",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          max_tokens: 1200,
          temperature: 0.6,
        }),
      });

      if (!response.ok) throw new Error(`Perplexity error ${response.status}`);
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || "";

      // Parse JSON from response
      let parsed;
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { days: [] };
      } catch { parsed = { days: [], raw: content }; }

      // Cache
      await supabase.from("daily_recommendations").upsert({
        user_id: user.id,
        recommendation_date: today.toISOString().split("T")[0],
        recommendation_type: "weekly",
        outfits: parsed.days || [],
        context: { weather, location, mood },
      }, { onConflict: "user_id,recommendation_date,recommendation_type" });

      return new Response(JSON.stringify({ plan: parsed.days || [], cached: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else {
      // Daily: generate 3 outfits
      const systemPrompt = `You are WARDROBE AI — a premium personal fashion stylist. Respond ONLY with valid JSON array, no markdown.`;

      const userPrompt = `Generate 3 complete outfit options for today (${dayOfWeek}).
User profile:
- Style: ${style?.preferred_styles?.join(", ") || "minimal, clean"}
- Disliked: ${style?.disliked_styles?.join(", ") || "none"}
- Fit: ${style?.preferred_fit || "regular"}
- Budget: ${style?.budget || "mid-range"}
- Body: ${body?.height_cm || "175"}cm, ${body?.weight_kg || "70"}kg, ${body?.silhouette_type || "balanced"}
- Weather: ${weather?.temp || 22}°C, ${weather?.condition || "clear"} in ${location || "city"}
- Mood: ${mood || "neutral"}
- Recent outfits (avoid repeating): ${recentOutfitSummary || "none"}

Return JSON: [{ "label": "Effortless Minimal", "outfit": { "top": { "name": "...", "color": "...", "style": "..." }, "bottom": { "name": "...", "color": "...", "style": "..." }, "shoes": { "name": "...", "color": "...", "style": "..." }, "outerwear": null or { "name": "...", "color": "...", "style": "..." }, "accessories": null or { "name": "...", "color": "...", "style": "..." } }, "explanation": "2 sentences on why this look works for your mood and weather today." }]
Make each outfit distinctly different. One casual, one polished, one creative.`;

      const response = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${PERPLEXITY_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "sonar",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          max_tokens: 1000,
          temperature: 0.65,
        }),
      });

      if (!response.ok) throw new Error(`Perplexity error ${response.status}`);
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || "";

      let parsed;
      try {
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
      } catch { parsed = []; }

      // Cache
      await supabase.from("daily_recommendations").upsert({
        user_id: user.id,
        recommendation_date: today.toISOString().split("T")[0],
        recommendation_type: "daily",
        outfits: parsed,
        context: { weather, location, mood },
      }, { onConflict: "user_id,recommendation_date,recommendation_type" });

      return new Response(JSON.stringify({ outfits: parsed, cached: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (e) {
    console.error("daily-stylist error:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    const status = msg === "Unauthorized" ? 401 : msg.includes("premium") ? 403 : 500;
    return new Response(JSON.stringify({ error: msg }), {
      status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
