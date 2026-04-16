import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ─── Blocked image domains (placeholders, trackers) ───
const BLOCKED_IMAGE_DOMAINS = [
  "via.placeholder.com", "placehold.it", "placekitten.com",
  "dummyimage.com", "fakeimg.pl", "picsum.photos", "lorempixel.com",
];

function isImageUrlSafe(url: unknown): boolean {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  if (!trimmed || trimmed === "null" || trimmed === "undefined") return false;
  try {
    const u = new URL(trimmed);
    if (u.protocol !== "https:") return false;
    if (BLOCKED_IMAGE_DOMAINS.some(d => u.hostname.includes(d))) return false;
    if (trimmed.length > 2000) return false;
    return true;
  } catch {
    return false;
  }
}

function getServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

// ─── DB-first: load cached products (trusted sources only) ───
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
    .eq("is_active", true)
    .in("source_trust_level", ["high", "medium"]); // SECURITY: Only trusted sources

  if (opts.category) q = q.eq("category", opts.category);
  if (opts.fit) q = q.eq("fit", opts.fit);
  if (opts.styles?.length) q = q.overlaps("style_tags", opts.styles);

  q = q.order("trend_score", { ascending: false }).limit(opts.limit * 3);

  const { data, error } = await q;
  if (error || !data) return [];

  // Double-check image safety on every result
  let results = data.filter((p: any) => isImageUrlSafe(p.image_url));

  // Text relevance filter
  if (opts.query) {
    const terms = opts.query.toLowerCase().split(/\s+/).filter((t: string) => t.length > 2);
    if (terms.length > 0) {
      results = results.map((p: any) => {
        const text = `${p.name} ${p.brand} ${p.category} ${(p.style_tags || []).join(" ")} ${(p.color_tags || []).join(" ")}`.toLowerCase();
        const score = terms.filter((t: string) => text.includes(t)).length / terms.length;
        return { ...p, _relevance: score };
      });
      results.sort((a: any, b: any) => b._relevance - a._relevance);
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

// ─── External expansion via commerce scraper (rate-limited) ───
const lastScraperCall = { ts: 0 };
const SCRAPER_COOLDOWN_MS = 10_000; // Min 10s between scraper calls

async function fetchFromCommerceScraper(query: string, limit = 20): Promise<any[]> {
  // Rate limiting: prevent burst requests
  const now = Date.now();
  if (now - lastScraperCall.ts < SCRAPER_COOLDOWN_MS) {
    console.log("Scraper cooldown active, skipping external expansion");
    return [];
  }
  lastScraperCall.ts = now;

  try {
    const baseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!baseUrl || !serviceKey) return [];

    // Sanitize query: limit length, strip dangerous chars
    const sanitizedQuery = query.replace(/[<>"'`;]/g, "").slice(0, 100);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000); // 25s max

    const res = await fetch(`${baseUrl}/functions/v1/commerce-scraper`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        query: sanitizedQuery,
        platforms: ["naver", "ssense", "farfetch", "asos", "ssg"],
        limit: Math.min(limit, 15),
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) return [];
    const data = await res.json();
    return (data.products || [])
      .filter((p: any) => isImageUrlSafe(p.image_url) && p.name && p.source_url?.startsWith("http"))
      .map((p: any) => ({
        external_id: p.id,
        name: (p.name || "").slice(0, 150),
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
        source_type: "scraper",
        source_trust_level: "medium",
      }));
  } catch (e) {
    console.error("Commerce scraper fetch error:", e);
    return [];
  }
}

async function cacheToDB(supabase: any, products: any[]): Promise<number> {
  if (!products.length) return 0;

  const rows = products
    .filter(p => isImageUrlSafe(p.image_url))
    .map(p => ({
      external_id: p.external_id,
      name: (p.name || "").slice(0, 200),
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
      source_type: p.source_type || "scraper",
      source_trust_level: p.source_trust_level || "medium",
      last_validated: new Date().toISOString(),
    }));

  // Dedup by source_url before insert
  const seenUrls = new Set<string>();
  const dedupedRows = rows.filter(r => {
    if (!r.source_url) return true;
    if (seenUrls.has(r.source_url)) return false;
    seenUrls.add(r.source_url);
    return true;
  });

  const { error } = await supabase
    .from("product_cache")
    .upsert(dedupedRows, { onConflict: "platform,external_id", ignoreDuplicates: true });

  if (error) {
    console.error("Cache error:", error.message);
    return 0;
  }
  return dedupedRows.length;
}

// ─── Diversity enforcement ───
function enforceDiversity(products: any[], opts: { maxPerBrand?: number; maxPerPlatform?: number } = {}): any[] {
  const maxBrand = opts.maxPerBrand || 3;
  const maxPlat = opts.maxPerPlatform || 5;
  
  const seen = new Set<string>();
  let result = products.filter(p => {
    const key = (p.name || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 30);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const brandCount: Record<string, number> = {};
  result = result.filter(p => {
    const b = (p.brand || "").toLowerCase();
    brandCount[b] = (brandCount[b] || 0) + 1;
    return brandCount[b] <= maxBrand;
  });

  const platCount: Record<string, number> = {};
  result = result.filter(p => {
    const pl = (p.platform || "").toLowerCase();
    platCount[pl] = (platCount[pl] || 0) + 1;
    return platCount[pl] <= maxPlat;
  });

  return result;
}

// ─── Input validation ───
function validateInput(body: any): { valid: boolean; error?: string } {
  if (body.query && typeof body.query !== "string") return { valid: false, error: "query must be a string" };
  if (body.query && body.query.length > 200) return { valid: false, error: "query too long (max 200)" };
  if (body.limit && (typeof body.limit !== "number" || body.limit < 1 || body.limit > 50)) return { valid: false, error: "limit must be 1-50" };
  if (body.category && typeof body.category !== "string") return { valid: false, error: "category must be a string" };
  if (body.styles && !Array.isArray(body.styles)) return { valid: false, error: "styles must be an array" };
  if (body.excludeIds && !Array.isArray(body.excludeIds)) return { valid: false, error: "excludeIds must be an array" };
  return { valid: true };
}

// ─── Main handler ───
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();

    // Input validation
    const validation = validateInput(body);
    if (!validation.valid) {
      return new Response(JSON.stringify({ error: validation.error }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
    const clampedLimit = Math.min(limit, 50);

    console.log(`product-search: query="${query || ""}", category="${category || ""}", limit=${clampedLimit}, expand=${expandExternal}`);

    // Step 1: DB-first load (trusted sources only)
    const dbProducts = await loadFromDB(supabase, {
      query: query || undefined,
      category,
      styles,
      fit,
      limit: Math.min(clampedLimit, 30),
      excludeIds,
      randomize,
    });

    const needsExpansion = expandExternal || dbProducts.length < 8;
    let externalProducts: any[] = [];

    // Step 2: External expansion if needed (rate-limited)
    if (needsExpansion && (query || category)) {
      const searchTerm = query || `trending ${category || "fashion"}`;
      externalProducts = await fetchFromCommerceScraper(searchTerm, Math.min(clampedLimit, 15));
      
      // Cache new products in background
      if (externalProducts.length > 0) {
        cacheToDB(supabase, externalProducts).then(n => {
          if (n > 0) console.log(`Cached ${n} new products`);
        }).catch(e => console.error("Cache error:", e));
      }
    }

    // Step 3: Merge DB + external, deduplicate
    const existingIds = new Set(dbProducts.map((p: any) => p.external_id || p.id));
    const existingUrls = new Set(dbProducts.map((p: any) => p.source_url).filter(Boolean));
    const newExternal = externalProducts.filter((p: any) => 
      !existingIds.has(p.external_id) && 
      !existingUrls.has(p.source_url) && // URL-based dedup
      isImageUrlSafe(p.image_url)
    );

    let allProducts = [...dbProducts, ...newExternal];

    // Step 4: Enforce diversity
    allProducts = enforceDiversity(allProducts);
    allProducts = allProducts.slice(0, clampedLimit);

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
