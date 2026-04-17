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

// ─── Category inference (used to enforce search intent) ───
// Maps a raw text blob → canonical category bucket
const CATEGORY_PATTERNS: { category: string; re: RegExp }[] = [
  { category: "bags", re: /\b(bags?|tote|backpack|crossbody|clutch|purse|satchel|duffle|messenger|handbag|shoulder\s*bag|hobo|bucket\s*bag)\b/i },
  { category: "shoes", re: /\b(sneakers?|shoes?|boots?|loafers?|sandals?|trainers?|mules?|heels?|pumps?|flats?|oxfords?|derby|brogues?|espadrilles?|slippers?)\b/i },
  { category: "outerwear", re: /\b(jacket|coat|blazer|parka|bomber|trench|overcoat|windbreaker|anorak|gilet|puffer|cardigan)\b/i },
  { category: "tops", re: /\b(shirt|tee|t-shirt|hoodie|sweater|polo|blouse|tank|knit|sweatshirt|pullover|henley|tunic|camisole|top)\b/i },
  { category: "bottoms", re: /\b(pants|trousers|jeans|shorts|skirt|chinos?|joggers?|leggings?|slacks|culottes)\b/i },
  { category: "dresses", re: /\b(dress|jumpsuit|romper|gown)\b/i },
  { category: "accessories", re: /\b(hat|cap|beanie|scarf|belt|watch|sunglasses|gloves?|tie|necklace|bracelet|earring|ring|wallet|fedora|beret|headband|bandana)\b/i },
];

function inferCategoryFromText(text: string): string | null {
  if (!text) return null;
  for (const { category, re } of CATEGORY_PATTERNS) {
    if (re.test(text)) return category;
  }
  return null;
}

// Server-side category alias map (db has both "shoes"+"footwear", "bags", etc.)
const CATEGORY_ALIASES: Record<string, string[]> = {
  bags: ["bags", "bag", "accessories"], // some bags get tagged "accessories"
  shoes: ["shoes", "footwear"],
  outerwear: ["outerwear", "clothing"],
  tops: ["tops", "clothing"],
  bottoms: ["bottoms", "clothing"],
  dresses: ["dresses", "clothing"],
  accessories: ["accessories"],
};

function categoryMatches(intentCategory: string, productCategory: string | null | undefined, productName: string | null | undefined): boolean {
  if (!intentCategory) return true;
  const allowed = CATEGORY_ALIASES[intentCategory] || [intentCategory];
  const pc = (productCategory || "").toLowerCase();
  if (pc && allowed.includes(pc)) {
    // For "bags" intent, "accessories" only counts if the name actually mentions a bag
    if (intentCategory === "bags" && pc === "accessories") {
      return /\b(bags?|tote|backpack|crossbody|clutch|purse|satchel|handbag|shoulder)\b/i.test(productName || "");
    }
    return true;
  }
  // Fallback: name matches the intent category pattern AND does not strongly belong to a different category
  const nameInferred = inferCategoryFromText(productName || "");
  if (nameInferred === intentCategory) return true;
  return false;
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
    .eq("is_active", true);

  if (opts.category) q = q.eq("category", opts.category);
  if (opts.fit) q = q.eq("fit", opts.fit);
  if (opts.styles?.length) q = q.overlaps("style_tags", opts.styles);

  const normalizedQuery = opts.query ? sanitizeSearchQuery(opts.query).toLowerCase() : "";
  const terms = normalizedQuery.split(/\s+/).filter((t: string) => t.length > 1);

  if (terms.length > 0) {
    const orClauses = terms.slice(0, 6).flatMap(term => [
      `name.ilike.%${term}%`,
      `brand.ilike.%${term}%`,
      `category.ilike.%${term}%`,
      `subcategory.ilike.%${term}%`,
      `search_query.ilike.%${term}%`,
    ]);
    q = q.or(orClauses.join(","));
  }

  q = q
    .order("created_at", { ascending: false })
    .order("trend_score", { ascending: false })
    .limit(Math.min(opts.limit * 6, 120));

  const { data, error } = await q;
  if (error || !data) return [];

  const now = Date.now();
  let results = data
    .filter((p: any) => isImageUrlSafe(p.image_url) && isFashionProduct(p.name || ""))
    .map((p: any) => {
      const nameLower = (p.name || "").toLowerCase();
      const brandLower = (p.brand || "").toLowerCase();
      const categoryLower = (p.category || "").toLowerCase();
      const subcategoryLower = (p.subcategory || "").toLowerCase();
      const searchQueryLower = (p.search_query || "").toLowerCase();
      const tagsText = [...(p.style_tags || []), ...(p.color_tags || []), p.fit || ""].join(" ").toLowerCase();

      const createdAtMs = p.created_at ? new Date(p.created_at).getTime() : 0;
      const ageDays = createdAtMs ? (now - createdAtMs) / 86_400_000 : 999;
      const freshnessBonus = Math.max(0, 10 - ageDays);
      const trustBonus =
        p.source_trust_level === "high" ? 8 :
        p.source_trust_level === "medium" ? 4 :
        1;

      let score = Number(p.trend_score || 0) + freshnessBonus + trustBonus;

      if (terms.length > 0) {
        if (searchQueryLower === normalizedQuery) score += 14;
        for (const t of terms) {
          if (nameLower.includes(t)) score += 6;
          else if (brandLower.includes(t)) score += 5;
          else if (categoryLower.includes(t) || subcategoryLower.includes(t)) score += 4;
          else if (searchQueryLower.includes(t)) score += 3;
          else if (tagsText.includes(t)) score += 2;
        }
      }

      return { ...p, _dbScore: score };
    });

  results.sort((a: any, b: any) => (b._dbScore || 0) - (a._dbScore || 0));

  if (opts.excludeIds?.length) {
    const excludeSet = new Set(opts.excludeIds);
    results = results.filter((p: any) => !excludeSet.has(p.external_id) && !excludeSet.has(p.id));
  }

  if (opts.randomize && results.length > 1) {
    const windowSize = Math.min(results.length, Math.max(opts.limit * 2, 12));
    const head = results.slice(0, windowSize);
    for (let i = head.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [head[i], head[j]] = [head[j], head[i]];
    }
    results = [...head, ...results.slice(windowSize)];
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

  // Re-classify category from product name when missing or generic
  const generic = !p.category || ["other", "clothing", "general", "fashion", "miscellaneous"].includes(String(p.category).toLowerCase());
  if (generic) {
    const inferred = inferCategoryFromText(p.name || "");
    if (inferred) p.category = inferred;
  }

  return p;
}
  const cleaned = query.replace(/[<>"'`;]/g, "").trim();
  if (!cleaned) return "";
  const tokens = cleaned.split(/\s+/);
  const deduped = tokens.filter((token, index) => index === 0 || token.toLowerCase() !== tokens[index - 1].toLowerCase());
  return deduped.join(" ").slice(0, 100);
}

function normalizeIdentityKey(value: unknown): string | null {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.split("?")[0].toLowerCase();
}

function normalizeTitleKey(value: unknown): string {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 50);
}

function mergeUniqueProducts(existing: any[], incoming: any[]): any[] {
  const seenIds = new Set<string>();
  const seenUrls = new Set<string>();
  const seenImages = new Set<string>();
  const seenTitles = new Set<string>();
  const out: any[] = [];

  for (const item of [...existing, ...incoming]) {
    const id = String(item.external_id || item.id || "");
    const urlKey = normalizeIdentityKey(item.source_url);
    const imageKey = normalizeIdentityKey(item.image_url);
    const titleKey = normalizeTitleKey(item.name);
    if (!id && !urlKey && !imageKey && !titleKey) continue;
    if (id && seenIds.has(id)) continue;
    if (urlKey && seenUrls.has(urlKey)) continue;
    if (imageKey && seenImages.has(imageKey)) continue;
    if (titleKey && seenTitles.has(titleKey)) continue;
    if (id) seenIds.add(id);
    if (urlKey) seenUrls.add(urlKey);
    if (imageKey) seenImages.add(imageKey);
    if (titleKey) seenTitles.add(titleKey);
    out.push(item);
  }

  return out;
}

async function fetchFromCommerceScraper(query: string, limit = 20): Promise<any[]> {
  const sanitizedQuery = sanitizeSearchQuery(query);
  if (!sanitizedQuery) return [];

  try {
    const baseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!baseUrl || !serviceKey) return [];

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25_000);

    const res = await fetch(`${baseUrl}/functions/v1/commerce-scraper`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        query: sanitizedQuery,
        platforms: ["asos", "ssense", "farfetch", "naver", "ssg"],
        limit: Math.min(limit, 24),
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) return [];
    const data = await res.json();
    console.log(`[SEARCH_SUPPLY] ${JSON.stringify({
      stage: "COMMERCE_SCRAPER",
      query: sanitizedQuery,
      returned: (data.products || []).length,
      debug: data.debug || [],
    })}`);

    return (data.products || [])
      .filter((p: any) => isImageUrlSafe(p.image_url) && p.name && p.source_url?.startsWith("http") && isFashionProduct(p.name))
      .map((p: any) => ({
        external_id: p.id,
        name: (p.name || "").slice(0, 150),
        brand: p.brand,
        price: p.price,
        category: p.category,
        subcategory: p.subcategory,
        style_tags: Array.isArray(p.style_tags) ? p.style_tags : [],
        color_tags: Array.isArray(p.color_tags) ? p.color_tags : p.color ? [p.color] : [],
        fit: p.fit || "regular",
        image_url: p.image_url,
        source_url: p.source_url,
        store_name: p.store_name,
        reason: p.reason,
        platform: p.platform || "web_search",
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

async function fetchFromDiscovery(supabase: any, query: string, limit = 12): Promise<any[]> {
  const sanitizedQuery = sanitizeSearchQuery(query);
  if (!sanitizedQuery) return [];

  try {
    const baseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!baseUrl || !serviceKey) return [];

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25_000);

    const res = await fetch(`${baseUrl}/functions/v1/search-discovery`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        query: sanitizedQuery,
        maxQueries: 4,
        maxCandidates: Math.min(Math.max(limit, 12), 18),
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      console.error(`[SEARCH_DISCOVERY] HTTP ${res.status}`);
      return [];
    }

    const payload = await res.json().catch(() => null);
    console.log(`[SEARCH_SUPPLY] ${JSON.stringify({
      stage: "DISCOVERY_TRIGGER",
      query: sanitizedQuery,
      inserted: payload?.inserted ?? 0,
      validated: payload?.validated ?? 0,
      candidatesFound: payload?.candidatesFound ?? 0,
    })}`);

    const { data, error } = await supabase
      .from("product_cache")
      .select("*")
      .eq("is_active", true)
      .eq("image_valid", true)
      .eq("search_query", sanitizedQuery)
      .order("created_at", { ascending: false })
      .limit(Math.min(limit * 2, 24));

    if (error || !data) return [];

    return data
      .filter((p: any) => isImageUrlSafe(p.image_url) && isFashionProduct(p.name || ""))
      .map((p: any) => autoTagProduct(p));
  } catch (e) {
    console.error("Search discovery fetch error:", e);
    return [];
  }
}

async function cacheToDB(supabase: any, products: any[], sourceQuery?: string): Promise<number> {
  if (!products.length) return 0;

  const normalizedQuery = sourceQuery ? sanitizeSearchQuery(sourceQuery) : null;
  const seenBatch = new Set<string>();

  const rows = products
    .filter(p => isImageUrlSafe(p.image_url) && p.name && p.source_url?.startsWith("http"))
    .map(p => autoTagProduct({ ...p }))
    .filter(p => {
      const key = [
        normalizeIdentityKey(p.source_url),
        normalizeIdentityKey(p.image_url),
        normalizeTitleKey(p.name),
      ].filter(Boolean).join("|");
      if (!key) return false;
      if (seenBatch.has(key)) return false;
      seenBatch.add(key);
      return true;
    })
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
      search_query: normalizedQuery,
      last_validated: new Date().toISOString(),
    }));

  if (!rows.length) return 0;

  const { error } = await supabase
    .from("product_cache")
    .upsert(rows, { onConflict: "platform,external_id" });

  if (error) {
    console.error("Cache error:", error.message);
    return 0;
  }

  return rows.length;
}

// ─── Diversity enforcement (upgraded) ───
function enforceDiversity(products: any[], opts: { maxPerBrand?: number; maxPerPlatform?: number } = {}): any[] {
  const maxBrand = opts.maxPerBrand || 3;
  const maxPlat = opts.maxPerPlatform || 6;

  const seenTitles = new Set<string>();
  let result = products.filter(p => {
    const key = normalizeTitleKey(p.name);
    if (!key) return false;
    if (seenTitles.has(key)) return false;
    seenTitles.add(key);
    return true;
  });

  const seenImages = new Set<string>();
  result = result.filter(p => {
    if (!p.image_url) return false;
    const imgKey = normalizeIdentityKey(p.image_url);
    if (!imgKey) return false;
    if (seenImages.has(imgKey)) return false;
    seenImages.add(imgKey);
    return true;
  });

  const seenUrls = new Set<string>();
  result = result.filter(p => {
    const urlKey = normalizeIdentityKey(p.source_url);
    if (!urlKey) return true;
    if (seenUrls.has(urlKey)) return false;
    seenUrls.add(urlKey);
    return true;
  });

  const brandCount: Record<string, number> = {};
  result = result.filter(p => {
    const b = (p.brand || "unknown").toLowerCase();
    brandCount[b] = (brandCount[b] || 0) + 1;
    return brandCount[b] <= maxBrand;
  });

  const platCount: Record<string, number> = {};
  result = result.filter(p => {
    const pl = (p.platform || "unknown").toLowerCase();
    platCount[pl] = (platCount[pl] || 0) + 1;
    return platCount[pl] <= maxPlat;
  });

  const styleComboCount: Record<string, number> = {};
  result = result.filter(p => {
    const combo = (p.style_tags || []).sort().join(",") || "none";
    styleComboCount[combo] = (styleComboCount[combo] || 0) + 1;
    return styleComboCount[combo] <= 4;
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
      const normalizedQuery = sanitizeSearchQuery(query);
      const minTarget = Math.min(clampedLimit, 12);

      const [externalResult, dbResult] = await Promise.all([
        fetchFromCommerceScraper(normalizedQuery, Math.min(clampedLimit, 24))
          .then(products => products.map(autoTagProduct))
          .catch(e => { console.error("External search failed:", e); return [] as any[]; }),
        loadFromDB(supabase, {
          query: normalizedQuery,
          category,
          styles,
          fit,
          limit: Math.min(clampedLimit, 24),
          excludeIds,
          randomize: false,
        }),
      ]);

      externalProducts = externalResult;
      dbProducts = dbResult;

      const storedCount = externalProducts.length > 0
        ? await cacheToDB(supabase, externalProducts, normalizedQuery)
        : 0;

      let discoveryProducts: any[] = [];
      let allProducts = enforceDiversity(mergeUniqueProducts(externalProducts, dbProducts));

      if (allProducts.length < minTarget) {
        discoveryProducts = await fetchFromDiscovery(supabase, normalizedQuery, minTarget);
        allProducts = enforceDiversity(mergeUniqueProducts(allProducts, discoveryProducts));
      }

      if (allProducts.length < minTarget) {
        const broadenedDb = await loadFromDB(supabase, {
          query: normalizedQuery,
          category,
          styles,
          fit,
          limit: minTarget * 2,
          excludeIds: allProducts.map((p: any) => p.external_id || p.id),
          randomize: true,
        });
        allProducts = enforceDiversity(mergeUniqueProducts(allProducts, broadenedDb));
      }

      if (allProducts.length < minTarget) {
        const fallbackDb = await loadFromDB(supabase, {
          category,
          styles,
          fit,
          limit: minTarget * 2,
          excludeIds: allProducts.map((p: any) => p.external_id || p.id),
          randomize: true,
        });
        allProducts = enforceDiversity(mergeUniqueProducts(allProducts, fallbackDb));
      }

      // ─── Category intent enforcement ───
      const intentCategory = category || inferCategoryFromText(normalizedQuery);
      if (intentCategory) {
        const filtered = allProducts.filter((p: any) => categoryMatches(intentCategory, p.category, p.name));
        // Only apply if filter doesn't nuke everything
        if (filtered.length >= Math.min(6, minTarget / 2)) {
          console.log(`[SEARCH_INTENT] category="${intentCategory}" filtered ${allProducts.length} → ${filtered.length}`);
          allProducts = filtered;
        } else {
          console.log(`[SEARCH_INTENT] category="${intentCategory}" filter would leave only ${filtered.length}, keeping unfiltered`);
        }
      }

      allProducts = allProducts.slice(0, clampedLimit);

      const externalKeys = new Set(externalProducts.map((p: any) => [normalizeIdentityKey(p.source_url), normalizeIdentityKey(p.image_url), normalizeTitleKey(p.name)].filter(Boolean).join("|")));
      const discoveryKeys = new Set(discoveryProducts.map((p: any) => [normalizeIdentityKey(p.source_url), normalizeIdentityKey(p.image_url), normalizeTitleKey(p.name)].filter(Boolean).join("|")));

      const normalized = allProducts.map(p => {
        const identity = [normalizeIdentityKey(p.source_url), normalizeIdentityKey(p.image_url), normalizeTitleKey(p.name)].filter(Boolean).join("|");
        return {
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
          _source: externalKeys.has(identity) ? "external" : discoveryKeys.has(identity) ? "discovery" : "db",
        };
      });

      console.log(`[SEARCH_SUPPLY] ${JSON.stringify({
        stage: "FRESH_SEARCH_COMPLETE",
        raw_query: normalizedQuery,
        external_fetched: externalProducts.length,
        discovery_fetched: discoveryProducts.length,
        db_supplement: dbProducts.length,
        stored_count: storedCount,
        final_count: normalized.length,
      })}`);

      return new Response(JSON.stringify({
        products: normalized,
        count: normalized.length,
        dbCount: dbProducts.length,
        externalCount: externalProducts.length,
        discoveryCount: discoveryProducts.length,
        storedCount,
        expanded: true,
        freshSearch: true,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else {
      const minTarget = Math.min(clampedLimit, 12);

      dbProducts = await loadFromDB(supabase, {
        query: query || undefined,
        category,
        styles,
        fit,
        limit: Math.min(clampedLimit, 30),
        excludeIds,
        randomize,
      });

      const needsExpansion = expandExternal || dbProducts.length < minTarget;
      let discoveryProducts: any[] = [];

      if (needsExpansion && (query || category)) {
        const searchTerm = sanitizeSearchQuery(query || `trending ${category || "fashion"}`);
        externalProducts = await fetchFromCommerceScraper(searchTerm, Math.min(clampedLimit, 18));
        externalProducts = externalProducts.map(autoTagProduct);

        if (externalProducts.length > 0) {
          await cacheToDB(supabase, externalProducts, searchTerm);
        }

        let mergedForThreshold = mergeUniqueProducts(dbProducts, externalProducts);
        if (mergedForThreshold.length < minTarget) {
          discoveryProducts = await fetchFromDiscovery(supabase, searchTerm, minTarget);
          mergedForThreshold = mergeUniqueProducts(mergedForThreshold, discoveryProducts);
        }

        if (mergedForThreshold.length < minTarget) {
          const broadenedDb = await loadFromDB(supabase, {
            category,
            styles,
            fit,
            limit: minTarget * 2,
            excludeIds: [...excludeIds, ...mergedForThreshold.map((p: any) => p.external_id || p.id)],
            randomize: true,
          });
          dbProducts = mergeUniqueProducts(dbProducts, broadenedDb);
        }
      }

      let allProducts = mergeUniqueProducts(dbProducts, externalProducts);
      allProducts = mergeUniqueProducts(allProducts, discoveryProducts);

      if (allProducts.length < minTarget) {
        const trending = await loadFromDB(supabase, {
          limit: minTarget * 2,
          excludeIds: [...excludeIds, ...allProducts.map((p: any) => p.external_id || p.id)],
          randomize: true,
        });
        allProducts = mergeUniqueProducts(allProducts, trending);
      }

      allProducts = enforceDiversity(allProducts);

      // ─── Category intent enforcement ───
      const intentCategory2 = category || inferCategoryFromText(query || "");
      if (intentCategory2) {
        const filtered = allProducts.filter((p: any) => categoryMatches(intentCategory2, p.category, p.name));
        if (filtered.length >= Math.min(6, minTarget / 2)) {
          console.log(`[SEARCH_INTENT] (db-first) category="${intentCategory2}" filtered ${allProducts.length} → ${filtered.length}`);
          allProducts = filtered;
        }
      }

      allProducts = allProducts.slice(0, clampedLimit);

      const externalKeys = new Set(externalProducts.map((p: any) => [normalizeIdentityKey(p.source_url), normalizeIdentityKey(p.image_url), normalizeTitleKey(p.name)].filter(Boolean).join("|")));
      const discoveryKeys = new Set(discoveryProducts.map((p: any) => [normalizeIdentityKey(p.source_url), normalizeIdentityKey(p.image_url), normalizeTitleKey(p.name)].filter(Boolean).join("|")));

      const normalized = allProducts.map(p => {
        const identity = [normalizeIdentityKey(p.source_url), normalizeIdentityKey(p.image_url), normalizeTitleKey(p.name)].filter(Boolean).join("|");
        return {
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
          _source: externalKeys.has(identity) ? "external" : discoveryKeys.has(identity) ? "discovery" : "db",
        };
      });

      console.log(`[SEARCH_SUPPLY] ${JSON.stringify({
        stage: "DB_FIRST_COMPLETE",
        query: query || "",
        category: category || "",
        db_count: dbProducts.length,
        external_count: externalProducts.length,
        discovery_count: discoveryProducts.length,
        final_count: normalized.length,
      })}`);

      return new Response(JSON.stringify({
        products: normalized,
        count: normalized.length,
        dbCount: dbProducts.length,
        externalCount: externalProducts.length,
        discoveryCount: discoveryProducts.length,
        expanded: needsExpansion || discoveryProducts.length > 0,
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
