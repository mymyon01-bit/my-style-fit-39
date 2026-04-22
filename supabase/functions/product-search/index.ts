import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Boot-time env validation — fail fast with a readable message
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("[product-search] Missing env", {
    hasUrl: !!SUPABASE_URL,
    hasKey: !!SUPABASE_SERVICE_ROLE_KEY,
  });
}

// ─── Blocked image domains (placeholders, trackers) ───
const BLOCKED_IMAGE_DOMAINS = [
  "via.placeholder.com", "placehold.it", "placekitten.com",
  "dummyimage.com", "fakeimg.pl", "picsum.photos", "lorempixel.com",
];

// ─── HARD-REJECT image signals (logos, favicons, sprites, banners) ───
// Any of these in the URL path/filename → image is dropped (drop-on-hard).
const HARD_REJECT_IMAGE_RE =
  /(^|[\/_\-.])(logo|logos|brand[-_]?logo|favicon|sprite|sprites|icon[-_]?set|navbar|header[-_]?(logo|banner)|site[-_]?logo|app[-_]?icon|apple[-_]?touch[-_]?icon|placeholder|placehold|noimage|no[-_]?image|default[-_]?image|coming[-_]?soon)([\/_\-.]|$)/i;

// Soft signals — image kept but flagged as low-quality (image_missing=true downstream).
const SOFT_REJECT_IMAGE_RE =
  /(^|[\/_\-.])(banner|hero|cover[-_]?image|category[-_]?(banner|hero)|promo|campaign|lookbook[-_]?cover|landing)([\/_\-.]|$)/i;

/**
 * Hybrid image quality gate.
 *  - returns { ok: true }                → image is fine
 *  - returns { ok: true, soft: true }    → keep product, mark as low-quality
 *  - returns { ok: false, reason }       → drop the image (caller decides whether
 *                                          to drop the product or render fallback)
 */
function imageQualityCheck(url: unknown, ctx?: { title?: string }): { ok: boolean; soft?: boolean; reason?: string } {
  if (!url || typeof url !== "string") return { ok: false, reason: "empty" };
  const trimmed = url.trim();
  if (!trimmed || trimmed === "null" || trimmed === "undefined") return { ok: false, reason: "empty" };
  let u: URL;
  try { u = new URL(trimmed); } catch { return { ok: false, reason: "invalid_url" }; }
  if (u.protocol !== "https:") return { ok: false, reason: "not_https" };
  if (BLOCKED_IMAGE_DOMAINS.some((d) => u.hostname.includes(d))) return { ok: false, reason: "blocked_domain" };
  if (trimmed.length > 2000) return { ok: false, reason: "url_too_long" };

  const path = (u.pathname + u.search).toLowerCase();
  if (HARD_REJECT_IMAGE_RE.test(path)) return { ok: false, reason: "rejected_logo_or_sprite" };
  // Favicon / apple-touch-icon by exact name
  if (/\/favicon\.ico(\?|$)/i.test(path)) return { ok: false, reason: "rejected_favicon" };
  // Tiny suffix hint (e.g. _16x16, _32x32, _48.png)
  if (/[_-](16|24|32|48|64)x?(16|24|32|48|64)?\.(png|jpe?g|webp|svg)(\?|$)/i.test(path)) {
    return { ok: false, reason: "rejected_tiny_icon" };
  }
  // Title context — if title is literally the brand/store name only, don't reject
  // image based on that alone, but flag as soft.
  if (SOFT_REJECT_IMAGE_RE.test(path)) return { ok: true, soft: true, reason: "soft_banner" };

  return { ok: true };
}

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
  { category: "bags", re: /\b(bags?|tote|backpack|crossbody|clutch|purse|satchel|duffle|messenger|handbag|shoulder\s*bag|hobo|bucket\s*bag|wallet)\b/i },
  { category: "shoes", re: /\b(sneakers?|shoes?|boots?|loafers?|sandals?|trainers?|mules?|heels?|pumps?|flats?|oxfords?|derby|brogues?|espadrilles?|slippers?)\b/i },
  { category: "outerwear", re: /\b(jacket|coat|blazer|parka|bomber|trench|overcoat|windbreaker|anorak|gilet|puffer|cardigan)\b/i },
  { category: "tops", re: /\b(shirt|tee|t-shirt|hoodie|sweater|polo|blouse|tank|knit|sweatshirt|pullover|henley|tunic|camisole|top)\b/i },
  { category: "bottoms", re: /\b(pants|trousers|jeans|shorts|skirt|chinos?|joggers?|leggings?|slacks|culottes)\b/i },
  { category: "dresses", re: /\b(dress|jumpsuit|romper|gown)\b/i },
  { category: "accessories", re: /\b(hat|cap|beanie|scarf|belt|watch|sunglasses|gloves?|tie|necklace|bracelet|earring|ring|fedora|beret|headband|bandana|jewelry|jewellery)\b/i },
];

function inferCategoryFromText(text: string): string | null {
  if (!text) return null;
  for (const { category, re } of CATEGORY_PATTERNS) {
    if (re.test(text)) return category;
  }
  return null;
}

// Server-side category alias map. "clothing" is intentionally NOT a generic
// alias — it only matches the intent if the product name confirms the category.
const CATEGORY_ALIASES: Record<string, string[]> = {
  bags: ["bags", "bag"],
  shoes: ["shoes", "footwear"],
  outerwear: ["outerwear"],
  tops: ["tops"],
  bottoms: ["bottoms"],
  dresses: ["dresses"],
  accessories: ["accessories"],
};

function categoryMatches(intentCategory: string, productCategory: string | null | undefined, productName: string | null | undefined): boolean {
  if (!intentCategory) return true;
  const allowed = CATEGORY_ALIASES[intentCategory] || [intentCategory];
  const pc = (productCategory || "").toLowerCase();
  const nameInferred = inferCategoryFromText(productName || "");
  // Strong match: DB category is in the allowed list
  if (pc && allowed.includes(pc)) return true;
  // Special case: "accessories" can be bags if title says so
  if (intentCategory === "bags" && pc === "accessories") {
    return /\b(bags?|tote|backpack|crossbody|clutch|purse|satchel|handbag|shoulder)\b/i.test(productName || "");
  }
  // Generic "clothing" / "other" / missing → only accept if NAME confirms intent
  if (!pc || pc === "clothing" || pc === "other") {
    return nameInferred === intentCategory;
  }
  // DB category is something else — only accept if name strongly matches intent
  // AND doesn't strongly match a different category
  if (nameInferred === intentCategory) return true;
  return false;
}

function isImageUrlSafe(url: unknown): boolean {
  return imageQualityCheck(url).ok;
}

function getServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

// (duplicate getServiceClient removed)

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

// ─── External expansion + inventory growth ───
function sanitizeSearchQuery(query: string): string {
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

async function fetchFromDiscovery(
  supabase: any,
  query: string,
  limit = 12,
  timeoutMs = 25_000,
): Promise<any[]> {
  const sanitizedQuery = sanitizeSearchQuery(query);
  if (!sanitizedQuery) return [];

  try {
    const baseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!baseUrl || !serviceKey) return [];

    const controller = new AbortController();
    // Tight timeout — search-discovery often hangs on slow upstream sites.
    // We'd rather skip the trigger than crash the worker.
    const effectiveTimeout = Math.min(timeoutMs, 6000);
    const timeout = setTimeout(() => controller.abort(), effectiveTimeout);

    let res: Response;
    try {
      res = await fetch(`${baseUrl}/functions/v1/search-discovery`, {
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
    } catch (fetchErr) {
      // Aborts and network errors here are expected — fall back to DB only.
      clearTimeout(timeout);
      const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
      console.warn(`[SEARCH_DISCOVERY] fetch skipped: ${msg}`);
      // Still try DB read for whatever we already have cached.
      const { data } = await supabase
        .from("product_cache")
        .select("*")
        .eq("is_active", true)
        .eq("image_valid", true)
        .eq("search_query", sanitizedQuery)
        .order("created_at", { ascending: false })
        .limit(Math.min(limit * 2, 24));
      if (!data) return [];
      return data
        .filter((p: any) => isImageUrlSafe(p.image_url) && isFashionProduct(p.name || ""))
        .map((p: any) => autoTagProduct(p));
    } finally {
      clearTimeout(timeout);
    }

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
// maxPerDomainPct lets callers say "no single platform may exceed 30% of
// the result set". This is the investor-demo guarantee against any single
// upstream (e.g. ASOS) flooding the grid.
function enforceDiversity(products: any[], opts: { maxPerBrand?: number; maxPerPlatform?: number; maxPerDomainPct?: number } = {}): any[] {
  const maxBrand = opts.maxPerBrand || 3;
  const maxPlat = opts.maxPerPlatform || 6;
  const maxPerDomainPct = opts.maxPerDomainPct ?? 0.3;

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

  // 30%-per-domain cap. Applied LAST so the percentage is meaningful relative
  // to the post-dedup pool. Domain is derived from source_url host (falls back
  // to platform if URL parse fails).
  if (maxPerDomainPct > 0 && result.length > 4) {
    const total = result.length;
    const cap = Math.max(2, Math.ceil(total * maxPerDomainPct));
    const domainCount: Record<string, number> = {};
    result = result.filter(p => {
      let host = (p.platform || "unknown").toLowerCase();
      try { host = new URL(p.source_url).host.replace(/^www\./, "").toLowerCase(); } catch { /* keep platform */ }
      domainCount[host] = (domainCount[host] || 0) + 1;
      return domainCount[host] <= cap;
    });
  }

  return result;
}

// ─── Multi-source (Apify) parallel fetch ───
// Always called in parallel with DB load. 9s ceiling — if Apify is slow we
// just return the DB pool and let background ingestion catch up.
async function fetchFromMultiSource(query: string, timeoutMs = 9_000): Promise<any[]> {
  const sanitized = sanitizeSearchQuery(query);
  if (!sanitized) return [];
  try {
    const baseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!baseUrl || !serviceKey) return [];
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(`${baseUrl}/functions/v1/multi-source-scraper`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceKey}` },
      body: JSON.stringify({ query: sanitized }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));
    if (!res.ok) return [];
    const data = await res.json().catch(() => null);
    const products = Array.isArray(data?.products) ? data.products : [];
    console.log(`[SEARCH_SUPPLY] ${JSON.stringify({
      stage: "MULTI_SOURCE_PARALLEL",
      query: sanitized,
      cached: !!data?.cached,
      sources: data?.sources || {},
      returned: products.length,
    })}`);
    // Map raw scraper output → product_cache row shape so the db-first branch
    // can merge directly without a separate normalizer.
    return products
      .filter((p: any) => isImageUrlSafe(p.image_url) && p.name && isFashionProduct(p.name))
      .map((p: any) => autoTagProduct({
        external_id: p.external_id,
        name: (p.name || "").slice(0, 200),
        brand: p.brand,
        price: p.price,
        currency: p.currency,
        category: p.category,
        image_url: p.image_url,
        source_url: p.source_url,
        store_name: p.store_name,
        platform: p.platform,
        source_type: p.source_type || "scraper",
        source_trust_level: p.source_trust_level || "medium",
        image_valid: true,
        is_active: true,
        // Synthetic created_at so fresh-first sort works in-memory
        // even before DB roundtrip lands.
        created_at: new Date().toISOString(),
        _is_fresh: true,
      }));
  } catch (e) {
    console.warn("[multi-source] fetch skipped:", (e as Error).message);
    return [];
  }
}


// ─── Google Shopping (SerpAPI) — first-class discovery source ───
// Calls the existing google-shopping edge function which already upserts
// into product_cache. Returns normalized rows for the caller to merge.
async function fetchFromGoogleShopping(query: string, limit = 30, hl?: string, timeoutMs = 4_500): Promise<any[]> {
  const sanitized = sanitizeSearchQuery(query);
  if (!sanitized) return [];
  try {
    const baseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!baseUrl || !serviceKey) return [];
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(`${baseUrl}/functions/v1/google-shopping`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceKey}` },
      body: JSON.stringify({ query: sanitized, limit: Math.min(Math.max(limit, 60), 100), hl }),
      signal: ctrl.signal,
    }).finally(() => clearTimeout(t));
    if (!res.ok) return [];
    const data = await res.json().catch(() => null);
    const products = Array.isArray(data?.products) ? data.products : [];
    console.log(`[SEARCH_SUPPLY] ${JSON.stringify({ stage: "GOOGLE_SHOPPING", query: sanitized, returned: products.length, inserted: data?.inserted ?? 0 })}`);
    return products
      .filter((p: any) => imageQualityCheck(p.image_url).ok && p.name && p.source_url?.startsWith("http") && isFashionProduct(p.name))
      .map((p: any) => autoTagProduct({
        ...p,
        image_valid: true,
        is_active: true,
        // Synthetic created_at so freshness ranks them highly in this request.
        created_at: new Date().toISOString(),
        _is_fresh: true,
      }));
  } catch (e) {
    console.warn("[google-shopping] fetch skipped:", (e as Error).message);
    return [];
  }
}



// ─── Freshness scoring (used to re-rank merged pool) ───
function freshnessScore(p: any): number {
  if (p._is_fresh) return 100;
  const created = p.created_at ? new Date(p.created_at).getTime() : 0;
  if (!created) return 0;
  const ageHours = (Date.now() - created) / 3_600_000;
  if (ageHours < 1)   return 95;
  if (ageHours < 6)   return 80;
  if (ageHours < 24)  return 60;
  if (ageHours < 72)  return 40;
  if (ageHours < 168) return 20; // a week
  return 5;
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
      // Healthy minimum target — was 12, raised so we don't stop at 3-5 items.
      const minTarget = Math.min(clampedLimit, 18);
      const hl = (body.hl || "").toString() || undefined;

      // FAST PATH: DB first (sub-second), with a TIGHT 3.5s budget for one
      // external source (Google Shopping) so the user gets fresh items only
      // when they're ready quickly. Heavier sources (commerce-scraper,
      // multi-source) run in the background via waitUntil to enrich the
      // cache for the next request.
      const dbResult = await loadFromDB(supabase, {
        query: normalizedQuery,
        category,
        styles,
        fit,
        limit: Math.min(clampedLimit, 30),
        excludeIds,
        randomize: false,
      });

      // Race Google Shopping against a 3.5s budget — return whatever's ready.
      const gShop = await Promise.race([
        fetchFromGoogleShopping(normalizedQuery, 60, hl, 3_500)
          .catch(() => [] as any[]),
        new Promise<any[]>((resolve) => setTimeout(() => resolve([]), 3_500)),
      ]);

      // Background enrichment — does NOT block response.
      const bgTasks = (async () => {
        try {
          const [cs, ms] = await Promise.all([
            fetchFromCommerceScraper(normalizedQuery, Math.min(clampedLimit, 24))
              .catch(() => [] as any[]),
            fetchFromMultiSource(normalizedQuery, 12_000)
              .catch(() => [] as any[]),
          ]);
          const merged = mergeUniqueProducts(cs.map(autoTagProduct), ms);
          if (merged.length > 0) {
            await cacheToDB(supabase, merged, normalizedQuery);
          }
        } catch (e) {
          console.warn("[bg-enrich] failed:", (e as Error).message);
        }
      })();
      try {
        // @ts-ignore EdgeRuntime is available in Supabase Edge Functions
        EdgeRuntime.waitUntil(bgTasks);
      } catch {
        /* not in edge runtime — let it dangle */
      }

      const externalResult: any[] = [];

      // gShop already lives in product_cache (google-shopping upserts directly).
      // Commerce-scraper results still need caching.
      externalProducts = mergeUniqueProducts(gShop, externalResult);
      dbProducts = dbResult;

      const storedCount = 0; // background task handles caching now

      let discoveryProducts: any[] = [];
      let allProducts = enforceDiversity(mergeUniqueProducts(externalProducts, dbProducts));

      // Single DB-broadening fallback if we're really short. No discovery call
      // here — that 6s edge-function chain blocks the user response.
      if (allProducts.length < minTarget) {
        const broadenedDb = await loadFromDB(supabase, {
          category,
          styles,
          fit,
          limit: minTarget * 2,
          excludeIds: allProducts.map((p: any) => p.external_id || p.id),
          randomize: true,
        });
        allProducts = enforceDiversity(mergeUniqueProducts(allProducts, broadenedDb));
      }

      // Re-rank: freshness-boost merged pool. Pure DB items with high relevance
      // still beat fresh-but-irrelevant items because relevance was already
      // baked into the order returned by loadFromDB.
      allProducts = allProducts
        .map((p) => ({ ...p, _freshness: freshnessScore(p) }))
        .sort((a, b) => (b._freshness || 0) - (a._freshness || 0));


      // ─── Category intent enforcement (HARD when query is product-typed) ───
      // Inference from the query text takes priority over the (often generic
      // "clothing") category arg passed by the client.
      const inferredFromQuery = inferCategoryFromText(normalizedQuery);
      const GENERIC_CATS = new Set(["", "clothing", "other", "general", "fashion"]);
      const categoryArgIsSpecific = category && !GENERIC_CATS.has(String(category).toLowerCase());
      const intentCategory = inferredFromQuery || (categoryArgIsSpecific ? category : null);
      const queryHasExplicitCategory = !!inferredFromQuery;
      if (intentCategory) {
        const before = allProducts.length;
        const filtered = allProducts.filter((p: any) => categoryMatches(intentCategory, p.category, p.name));
        if (queryHasExplicitCategory) {
          console.log(`[SEARCH_INTENT] HARD LOCK category="${intentCategory}" filtered ${before} → ${filtered.length} (query="${normalizedQuery}")`);
          allProducts = filtered;
        } else if (filtered.length >= Math.min(6, minTarget / 2)) {
          console.log(`[SEARCH_INTENT] soft category="${intentCategory}" filtered ${before} → ${filtered.length}`);
          allProducts = filtered;
        } else {
          console.log(`[SEARCH_INTENT] soft category="${intentCategory}" would leave only ${filtered.length}, keeping unfiltered`);
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
      const minTarget = Math.min(clampedLimit, 18);
      const sanitizedQuery = query ? sanitizeSearchQuery(query) : "";
      const hl = (body.hl || "").toString() || undefined;

      // FAST PATH: load DB pool first. Then race ONE external (Google
      // Shopping) against a 3.5s budget so the user always gets a response
      // in well under 5s. Heavier sources (multi-source/ScrapingBee,
      // commerce-scraper) run in the background to enrich the cache for
      // subsequent requests.
      const dbInitial = await loadFromDB(supabase, {
        query: query || undefined,
        category,
        styles,
        fit,
        limit: Math.min(clampedLimit, 30),
        excludeIds,
        randomize,
      });
      dbProducts = dbInitial;

      const gShop = sanitizedQuery
        ? await Promise.race([
            fetchFromGoogleShopping(sanitizedQuery, 60, hl, 3_500).catch(() => [] as any[]),
            new Promise<any[]>((resolve) => setTimeout(() => resolve([]), 3_500)),
          ])
        : [];
      externalProducts = gShop;

      // Fire-and-forget background enrichment (multi-source + commerce-scraper).
      if (sanitizedQuery) {
        const bgTasks = (async () => {
          try {
            const [ms, cs] = await Promise.all([
              fetchFromMultiSource(sanitizedQuery, 12_000).catch(() => [] as any[]),
              dbProducts.length < 8
                ? fetchFromCommerceScraper(sanitizedQuery, Math.min(clampedLimit, 18))
                    .then((p) => p.map(autoTagProduct))
                    .catch(() => [] as any[])
                : Promise.resolve([] as any[]),
            ]);
            const merged = mergeUniqueProducts(ms, cs);
            if (merged.length > 0) await cacheToDB(supabase, merged, sanitizedQuery);
          } catch (e) {
            console.warn("[bg-enrich db-first] failed:", (e as Error).message);
          }
        })();
        try {
          // @ts-ignore EdgeRuntime is available in Supabase Edge Functions
          EdgeRuntime.waitUntil(bgTasks);
        } catch { /* dangle */ }
      }

      const needsExpansion = false; // now handled by background tasks
      let discoveryProducts: any[] = [];
      void needsExpansion;

      // ─── FRESH-FIRST MERGE + new-batch injection ───
      // 1. Externals (Apify + commerce-scraper) come first — they are the
      //    truly new products this request surfaced.
      // 2. Then the DB pool, sorted by created_at DESC so the freshest
      //    cached items follow.
      // 3. Guarantee 10–20 fresh items at the head of the response if any
      //    were fetched (the "new batch injection" rule).
      const freshHead = externalProducts.slice(0, Math.min(20, Math.max(10, externalProducts.length)));
      const dbSortedByFreshness = [...dbProducts].sort((a, b) => {
        const at = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bt = b.created_at ? new Date(b.created_at).getTime() : 0;
        return bt - at;
      });
      let allProducts = mergeUniqueProducts(freshHead, dbSortedByFreshness);
      // Append remaining externals (beyond the head) and any discovery items.
      allProducts = mergeUniqueProducts(allProducts, externalProducts.slice(freshHead.length));
      allProducts = mergeUniqueProducts(allProducts, discoveryProducts);

      if (allProducts.length < minTarget) {
        const trending = await loadFromDB(supabase, {
          limit: minTarget * 2,
          excludeIds: [...excludeIds, ...allProducts.map((p: any) => p.external_id || p.id)],
          randomize: true,
        });
        allProducts = mergeUniqueProducts(allProducts, trending);
      }

      // Diversity + 30%-per-domain cap.
      allProducts = enforceDiversity(allProducts, { maxPerDomainPct: 0.3 });

      // ─── Category intent enforcement (HARD when query is product-typed) ───
      const inferredFromQuery2 = inferCategoryFromText(query || "");
      const GENERIC_CATS2 = new Set(["", "clothing", "other", "general", "fashion"]);
      const categoryArgIsSpecific2 = category && !GENERIC_CATS2.has(String(category).toLowerCase());
      const intentCategory2 = inferredFromQuery2 || (categoryArgIsSpecific2 ? category : null);
      const queryHasExplicitCategory2 = !!inferredFromQuery2;
      if (intentCategory2) {
        const before = allProducts.length;
        const filtered = allProducts.filter((p: any) => categoryMatches(intentCategory2, p.category, p.name));
        if (queryHasExplicitCategory2) {
          if (filtered.length === 0) {
            console.log(`[SEARCH_INTENT] (db-first) HARD LOCK would empty results, broadening by category="${intentCategory2}"`);
            const categoryFallback = await loadFromDB(supabase, {
              category: intentCategory2,
              limit: minTarget * 2,
              excludeIds,
              randomize: true,
            });
            allProducts = categoryFallback.filter((p: any) => categoryMatches(intentCategory2, p.category, p.name));
          } else {
            console.log(`[SEARCH_INTENT] (db-first) HARD LOCK category="${intentCategory2}" filtered ${before} → ${filtered.length} (query="${query}")`);
            allProducts = filtered;
          }
        } else if (filtered.length >= Math.min(6, minTarget / 2)) {
          console.log(`[SEARCH_INTENT] (db-first) soft category="${intentCategory2}" filtered ${before} → ${filtered.length}`);
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
        multi_source_fresh: multiSourceFresh.length,
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
