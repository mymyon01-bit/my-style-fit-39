import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace("Bearer ", "");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (token === anonKey) {
      return new Response(JSON.stringify({ error: "Auth required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { heightCm, bodyType, silhouette, hints, gender } = body;

    // Check if avatar already exists (prevent duplicate generation)
    const { data: existing } = await supabase
      .from("body_profiles")
      .select("body_avatar_url")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing?.body_avatar_url && !body.forceRegenerate) {
      return new Response(JSON.stringify({
        avatarUrl: existing.body_avatar_url,
        cached: true,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build avatar prompt from body profile
    const height = heightCm || 175;
    const type = bodyType || "regular";
    const sil = silhouette || "balanced";
    const genderHint = gender === "female" ? "feminine" : gender === "male" ? "masculine" : "androgynous";

    const hintDescriptions: string[] = [];
    if (hints?.includes("broad-shoulders")) hintDescriptions.push("broad shoulders");
    if (hints?.includes("narrow-shoulders")) hintDescriptions.push("narrow shoulders");
    if (hints?.includes("long-legs")) hintDescriptions.push("long legs");
    if (hints?.includes("short-legs")) hintDescriptions.push("shorter legs");
    if (hints?.includes("thick-thighs")) hintDescriptions.push("fuller thighs");
    if (hints?.includes("slim-legs")) hintDescriptions.push("slim legs");
    if (hints?.includes("long-torso")) hintDescriptions.push("longer torso");
    if (hints?.includes("short-torso")) hintDescriptions.push("shorter torso");

    const bodyDesc = `${type} build, ${sil} silhouette, ${genderHint} proportions${hintDescriptions.length > 0 ? ", " + hintDescriptions.join(", ") : ""}`;

    const prompt = `Create a clean, minimal fashion mannequin silhouette illustration for a fashion app. Full body, front-facing, standing straight, neutral pose. The figure should have a ${bodyDesc}. Style: elegant line art on a pure black background (#0a0a0a), using soft muted purple/lavender tones for the body outline. No face details, no clothing, just a clean anatomical silhouette showing body proportions. Modern, editorial, premium fashion aesthetic. The figure should be centered and take up about 80% of the vertical space.`;

    console.log(`Generating avatar for user ${user.id.slice(0, 8)}, body: ${bodyDesc}`);

    // Generate avatar using AI image generation
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI image generation error:", aiResponse.status, errText);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, try again shortly" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI generation failed (${aiResponse.status})`);
    }

    const aiData = await aiResponse.json();
    const imageDataUrl = aiData.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!imageDataUrl || !imageDataUrl.startsWith("data:image")) {
      console.error("No image in AI response");
      return new Response(JSON.stringify({ error: "Avatar generation failed — no image returned" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Convert base64 to blob and upload to storage
    const base64Data = imageDataUrl.split(",")[1];
    const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    const storagePath = `${user.id}/avatar-${Date.now()}.png`;

    const { error: uploadError } = await supabase.storage
      .from("body-scans")
      .upload(storagePath, binaryData, {
        contentType: "image/png",
        cacheControl: "31536000", // 1 year cache
        upsert: true,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      throw new Error("Failed to store avatar");
    }

    // Get signed URL (private bucket)
    const { data: signedUrl } = await supabase.storage
      .from("body-scans")
      .createSignedUrl(storagePath, 60 * 60 * 24 * 365); // 1 year

    const avatarUrl = signedUrl?.signedUrl || null;

    if (!avatarUrl) {
      throw new Error("Failed to generate signed URL");
    }

    // Save to body_profiles
    await supabase.from("body_profiles").upsert({
      user_id: user.id,
      body_avatar_url: avatarUrl,
    }, { onConflict: "user_id" });

    console.log(`Avatar generated and stored for user ${user.id.slice(0, 8)}`);

    return new Response(JSON.stringify({
      avatarUrl,
      cached: false,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Avatar generation error:", e);
    return new Response(JSON.stringify({
      error: e instanceof Error ? e.message : "Unknown error",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
