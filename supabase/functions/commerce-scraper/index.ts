import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const FIRECRAWL_V2 = "https://api.firecrawl.dev/v2";

// ── SOURCE LOCK ────────────────────────────────────────────────────────────
// Locks commerce-scraper to KR-first platforms. Override with ENABLED_PLATFORMS
// env var, e.g. ENABLED_PLATFORMS="musinsa,29cm,wconcept,ssg".
// Internal platform IDs match the keys in PLATFORMS below.
const DEFAULT_ENABLED_PLATFORMS = "musinsa,29cm,wconcept,ssg";
const ENABLED_PLATFORMS = new Set(
  (Deno.env.get("ENABLED_PLATFORMS") || DEFAULT_ENABLED_PLATFORMS)
    .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
);
function platformEnabled(id: string): boolean {
  return ENABLED_PLATFORMS.has(id.toLowerCase());
}

// ─── Blocked image domains ───
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

// ─── Platform configs: public search URLs only ───
// All platforms re-enabled. We tolerate partial failure: each source is
// attempted; if it times out or 5xx's, we skip it for THIS request only and
// continue with whatever results other sources returned. Never disable
// permanently — a source that fails now may work in 2 minutes.
const PLATFORMS: Record<string, {
  searchUrl: (q: string) => string;
  name: string;
  enabled: boolean;
  trustLevel: "high" | "medium" | "low";
  priority: number; // lower = called first
}> = {
  asos: {
    searchUrl: (q: string) =>
      `https://www.asos.com/search/?q=${encodeURIComponent(q)}`,
    name: "ASOS",
    enabled: true,
    trustLevel: "medium",
    priority: 1, // fastest, most reliable
  },
  ssense: {
    searchUrl: (q: string) =>
      `https://www.ssense.com/en-us/men?q=${encodeURIComponent(q)}`,
    name: "SSENSE",
    enabled: true,
    trustLevel: "high",
    priority: 2,
  },
  farfetch: {
    searchUrl: (q: string) =>
      `https://www.farfetch.com/shopping/men/search/items.aspx?q=${encodeURIComponent(q)}`,
    name: "Farfetch",
    enabled: true,
    trustLevel: "high",
    priority: 3,
  },
  naver: {
    searchUrl: (q: string) =>
      `https://search.shopping.naver.com/search/all?query=${encodeURIComponent(q)}`,
    name: "Naver Shopping",
    enabled: true,
    trustLevel: "medium",
    priority: 4,
  },
  ssg: {
    searchUrl: (q: string) =>
      `https://www.ssg.com/search.ssg?target=all&query=${encodeURIComponent(q)}`,
    name: "SSG",
    enabled: true,
    trustLevel: "medium",
    priority: 5,
  },
};

interface ScrapedProduct {
  external_id: string;
  name: string;
  brand: string;
  price: string;
  category: string;
  subcategory: string;
  style_tags: string[];
  color_tags: string[];
  fit: string;
  image_url: string;
  source_url: string;
  store_name: string;
  reason: string;
  platform: string;
  image_valid: boolean;
  is_active: boolean;
  source_type: string;
  source_trust_level: string;
}

// ─── Rate limiting ───
// Lowered from 5000ms → 800ms. The 5s value blocked all parallel expanded queries
// (5 queries × 5 platforms within ~3s of each other = nearly all platforms locked out),
// which is why the logs show "0 external" for every search.
const platformLastCall: Record<string, number> = {};
const PLATFORM_COOLDOWN_MS = 800;

function canCallPlatform(platformId: string): boolean {
  const last = platformLastCall[platformId] || 0;
  return Date.now() - last >= PLATFORM_COOLDOWN_MS;
}

function getFirecrawlKey(): string {
  const key = Deno.env.get("FIRECRAWL_API_KEY");
  if (!key) throw new Error("FIRECRAWL_API_KEY is not configured");
  return key;
}

function getServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

// ─── Scrape a single platform search page ───
async function scrapePlatform(
  platformId: string,
  query: string,
  apiKey: string
): Promise<ScrapedProduct[]> {
  const platform = PLATFORMS[platformId];
  if (!platform?.enabled) return [];
  // Source-lock: silently skip platforms not in ENABLED_PLATFORMS so we
  // don't burn Firecrawl credits on disabled sites.
  if (!platformEnabled(platformId)) return [];

  // Rate limit per platform
  if (!canCallPlatform(platformId)) {
    console.log(`[${platformId}] Rate limited, skipping`);
    return [];
  }
  platformLastCall[platformId] = Date.now();

  const searchUrl = platform.searchUrl(query);
  const startedAt = Date.now();
  console.log(`[${platformId}] START scrape: ${searchUrl}`);

  // Tighter per-attempt timeout (15s) so one slow platform can't starve others.
  // Single attempt only — retry is wasteful when 5 platforms run in parallel.
  const MAX_ATTEMPTS = 1;
  const PER_ATTEMPT_TIMEOUT_MS = 15000;
  let lastError: string | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PER_ATTEMPT_TIMEOUT_MS);

    try {
      const response = await fetch(`${FIRECRAWL_V2}/scrape`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: searchUrl,
          formats: [
            {
              type: "json",
              schema: {
                type: "object",
                properties: {
                  products: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        brand: { type: "string" },
                        price: { type: "string" },
                        image_url: { type: "string" },
                        product_url: { type: "string" },
                        category: { type: "string" },
                      },
                      required: ["title", "price"],
                    },
                  },
                },
              },
              prompt: `Extract ONLY fashion product listings (clothing, shoes, bags, accessories) from this ${platform.name} search results page. IGNORE: editorial images, people photos, lifestyle images, banners, ads. For each PRODUCT, get: title (must be a product name like "Oversized Cotton Hoodie"), brand, price (with currency symbol), image_url (full https URL of the product image, NOT editorial/lifestyle photos), product_url (full https URL to the product detail page), and category (clothing/shoes/bags/accessories). Return up to 12 products.`,
            },
          ],
          waitFor: 1000,
          onlyMainContent: true,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        const errText = await response.text();
        lastError = `${response.status}: ${errText.slice(0, 120)}`;
        console.error(`[${platformId}] Firecrawl error ${lastError}`);
        return [];
      }

      const result = await response.json();
      return await extractProducts(result, platform, platformId, startedAt);
    } catch (e) {
      clearTimeout(timeout);
      const msg = e instanceof Error ? e.message : String(e);
      lastError = msg;
      const elapsed = Date.now() - startedAt;
      console.error(`[${platformId}] failed after ${elapsed}ms: ${msg}`);
      return [];
    }
  }
  console.error(`[${platformId}] gave up: ${lastError}`);
  return [];
}

// Extracted so retry loop above stays readable.
async function extractProducts(
  result: any,
  platform: { name: string; trustLevel: string },
  platformId: string,
  startedAt: number
): Promise<ScrapedProduct[]> {
  try {
    const extracted = result?.json?.products || result?.data?.json?.products || [];

    // RELAXED filter: just need a title, price, safe image URL, and a product link.
    // Fashion-relevance is checked once via isFashionProduct (which already covers
    // a wide vocabulary). The previous double-whitelist was rejecting valid items.
    const NON_PRODUCT_KEYWORDS = /\b(lookbook|editorial|photoshoot|how\s+to\s+wear|style\s+guide|fashion\s+week|runway|behind\s+the\s+scenes)\b/i;

    const candidates = extracted.filter(
      (p: any) =>
        p.title &&
        p.title.length >= 3 &&
        p.title.length <= 200 &&
        p.price &&
        isImageUrlSafe(p.image_url) &&
        p.product_url?.startsWith("http") &&
        !NON_PRODUCT_KEYWORDS.test(p.title)
    );

    // HEAD-validate images in parallel — but accept on failure (relaxed validation).
    // validateImageHead now returns true on network errors so we don't discard
    // every external result over a flaky probe.
    const validated = await Promise.all(
      candidates.slice(0, 12).map(async (p: any) => {
        const ok = await validateImageHead(p.image_url);
        return ok ? p : null;
      })
    );

    const products = validated
      .filter(Boolean)
      .map((p: any, i: number) => ({
        external_id: `${platformId}-${hashString(p.product_url || p.title)}-${i}`,
        name: (p.title || "").slice(0, 150),
        brand: p.brand || platform.name,
        price: p.price || "",
        category: mapCategory(p.category || ""),
        subcategory: p.category || "",
        style_tags: inferStyleFromTitle(p.title),
        color_tags: inferColorFromTitle(p.title),
        fit: "regular",
        image_url: p.image_url,
        source_url: p.product_url,
        store_name: platform.name,
        reason: `Found on ${platform.name}`,
        platform: platformId,
        image_valid: true,
        is_active: true,
        source_type: "scraper",
        source_trust_level: platform.trustLevel,
      }));
    const elapsed = Date.now() - startedAt;
    console.log(`[${platformId}] DONE in ${elapsed}ms — extracted=${extracted.length}, candidates=${candidates.length}, validated=${products.length}`);
    return products;
  } catch (e) {
    console.error(`[${platformId}] Scrape failed:`, e);
    return [];
  }
}

// ─── Firecrawl Web Search fallback ───
// When platform scrapers fail or return too few items, hit Firecrawl Search
// for a generic shopping query. Fast (~3s), no JS rendering. We treat results
// as a "web" platform with medium trust.
async function firecrawlSearchFallback(
  query: string,
  apiKey: string,
  limit = 10
): Promise<ScrapedProduct[]> {
  const startedAt = Date.now();
  console.log(`[firecrawl-search] START fallback for "${query}"`);
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(`${FIRECRAWL_V2}/search`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: `${query} buy shop product`,
        limit: Math.min(limit, 15),
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) {
      console.error(`[firecrawl-search] HTTP ${res.status}`);
      return [];
    }
    const data = await res.json();
    const results: any[] = data?.data?.web || data?.web || data?.data || [];
    const products: ScrapedProduct[] = [];
    for (const r of results.slice(0, limit)) {
      const url = r.url || r.link;
      const title = (r.title || "").slice(0, 150);
      if (!url || !title || !isFashionProduct(title)) continue;
      // No image from search → skip (we still need a visual). Real ingestion
      // will happen on next platform scrape; this fallback is best-effort only.
      const img = r.image || r.thumbnail || r.metadata?.ogImage;
      if (!isImageUrlSafe(img)) continue;
      products.push({
        external_id: `web-${hashString(url)}`,
        name: title,
        brand: r.metadata?.siteName || "",
        price: "—",
        category: mapCategory(title),
        subcategory: "",
        style_tags: inferStyleFromTitle(title),
        color_tags: inferColorFromTitle(title),
        fit: "regular",
        image_url: img,
        source_url: url,
        store_name: r.metadata?.siteName || "Web",
        reason: "Web search result",
        platform: "web",
        image_valid: true,
        is_active: true,
        source_type: "web_search",
        source_trust_level: "low",
      });
    }
    const elapsed = Date.now() - startedAt;
    console.log(`[firecrawl-search] DONE in ${elapsed}ms — results=${results.length}, validated=${products.length}`);
    return products;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[firecrawl-search] failed: ${msg}`);
    return [];
  }
}

// Trusted image CDNs that frequently block HEAD requests but always serve real images.
// We accept these on URL pattern alone instead of probing them — probing was rejecting
// 100% of SSENSE results (img.ssensemedia.com returns 4xx on HEAD).
const TRUSTED_IMAGE_HOSTS = [
  "ssensemedia.com",
  "asos-media.com",
  "ssgcdn.com",
  "farfetch-contents.com",
  "scene7.com",
  "shopifycdn.com",
  "cdninstagram.com",
  "akamaized.net",
];

function isTrustedImageHost(url: string): boolean {
  try {
    const u = new URL(url);
    return TRUSTED_IMAGE_HOSTS.some((h) => u.hostname.endsWith(h));
  } catch {
    return false;
  }
}

/** Validate that a URL returns a real image. Trusted CDNs skip the HEAD probe. */
async function validateImageHead(url: string): Promise<boolean> {
  if (!isImageUrlSafe(url)) return false;
  if (isTrustedImageHost(url)) return true; // skip probe — known reliable
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      redirect: "follow",
    });
    clearTimeout(timeout);
    if (!res.ok) return false;
    const ct = res.headers.get("content-type") || "";
    return ct.startsWith("image/");
  } catch {
    // Network/timeout: accept rather than reject. Better to show a maybe-broken
    // image (caught by client onError) than to throw away every external result.
    return true;
  }
}

// ─── Helpers ───
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    hash = ((hash << 5) - hash + c) | 0;
  }
  return Math.abs(hash).toString(36);
}

function mapCategory(cat: string): string {
  const c = (cat || "").toLowerCase();
  if (c.includes("shoe") || c.includes("sneaker") || c.includes("boot")) return "shoes";
  if (c.includes("bag") || c.includes("purse") || c.includes("tote")) return "bags";
  if (c.includes("watch") || c.includes("jewel") || c.includes("accessor") || c.includes("hat") || c.includes("scarf")) return "accessories";
  return "clothing";
}

function inferStyleFromTitle(title: string): string[] {
  const t = (title || "").toLowerCase();
  const tags: string[] = [];
  if (t.includes("oversiz")) tags.push("street");
  if (t.includes("slim") || t.includes("tailored")) tags.push("formal");
  if (t.includes("vintage")) tags.push("vintage");
  if (t.includes("sport") || t.includes("athlet")) tags.push("sporty");
  if (t.includes("casual") || t.includes("comfort")) tags.push("casual");
  if (t.includes("minimal") || t.includes("clean")) tags.push("minimal");
  if (t.includes("luxury") || t.includes("premium")) tags.push("classic");
  if (tags.length === 0) tags.push("casual");
  return tags;
}

function inferColorFromTitle(title: string): string[] {
  const t = (title || "").toLowerCase();
  const colors: string[] = [];
  const colorMap: Record<string, string> = {
    black: "black", white: "white", navy: "navy", grey: "grey", gray: "grey",
    blue: "blue", red: "red", green: "green", brown: "brown", beige: "beige",
    cream: "cream", pink: "pink", khaki: "khaki", camel: "camel",
  };
  for (const [keyword, color] of Object.entries(colorMap)) {
    if (t.includes(keyword)) colors.push(color);
  }
  return colors;
}

// ─── Cache to DB ───
async function cacheToDB(supabase: any, products: ScrapedProduct[]): Promise<number> {
  if (!products.length) return 0;

  // Dedup by source_url before insert
  const seenUrls = new Set<string>();
  const rows = products
    .filter(p => isImageUrlSafe(p.image_url))
    .filter(p => {
      if (!p.source_url) return true;
      if (seenUrls.has(p.source_url)) return false;
      seenUrls.add(p.source_url);
      return true;
    })
    .map((p) => ({
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
      source_type: p.source_type || "scraper",
      source_trust_level: p.source_trust_level || "medium",
      last_validated: new Date().toISOString(),
    }));

  const { error } = await supabase
    .from("product_cache")
    .upsert(rows, { onConflict: "platform,external_id", ignoreDuplicates: false });

  if (error) {
    console.error("Cache error:", error.message);
    return 0;
  }
  return rows.length;
}

// ─── Log rejected products for admin monitoring ───
async function logRejectedProducts(supabase: any, products: any[], reason: string) {
  const rows = products.slice(0, 20).map(p => ({
    product_name: (p.title || p.name || "Unknown").slice(0, 200),
    brand: p.brand || null,
    image_url: (p.image_url || "").slice(0, 500),
    failure_reason: reason,
    source: p.platform || "unknown",
  }));

  await supabase.from("image_failures").insert(rows).catch((e: any) => 
    console.error("Failed to log rejected products:", e)
  );
}

// ─── Input validation ───
function validateInput(body: any): { valid: boolean; error?: string } {
  if (!body.query || typeof body.query !== "string" || body.query.trim().length < 2) {
    return { valid: false, error: "Query must be at least 2 characters" };
  }
  if (body.query.length > 200) {
    return { valid: false, error: "Query too long (max 200 characters)" };
  }
  if (body.limit && (typeof body.limit !== "number" || body.limit < 1 || body.limit > 30)) {
    return { valid: false, error: "Limit must be 1-30" };
  }
  return { valid: true };
}

// ─── Main handler ───
serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();

    const validation = validateInput(body);
    if (!validation.valid) {
      return new Response(
        JSON.stringify({ error: validation.error }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { query, platforms, limit = 20 } = body;
    const clampedLimit = Math.min(limit, 30);

    const apiKey = getFirecrawlKey();
    const supabase = getServiceClient();

    // Sanitize query
    const sanitizedQuery = query.replace(/[<>"'`;]/g, "").trim().slice(0, 100);

    const requestedPlatforms: string[] = platforms || Object.keys(PLATFORMS);
    const enabledPlatforms = requestedPlatforms
      .filter((p) => PLATFORMS[p]?.enabled && canCallPlatform(p))
      .sort((a, b) => (PLATFORMS[a].priority || 99) - (PLATFORMS[b].priority || 99));

    console.log(
      `commerce-scraper: query="${sanitizedQuery}", platforms=[${enabledPlatforms.join(",")}]`
    );

    // Run ALL enabled platforms in parallel — each capped at 15s, so wall-clock
    // is ~15s regardless of platform count. Partial failure is expected and OK:
    // we collect whatever returns. allSettled means one bad source can't poison
    // the batch.
    const perPlatformStats: Record<string, number> = {};
    const settled = await Promise.allSettled(
      enabledPlatforms.map((p) => scrapePlatform(p, sanitizedQuery, apiKey))
    );
    let allProducts: ScrapedProduct[] = [];
    settled.forEach((res, i) => {
      const platformId = enabledPlatforms[i];
      if (res.status === "fulfilled") {
        perPlatformStats[platformId] = res.value.length;
        allProducts.push(...res.value);
      } else {
        perPlatformStats[platformId] = 0;
        console.error(`[${platformId}] rejected:`, res.reason);
      }
    });
    console.log(`commerce-scraper per-platform: ${JSON.stringify(perPlatformStats)}`);

    // FALLBACK: if scraping returned too few items, supplement with web search.
    if (allProducts.length < 6) {
      try {
        const webResults = await firecrawlSearchFallback(sanitizedQuery, apiKey, 12);
        allProducts.push(...webResults);
      } catch (e) {
        console.error("firecrawl-search fallback failed:", e);
      }
    }

    // Track rejected products for admin monitoring
    const preFilterCount = allProducts.length;

    // Filter non-fashion items
    allProducts = allProducts.filter((p) => isFashionProduct(p.name));

    // Deduplicate by title similarity
    const seen = new Set<string>();
    allProducts = allProducts.filter((p) => {
      const key = p.name.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 30);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // URL-based dedup
    const seenUrls = new Set<string>();
    allProducts = allProducts.filter((p) => {
      if (!p.source_url) return true;
      if (seenUrls.has(p.source_url)) return false;
      seenUrls.add(p.source_url);
      return true;
    });

    // Brand diversity: max 3 per brand
    const brandCount: Record<string, number> = {};
    allProducts = allProducts.filter((p) => {
      const b = (p.brand || "").toLowerCase();
      brandCount[b] = (brandCount[b] || 0) + 1;
      return brandCount[b] <= 3;
    });

    // Platform diversity: max 5 per platform
    const platCount: Record<string, number> = {};
    allProducts = allProducts.filter((p) => {
      platCount[p.platform] = (platCount[p.platform] || 0) + 1;
      return platCount[p.platform] <= 5;
    });

    allProducts = allProducts.slice(0, clampedLimit);

    // Log rejection stats
    const rejectedCount = preFilterCount - allProducts.length;
    if (rejectedCount > 0) {
      console.log(`Rejected ${rejectedCount} products (duplicates/diversity limits)`);
    }
    console.log(`commerce-scraper RESULT: ${allProducts.length} products from ${enabledPlatforms.length} platforms`);

    // Cache to DB in background
    cacheToDB(supabase, allProducts)
      .then((n) => {
        if (n > 0) console.log(`Cached ${n} scraped products`);
      })
      .catch((e) => console.error("Cache error:", e));

    const normalized = allProducts.map((p) => ({
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

    return new Response(
      JSON.stringify({
        products: normalized,
        count: normalized.length,
        platforms: enabledPlatforms,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (e) {
    console.error("commerce-scraper error:", e);
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
