// AI-powered universal search across products, showrooms, OOTD posts, and creators.
// Calls Lovable AI Gateway to parse intent, then queries Supabase tables with PostgREST.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

type Intent = {
  keywords: string[];
  category: string | null;
  mood: string[];
  scopes: ("products" | "showrooms" | "looks" | "creators")[];
};

async function parseIntent(query: string): Promise<Intent> {
  const fallback: Intent = {
    keywords: query.split(/\s+/).filter(Boolean).slice(0, 6),
    category: null,
    mood: [],
    scopes: ["products", "showrooms", "looks", "creators"],
  };
  if (!LOVABLE_API_KEY) return fallback;

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": LOVABLE_API_KEY,
        "X-Lovable-AIG-SDK": "vercel-ai-sdk",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content:
              "You translate a fashion search query into a JSON intent. Reply ONLY with strict JSON of shape: {\"keywords\":string[], \"category\":string|null, \"mood\":string[], \"scopes\":(\"products\"|\"showrooms\"|\"looks\"|\"creators\")[]}. keywords: 1-6 short english tokens; category: one of clothing|dresses|tops|bottoms|shoes|outerwear|accessories or null; mood: 0-3 mood/style words; scopes: which result groups to query (default all four).",
          },
          { role: "user", content: query },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) return fallback;
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(text);
    return {
      keywords: Array.isArray(parsed.keywords) && parsed.keywords.length ? parsed.keywords : fallback.keywords,
      category: typeof parsed.category === "string" ? parsed.category : null,
      mood: Array.isArray(parsed.mood) ? parsed.mood : [],
      scopes:
        Array.isArray(parsed.scopes) && parsed.scopes.length
          ? parsed.scopes.filter((s: string) => ["products", "showrooms", "looks", "creators"].includes(s))
          : fallback.scopes,
    };
  } catch {
    return fallback;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { query } = await req.json();
    if (!query || typeof query !== "string") {
      return new Response(JSON.stringify({ error: "query required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const intent = await parseIntent(query.trim());
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });

    const tokens = intent.keywords.slice(0, 4);
    const ilike = (col: string) =>
      tokens.map((t) => `${col}.ilike.%${t.replace(/[%_]/g, "")}%`).join(",");

    const tasks: Promise<unknown>[] = [];
    const out: Record<string, unknown> = { intent };

    if (intent.scopes.includes("products")) {
      tasks.push(
        supabase
          .from("products")
          .select("id, title, brand, image_url, price, currency, product_url, category")
          .or(ilike("title") + "," + ilike("brand"))
          .limit(24)
          .then(({ data }) => { out.products = data ?? []; })
      );
    }
    if (intent.scopes.includes("showrooms")) {
      tasks.push(
        supabase
          .from("showrooms")
          .select("id, name, slug, description, cover_image_url, owner_id")
          .or(ilike("name") + "," + ilike("description"))
          .eq("is_public", true)
          .limit(12)
          .then(({ data }) => { out.showrooms = data ?? []; })
      );
    }
    if (intent.scopes.includes("looks")) {
      tasks.push(
        supabase
          .from("ootd_posts")
          .select("id, user_id, image_url, caption, style_tags, star_count, created_at")
          .or(ilike("caption"))
          .order("star_count", { ascending: false, nullsFirst: false })
          .limit(18)
          .then(({ data }) => { out.looks = data ?? []; })
      );
    }
    if (intent.scopes.includes("creators")) {
      tasks.push(
        supabase
          .from("profiles")
          .select("user_id, display_name, username, avatar_url")
          .or(ilike("display_name") + "," + ilike("username"))
          .limit(12)
          .then(({ data }) => { out.creators = data ?? []; })
      );
    }

    await Promise.all(tasks);

    return new Response(JSON.stringify(out), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
