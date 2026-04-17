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

// ─── Fashion product title validator ───
const FASHION_TITLE_RE = /\b(jacket|coat|blazer|shirt|hoodie|sweater|cardigan|vest|top|tee|t-shirt|polo|pants|trousers|jeans|shorts|skirt|dress|sneakers?|boots?|shoes?|loafers?|sandals?|bag|tote|backpack|purse|wallet|hat|cap|beanie|watch|belt|scarf|gloves?|socks?|bomber|parka|pullover|sweatshirt|chinos?|joggers?|blouse|knit|denim|leather|suede|canvas|necklace|bracelet|earring|ring|sunglasses|tie|cufflinks|headband|bandana|beret|mules?|oxfords?|derby|brogues?|espadrilles?|pumps?|heels?|flats?|clutch|satchel|duffle|messenger|crossbody|jumpsuit|romper|overalls?|flannel|henley|anorak|trench|gilet|poncho|cape|leggings?|culottes|slacks|windbreaker|camisole|tunic|tank|fedora|frame|hoops)\b/i;
const NON_FASHION_RE = /\b(banana|food|fruit|tofu|두부|바나나|grocery|snack|vitamin|supplement|gift\s*card|상품\s*권|교환권|charger|cable|phone|laptop|tablet|kitchen|cook|recipe|drink|beverage|coffee|tea|milk|cream|soap|detergent|shampoo|tissue|diaper|pet\s*food|toy|game|book|movie|music|electronics?)\b/i;

function isFashionProduct(name: string): boolean {
  if (NON_FASHION_RE.test(name)) return false;
  return FASHION_TITLE_RE.test(name);
}

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

// ─── DB-first: load cached products with strict text matching ───
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
    .in("source_trust_level", ["high", "medium"]);

  if (opts.category) q = q.eq("category", opts.category);
  if (opts.fit) q = q.eq("fit", opts.fit);
  if (opts.styles?.length) q = q.overlaps("style_tags", opts.styles);

  // If we have a text query, use ilike for direct DB-level text filtering
  if (opts.query) {
    const terms = opts.query.toLowerCase().split(/\s+/).filter((t: string) => t.length > 2);
    if (terms.length > 0) {
      // Build a single OR condition that matches ANY term in name/brand/category
      const orClauses = terms.slice(0, 4).flatMap(term => [
        `name.ilike.%${term}%`,
        `brand.ilike.%${term}%`,
        `category.ilike.%${term}%`,
      ]);
      q = q.or(orClauses.join(","));
    }
  }

  q = q.order("trend_score", { ascending: false }).limit(opts.limit * 3);

  const { data, error } = await q;
  if (error || !data) return [];

  // Double-check image safety and product-title validity on every result
  let results = data.filter((p: any) => isImageUrlSafe(p.image_url) && isFashionProduct(p.name || ""));

  // Strict text relevance scoring
  if (opts.query) {
    const terms = opts.query.toLowerCase().split(/\s+/).filter((t: string) => t.length > 2);
    if (terms.length > 0) {
      results = results.map((p: any) => {
        const nameLower = (p.name || "").toLowerCase();
        const brandLower = (p.brand || "").toLowerCase();
        const categoryLower = (p.category || "").toLowerCase();
        const tagsText = [...(p.style_tags || []), ...(p.color_tags || []), p.fit || ""].join(" ").toLowerCase();

        let score = 0;
        let maxPossible = terms.length * 3;

        for (const t of terms) {
          if (nameLower.includes(t)) score += 3;
          else if (brandLower.includes(t)) score += 2;
          else if (categoryLower.includes(t)) score += 2;
          else if (tagsText.includes(t)) score += 1;
        }

        const relevance = maxPossible > 0 ? score / maxPossible : 0;
        return { ...p, _relevance: relevance };
      });

      // STRICT: only keep items with relevance > 0.15 (at least some term match)
      const relevant = results.filter((r: any) => r._relevance > 0.15);
      // Sort by relevance
      relevant.sort((a: any, b: any) => b._relevance - a._relevance);

      // If we have enough relevant results, use only those
      if (relevant.length >= 3) {
        results = relevant;
      } else {
        // Not enough relevant results — return what we have but mark as low relevance
        results.sort((a: any, b: any) => (b._relevance || 0) - (a._relevance || 0));
      }
    }
  }

  // Exclude already-seen IDs
  if (opts.excludeIds?.length) {
    const excludeSet = new Set(opts.excludeIds);
    results = results.filter((p: any) => !excludeSet.has(p.external_id) && !excludeSet.has(p.id));
  }

  // Only shuffle if randomize is requested (for feed, not search)
  if (opts.randomize) {
    for (let i = results.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [results[i], results[j]] = [results[j], results[i]];
    }
  }

  return results.slice(0, opts.limit);
}

// ─── Auto-tag classifier: adds style/color/fit tags if missing ───
function autoTagProduct(p: any): any {
  const name = (p.name || "").toLowerCase();
  const brand = (p.brand || "").toLowerCase();

  // Style tags inference
  if (!p.style_tags?.length) {
    const tags: string[] = [];
    if (/minimal|clean|structured|tailored/.test(name)) tags.push("minimal");
    if (/street|urban|oversized|baggy|cargo/.test(name)) tags.push("street");
    if (/classic|elegant|formal|blazer|suit/.test(name)) tags.push("classic");
    if (/edgy|dark|leather|chain|punk/.test(name)) tags.push("edgy");
    if (/casual|relaxed|everyday|comfort/.test(name)) tags.push("casual");
    if (/chic|modern|sleek|slim/.test(name)) tags.push("chic");
    if (/vintage|retro|90s|80s/.test(name)) tags.push("vintage");
    if (/sport|athletic|track|jersey/.test(name)) tags.push("sporty");
    // Brand-based inference
    if (/cos|arket|muji|uniqlo/.test(brand)) tags.push("minimal");
    if (/nike|adidas|puma|new balance/.test(brand)) tags.push("sporty");
    if (/gucci|prada|balenciaga/.test(brand)) tags.push("chic");
    p.style_tags = tags.length > 0 ? tags : ["casual"];
  }

  // Color tags inference
  if (!p.color_tags?.length) {
    const colors: string[] = [];
    if (/black|noir|블랙/.test(name)) colors.push("black");
    if (/white|blanc|화이트/.test(name)) colors.push("white");
    if (/grey|gray|그레이/.test(name)) colors.push("grey");
    if (/navy|네이비/.test(name)) colors.push("navy");
    if (/beige|cream|ivory|베이지/.test(name)) colors.push("beige");
    if (/brown|tan|camel|브라운/.test(name)) colors.push("brown");
    if (/red|burgundy|wine|레드/.test(name)) colors.push("red");
    if (/blue|블루/.test(name)) colors.push("blue");
    if (/green|olive|카키/.test(name)) colors.push("green");
    p.color_tags = colors.length > 0 ? colors : ["neutral"];
  }

  // Fit inference
  if (!p.fit) {
    if (/oversized|oversize|오버사이즈|boxy/.test(name)) p.fit = "oversized";
    else if (/slim|skinny|fitted|타이트/.test(name)) p.fit = "slim";
    else if (/relaxed|loose|wide|와이드/.test(name)) p.fit = "relaxed";
    else p.fit = "regular";
  }

  return p;
}

// ─── External expansion via commerce scraper ───
// PER-QUERY DEDUP (not global cooldown). The previous global SCRAPER_COOLDOWN_MS
// blocked 4 of every 5 parallel expanded queries from ever reaching the scraper,
// which is the root cause of "0 external" results in the logs. We now allow
// every distinct query to fire, but suppress the SAME query within a 30s window.
const recentQueryCalls = new Map<string, number>();
const QUERY_DEDUP_WINDOW_MS = 30_000;

async function fetchFromCommerceScraper(query: string, limit = 20): Promise<any[]> {
  const sanitizedQuery = query.replace(/[<>"'`;]/g, "").slice(0, 100).trim();
  if (!sanitizedQuery) return [];

  // Per-query dedup (not a global lock)
  const now = Date.now();
  const lastCall = recentQueryCalls.get(sanitizedQuery) || 0;
  if (now - lastCall < QUERY_DEDUP_WINDOW_MS) {
    console.log(`[SEARCH_DEBUG] scraper dedup skip for "${sanitizedQuery}" (called ${now - lastCall}ms ago)`);
    return [];
  }
  recentQueryCalls.set(sanitizedQuery, now);
  // Clean old entries to avoid memory growth
  if (recentQueryCalls.size > 200) {
    for (const [k, v] of recentQueryCalls) {
      if (now - v > QUERY_DEDUP_WINDOW_MS) recentQueryCalls.delete(k);
    }
  }

  try {
    const baseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!baseUrl || !serviceKey) return [];

    // Tightened: 18s (was 45s). The parent edge function only has ~25s wall clock,
    // and scraper itself caps at 14s per platform. Anything longer is dead.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 18000);

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
      .filter((p: any) => isImageUrlSafe(p.image_url) && p.name && p.source_url?.startsWith("http") && isFashionProduct(p.name))
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

// ─── Diversity enforcement (upgraded) ───
function enforceDiversity(products: any[], opts: { maxPerBrand?: number; maxPerPlatform?: number } = {}): any[] {
  const maxBrand = opts.maxPerBrand || 2; // Reduced from 3 → 2
  const maxPlat = opts.maxPerPlatform || 4; // Reduced from 5 → 4
  
  // 1. Dedup by normalized title
  const seenTitles = new Set<string>();
  let result = products.filter(p => {
    const key = (p.name || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 30);
    if (seenTitles.has(key)) return false;
    seenTitles.add(key);
    return true;
  });

  // 2. Dedup by image URL (strip query params)
  const seenImages = new Set<string>();
  result = result.filter(p => {
    if (!p.image_url) return false;
    const imgKey = (p.image_url || "").split("?")[0].toLowerCase();
    if (seenImages.has(imgKey)) return false;
    seenImages.add(imgKey);
    return true;
  });

  // 3. Dedup by source URL
  const seenUrls = new Set<string>();
  result = result.filter(p => {
    if (!p.source_url) return true;
    const urlKey = (p.source_url || "").split("?")[0].toLowerCase();
    if (seenUrls.has(urlKey)) return false;
    seenUrls.add(urlKey);
    return true;
  });

  // 4. Brand cap
  const brandCount: Record<string, number> = {};
  result = result.filter(p => {
    const b = (p.brand || "unknown").toLowerCase();
    brandCount[b] = (brandCount[b] || 0) + 1;
    return brandCount[b] <= maxBrand;
  });

  // 5. Platform cap
  const platCount: Record<string, number> = {};
  result = result.filter(p => {
    const pl = (p.platform || "unknown").toLowerCase();
    platCount[pl] = (platCount[pl] || 0) + 1;
    return platCount[pl] <= maxPlat;
  });

  // 6. Style combo diversity: max 3 with identical style_tags
  const styleComboCount: Record<string, number> = {};
  result = result.filter(p => {
    const combo = (p.style_tags || []).sort().join(",") || "none";
    styleComboCount[combo] = (styleComboCount[combo] || 0) + 1;
    return styleComboCount[combo] <= 3;
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
      freshSearch = false, // NEW: forces external-first retrieval
    } = body;
    const supabase = getServiceClient();
    const clampedLimit = Math.min(limit, 50);

    console.log(`product-search: query="${query || ""}", category="${category || ""}", limit=${clampedLimit}, expand=${expandExternal}, fresh=${freshSearch}`);

    let dbProducts: any[] = [];
    let externalProducts: any[] = [];

    if (freshSearch && query) {
      // ═══ EXTERNAL-FIRST MODE: real internet search + DB in parallel ═══

      // Run BOTH external search and DB query in parallel
      const [externalResult, dbResult] = await Promise.all([
        fetchFromCommerceScraper(query, Math.min(clampedLimit, 20))
          .then(products => products.map(autoTagProduct))
          .catch(e => { console.error("External search failed:", e); return [] as any[]; }),
        loadFromDB(supabase, {
          query,
          category,
          styles,
          fit,
          limit: Math.min(clampedLimit, 20),
          excludeIds,
          randomize: false,
        }),
      ]);

      externalProducts = externalResult;
      dbProducts = dbResult;

      // Cache valid external products to DB and AWAIT count for logging
      let insertedCount = 0;
      let duplicateRejections = 0;
      if (externalProducts.length > 0) {
        try {
          insertedCount = await cacheToDB(supabase, externalProducts);
          duplicateRejections = externalProducts.length - insertedCount;
        } catch (e) {
          console.error("Cache error:", e);
        }
      }

      console.log(`[SEARCH_DEBUG] ${JSON.stringify({
        stage: "FRESH_SEARCH_COMPLETE",
        raw_query: query,
        external_fetched: externalProducts.length,
        db_supplement: dbProducts.length,
        valid_count: externalProducts.length,
        inserted_count: insertedCount,
        duplicate_rejections: duplicateRejections,
        path: externalProducts.length > 0 ? "DB_PLUS_EXTERNAL" : "DB_ONLY",
      })}`);

      // Merge — external results FIRST (higher priority), DB fills gaps
      const externalIds = new Set(externalProducts.map((p: any) => p.external_id));
      const externalUrls = new Set(externalProducts.map((p: any) => p.source_url).filter(Boolean));
      const externalNames = new Set(externalProducts.map((p: any) => (p.name || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 25)));

      const uniqueDbProducts = dbProducts.filter((p: any) => {
        const nameKey = (p.name || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 25);
        return !externalIds.has(p.external_id) &&
          !externalUrls.has(p.source_url) &&
          !externalNames.has(nameKey);
      });

      // External products come first, then DB supplements
      let allProducts = [...externalProducts, ...uniqueDbProducts];
      allProducts = enforceDiversity(allProducts);
      allProducts = allProducts.slice(0, clampedLimit);

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
        _source: externalProducts.includes(p) ? "external" : "db",
      }));

      console.log(`product-search (fresh): ${normalized.length} total (${externalProducts.length} external, ${uniqueDbProducts.length} DB supplement)`);

      return new Response(JSON.stringify({
        products: normalized,
        count: normalized.length,
        dbCount: uniqueDbProducts.length,
        externalCount: externalProducts.length,
        expanded: true,
        freshSearch: true,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else {
      // ═══ DB-FIRST MODE: for feed browsing, category tabs, repeat visits ═══

      // Step 1: DB-first load
      dbProducts = await loadFromDB(supabase, {
        query: query || undefined,
        category,
        styles,
        fit,
        limit: Math.min(clampedLimit, 30),
        excludeIds,
        randomize,
      });

      const needsExpansion = expandExternal || dbProducts.length < 8;

      // Step 2: External expansion if needed (rate-limited)
      if (needsExpansion && (query || category)) {
        const searchTerm = query || `trending ${category || "fashion"}`;
        externalProducts = await fetchFromCommerceScraper(searchTerm, Math.min(clampedLimit, 15));
        externalProducts = externalProducts.map(autoTagProduct);

        if (externalProducts.length > 0) {
          cacheToDB(supabase, externalProducts).then(n => {
            if (n > 0) console.log(`Cached ${n} new products`);
          }).catch(e => console.error("Cache error:", e));
        }
      }

      // Step 3: Merge DB + external, deduplicate
      const existingIds = new Set(dbProducts.map((p: any) => p.external_id || p.id));
      const existingUrls = new Set(dbProducts.map((p: any) => p.source_url).filter(Boolean));
      const existingNames = new Set(dbProducts.map((p: any) => (p.name || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 25)));
      const newExternal = externalProducts.filter((p: any) => {
        const nameKey = (p.name || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 25);
        return !existingIds.has(p.external_id) && 
          !existingUrls.has(p.source_url) &&
          !existingNames.has(nameKey) &&
          isImageUrlSafe(p.image_url);
      });

      let allProducts = [...dbProducts, ...newExternal];
      allProducts = enforceDiversity(allProducts);
      allProducts = allProducts.slice(0, clampedLimit);

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

      console.log(`product-search result: ${normalized.length} total (${dbProducts.length} DB, ${newExternal.length} external)`);

      return new Response(JSON.stringify({
        products: normalized,
        count: normalized.length,
        dbCount: dbProducts.length,
        externalCount: newExternal.length,
        expanded: needsExpansion,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

  } catch (e) {
    console.error("product-search error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
