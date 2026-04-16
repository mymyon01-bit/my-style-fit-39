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

// ─── DB-first: load cached products ───
async function loadFromDB(supabase: any, opts: {
  query?: string;
  category?: string;
  styles?: string[];
  fit?: string;
  limit: number;
  excludeIds?: string[];
  randomize?: boolean;
}): Promise<any[]> {
  let q = supabase
    .from("product_cache")
    .select("*")
    .eq("image_valid", true)
    .eq("is_active", true);

  if (opts.category) q = q.eq("category", opts.category);
  if (opts.fit) q = q.eq("fit", opts.fit);
  if (opts.styles?.length) q = q.overlaps("style_tags", opts.styles);

  // For freshness: randomize by ordering on created_at desc then shuffling
  q = q.order("trend_score", { ascending: false }).limit(opts.limit * 3);

  const { data, error } = await q;
  if (error || !data) return [];

  let results = data.filter((p: any) => p.image_url?.startsWith("https"));

  // Text relevance filter
  if (opts.query) {
    const terms = opts.query.toLowerCase().split(/\s+/).filter((t: string) => t.length > 2);
    if (terms.length > 0) {
      results = results.map((p: any) => {
        const text = `${p.name} ${p.brand} ${p.category} ${(p.style_tags || []).join(" ")} ${(p.color_tags || []).join(" ")}`.toLowerCase();
        const score = terms.filter((t: string) => text.includes(t)).length / terms.length;
        return { ...p, _relevance: score };
      });
      // Keep items with at least partial match, but sort by relevance
      results.sort((a: any, b: any) => b._relevance - a._relevance);
      // Only keep items with some relevance for text searches
      const relevant = results.filter((r: any) => r._relevance > 0);
      if (relevant.length >= 4) results = relevant;
    }
  }

  // Exclude already-seen IDs
  if (opts.excludeIds?.length) {
    const excludeSet = new Set(opts.excludeIds);
    results = results.filter((p: any) => !excludeSet.has(p.external_id) && !excludeSet.has(p.id));
  }

  // Shuffle for variety when not doing text search
  if (opts.randomize && !opts.query) {
    for (let i = results.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [results[i], results[j]] = [results[j], results[i]];
    }
  }

  return results.slice(0, opts.limit);
}

// ─── External expansion via commerce scraper ───
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
    .filter(p => p.image_url && p.image_url.startsWith("https"))
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

// ─── Diversity enforcement ───
function enforceDiversity(products: any[], opts: { maxPerBrand?: number; maxPerPlatform?: number } = {}): any[] {
  const maxBrand = opts.maxPerBrand || 3;
  const maxPlat = opts.maxPerPlatform || 5;
  
  // Dedup by name similarity
  const seen = new Set<string>();
  let result = products.filter(p => {
    const key = (p.name || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 30);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Brand diversity
  const brandCount: Record<string, number> = {};
  result = result.filter(p => {
    const b = (p.brand || "").toLowerCase();
    brandCount[b] = (brandCount[b] || 0) + 1;
    return brandCount[b] <= maxBrand;
  });

  // Platform diversity
  const platCount: Record<string, number> = {};
  result = result.filter(p => {
    const pl = (p.platform || "").toLowerCase();
    platCount[pl] = (platCount[pl] || 0) + 1;
    return platCount[pl] <= maxPlat;
  });

  return result;
}

// ─── Main handler ───
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const {
      query,
      category,
      styles,
      fit,
      limit = 30,
      excludeIds = [],
      expandExternal = false,
      randomize = false,
    } = body;
    const supabase = getServiceClient();

    console.log(`product-search: query="${query || ""}", category="${category || ""}", limit=${limit}, expand=${expandExternal}`);

    // Step 1: DB-first load
    const dbProducts = await loadFromDB(supabase, {
      query: query || undefined,
      category,
      styles,
      fit,
      limit: Math.min(limit, 30),
      excludeIds,
      randomize,
    });

    const needsExpansion = expandExternal || dbProducts.length < 8;
    let externalProducts: any[] = [];

    // Step 2: External expansion if needed
    if (needsExpansion && (query || category)) {
      const searchTerm = query || `trending ${category || "fashion"}`;
      externalProducts = await fetchFromCommerceScraper(searchTerm, Math.min(limit, 20));
      
      // Cache new products in background
      cacheToDB(supabase, externalProducts).then(n => {
        if (n > 0) console.log(`Cached ${n} new products`);
      }).catch(e => console.error("Cache error:", e));
    }

    // Step 3: Merge DB + external, deduplicate
    const existingIds = new Set(dbProducts.map((p: any) => p.external_id || p.id));
    const newExternal = externalProducts.filter((p: any) => 
      !existingIds.has(p.external_id) && p.image_url?.startsWith("https")
    );

    // Interleave: DB products first, then external for freshness
    let allProducts = [...dbProducts, ...newExternal];

    // Step 4: Enforce diversity
    allProducts = enforceDiversity(allProducts);

    // Limit final results
    allProducts = allProducts.slice(0, limit);

    // Return normalized products
    const normalized = allProducts.map(p => ({
      id: p.external_id || p.id,
      name: p.name,
      brand: p.brand || "",
      price: p.price || "",
      category: p.category || "",
      subcategory: p.subcategory || "",
      reason: p.reason || "",
      style_tags: p.style_tags || [],
      color: (p.color_tags || [])[0] || "",
      fit: p.fit || "regular",
      image_url: p.image_url,
      source_url: p.source_url,
      store_name: p.store_name,
      platform: p.platform,
      _source: dbProducts.includes(p) ? "db" : "external",
    }));

    return new Response(JSON.stringify({
      products: normalized,
      count: normalized.length,
      dbCount: dbProducts.length,
      externalCount: newExternal.length,
      expanded: needsExpansion,
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
