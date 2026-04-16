import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function getServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

// ─── Source: Commerce Scraper (Firecrawl-powered, real products) ───
async function fetchFromCommerceScraper(query: string, limit = 20): Promise<any[]> {
  try {
    const baseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!baseUrl || !serviceKey) return [];

    const res = await fetch(`${baseUrl}/functions/v1/commerce-scraper`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        query,
        platforms: ["naver", "ssense", "farfetch", "asos", "ssg"],
        limit,
      }),
    });

    if (!res.ok) return [];
    const data = await res.json();
    return (data.products || []).map((p: any) => ({
      external_id: p.id,
      name: p.name,
      brand: p.brand,
      price: p.price,
      category: p.category,
      subcategory: p.subcategory,
      style_tags: p.style_tags || [],
      color_tags: p.color ? [p.color] : [],
      fit: p.fit || "regular",
      image_url: p.image_url,
      source_url: p.source_url,
      store_name: p.store_name,
      reason: p.reason,
      platform: p.platform,
      image_valid: true,
      is_active: true,
    }));
  } catch (e) {
    console.error("Commerce scraper fetch error:", e);
    return [];
  }
}

async function cacheToDB(supabase: any, products: any[]): Promise<number> {
  if (!products.length) return 0;

  const rows = products
    .filter(p => p.image_url && p.image_url.startsWith("http"))
    .map(p => ({
      external_id: p.external_id,
      name: p.name,
      brand: p.brand,
      price: p.price,
      category: p.category,
      subcategory: p.subcategory,
      style_tags: p.style_tags,
      color_tags: p.color_tags,
      fit: p.fit,
      image_url: p.image_url,
      source_url: p.source_url,
      store_name: p.store_name,
      reason: p.reason,
      platform: p.platform,
      image_valid: true,
      is_active: true,
      last_validated: new Date().toISOString(),
    }));

  const { error } = await supabase
    .from("product_cache")
    .upsert(rows, { onConflict: "platform,external_id", ignoreDuplicates: true });

  if (error) {
    console.error("Cache error:", error.message);
    return 0;
  }
  return rows.length;
}

// ─── Main handler ───
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const { query, category, limit = 30 } = body;
    const supabase = getServiceClient();

    console.log(`product-search: query="${query || ""}", category="${category || ""}", limit=${limit}`);

    // Fetch real products from commerce scraper (Firecrawl)
    let allProducts = await fetchFromCommerceScraper(query || "fashion trending", Math.min(limit, 30));

    // Filter by category if specified
    if (category) {
      const catLower = category.toLowerCase();
      const filtered = allProducts.filter(p => p.category?.toLowerCase() === catLower);
      if (filtered.length >= 4) allProducts = filtered;
    }

    // Filter by query relevance if text search
    if (query) {
      const terms = query.toLowerCase().split(/\s+/).filter((t: string) => t.length > 2);
      if (terms.length > 0) {
        allProducts = allProducts.map(p => {
          const text = `${p.name} ${p.brand} ${p.category} ${(p.style_tags || []).join(" ")}`.toLowerCase();
          const score = terms.filter((t: string) => text.includes(t)).length / terms.length;
          return { ...p, _relevance: score };
        });
        allProducts.sort((a: any, b: any) => b._relevance - a._relevance);
      }
    }

    // Remove duplicates by name similarity
    const seen = new Set<string>();
    allProducts = allProducts.filter(p => {
      const key = p.name.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 30);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Brand diversity: max 3 per brand
    const brandCount: Record<string, number> = {};
    allProducts = allProducts.filter(p => {
      const b = (p.brand || "").toLowerCase();
      brandCount[b] = (brandCount[b] || 0) + 1;
      return brandCount[b] <= 3;
    });

    // Platform diversity: max 5 per platform
    const platCount: Record<string, number> = {};
    allProducts = allProducts.filter(p => {
      const pl = (p.platform || "").toLowerCase();
      platCount[pl] = (platCount[pl] || 0) + 1;
      return platCount[pl] <= 5;
    });

    // Limit
    allProducts = allProducts.slice(0, limit);

    // Cache to DB in background
    cacheToDB(supabase, allProducts).then(n => {
      if (n > 0) console.log(`Cached ${n} products from commerce scraper`);
    }).catch(e => console.error("Cache error:", e));

    // Return normalized products
    const normalized = allProducts.map(p => ({
      id: p.external_id,
      name: p.name,
      brand: p.brand,
      price: p.price,
      category: p.category,
      subcategory: p.subcategory,
      reason: p.reason,
      style_tags: p.style_tags,
      color: (p.color_tags || [])[0] || "",
      fit: p.fit,
      image_url: p.image_url,
      source_url: p.source_url,
      store_name: p.store_name,
      platform: p.platform,
    }));

    return new Response(JSON.stringify({
      products: normalized,
      count: normalized.length,
      sources: ["commerce-scraper"],
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("product-search error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
