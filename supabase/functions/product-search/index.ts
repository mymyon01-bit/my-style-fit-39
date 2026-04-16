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

// ─── Source: DummyJSON ───
async function fetchDummyJSON(query: string, limit = 20): Promise<any[]> {
  try {
    const url = query
      ? `https://dummyjson.com/products/search?q=${encodeURIComponent(query)}&limit=${limit}`
      : `https://dummyjson.com/products?limit=${limit}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.products || []).map((p: any) => ({
      external_id: `dummyjson-${p.id}`,
      name: p.title,
      brand: p.brand || "Unknown",
      price: `$${p.price}`,
      category: mapDummyCategory(p.category),
      subcategory: p.category,
      style_tags: p.tags || [],
      color_tags: [],
      fit: "regular",
      image_url: p.thumbnail || (p.images?.[0]) || null,
      source_url: `https://dummyjson.com/products/${p.id}`,
      store_name: p.brand || "DummyJSON",
      reason: p.description?.slice(0, 80) || "Trending item",
      platform: "dummyjson",
      image_valid: true,
      is_active: true,
    }));
  } catch (e) {
    console.error("DummyJSON error:", e);
    return [];
  }
}

function mapDummyCategory(cat: string): string {
  const c = (cat || "").toLowerCase();
  if (c.includes("shirt") || c.includes("dress") || c.includes("top")) return "clothing";
  if (c.includes("shoe") || c.includes("boot")) return "shoes";
  if (c.includes("bag") || c.includes("hand")) return "bags";
  if (c.includes("watch") || c.includes("sun") || c.includes("jewel") || c.includes("accessor")) return "accessories";
  if (c.includes("fragrances") || c.includes("beauty") || c.includes("skin")) return "accessories";
  return "clothing";
}

// ─── Source: FakeStoreAPI ───
async function fetchFakeStore(category?: string): Promise<any[]> {
  try {
    const url = category
      ? `https://fakestoreapi.com/products/category/${encodeURIComponent(category)}`
      : "https://fakestoreapi.com/products";
    const res = await fetch(url);
    if (!res.ok) return [];
    const products = await res.json();
    return (products || [])
      .filter((p: any) => ["men's clothing", "women's clothing", "jewelery"].includes(p.category))
      .map((p: any) => ({
        external_id: `fakestore-${p.id}`,
        name: p.title?.slice(0, 100),
        brand: extractBrand(p.title),
        price: `$${p.price}`,
        category: p.category.includes("clothing") ? "clothing" : "accessories",
        subcategory: p.category,
        style_tags: inferStyleTags(p.title, p.description),
        color_tags: [],
        fit: "regular",
        image_url: p.image,
        source_url: `https://fakestoreapi.com/products/${p.id}`,
        store_name: "FakeStore",
        reason: p.description?.slice(0, 80) || "Popular item",
        platform: "fakestore",
        image_valid: true,
        is_active: true,
      }));
  } catch (e) {
    console.error("FakeStore error:", e);
    return [];
  }
}

function extractBrand(title: string): string {
  const brands = ["Nike", "Adidas", "Levi's", "Calvin Klein", "H&M", "Zara", "Gucci", "Prada"];
  for (const b of brands) {
    if (title?.toLowerCase().includes(b.toLowerCase())) return b;
  }
  return title?.split(" ").slice(0, 2).join(" ") || "Unknown";
}

function inferStyleTags(title: string, desc: string): string[] {
  const text = `${title} ${desc}`.toLowerCase();
  const tags: string[] = [];
  if (text.includes("casual")) tags.push("casual");
  if (text.includes("formal") || text.includes("slim fit")) tags.push("formal");
  if (text.includes("cotton") || text.includes("comfort")) tags.push("casual");
  if (text.includes("premium") || text.includes("elegant")) tags.push("classic");
  if (text.includes("sport") || text.includes("active")) tags.push("sporty");
  if (tags.length === 0) tags.push("casual");
  return tags;
}

// ─── Source: Commerce Scraper (Firecrawl-powered) ───
async function fetchFromCommerceScraper(query: string, limit = 15): Promise<any[]> {
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

  // Use upsert with platform+external_id unique constraint
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
    const { query, category, limit = 30, sources } = body;
    const supabase = getServiceClient();

    console.log(`product-search: query="${query || ""}", category="${category || ""}", limit=${limit}`);

    // Fetch from all open sources in parallel
    const enabledSources = sources || ["dummyjson", "fakestore"];
    const fetches: Promise<any[]>[] = [];

    if (enabledSources.includes("dummyjson")) {
      fetches.push(fetchDummyJSON(query || "", Math.min(limit, 30)));
    }
    if (enabledSources.includes("fakestore")) {
      fetches.push(fetchFakeStore(category === "clothing" ? "men's clothing" : undefined));
    }

    // Try commerce scraper (Firecrawl) for real products if query exists
    if (query && Deno.env.get("FIRECRAWL_API_KEY")) {
      fetches.push(fetchFromCommerceScraper(query, limit));
    }

    const results = await Promise.all(fetches);
    let allProducts = results.flat();

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

    // Limit
    allProducts = allProducts.slice(0, limit);

    // Cache to DB in background
    cacheToDB(supabase, allProducts).then(n => {
      if (n > 0) console.log(`Cached ${n} products from open APIs`);
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
      sources: enabledSources,
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
