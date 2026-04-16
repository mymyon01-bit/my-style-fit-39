import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const FIRECRAWL_V2 = "https://api.firecrawl.dev/v2";

// ─── Platform configs: public search URLs + extractors ───
const PLATFORMS: Record<string, {
  searchUrl: (q: string) => string;
  name: string;
  enabled: boolean;
}> = {
  naver: {
    searchUrl: (q: string) =>
      `https://search.shopping.naver.com/search/all?query=${encodeURIComponent(q)}`,
    name: "Naver Shopping",
    enabled: true,
  },
  ssense: {
    searchUrl: (q: string) =>
      `https://www.ssense.com/en-us/men?q=${encodeURIComponent(q)}`,
    name: "SSENSE",
    enabled: true,
  },
  farfetch: {
    searchUrl: (q: string) =>
      `https://www.farfetch.com/shopping/men/search/items.aspx?q=${encodeURIComponent(q)}`,
    name: "Farfetch",
    enabled: true,
  },
  asos: {
    searchUrl: (q: string) =>
      `https://www.asos.com/search/?q=${encodeURIComponent(q)}`,
    name: "ASOS",
    enabled: true,
  },
  ssg: {
    searchUrl: (q: string) =>
      `https://www.ssg.com/search.ssg?target=all&query=${encodeURIComponent(q)}`,
    name: "SSG",
    enabled: true,
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

  const searchUrl = platform.searchUrl(query);
  console.log(`[${platformId}] Scraping: ${searchUrl}`);

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
            prompt: `Extract all visible product listings from this ${platform.name} search results page. For each product, get: title, brand, price (with currency symbol), image_url (full https URL), product_url (full https URL to the product detail page), and category (clothing/shoes/bags/accessories). Return up to 15 products.`,
          },
        ],
        waitFor: 3000,
        onlyMainContent: true,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[${platformId}] Firecrawl error ${response.status}: ${errText}`);
      return [];
    }

    const result = await response.json();
    const extracted = result?.json?.products || result?.data?.json?.products || [];

    return extracted
      .filter(
        (p: any) =>
          p.title &&
          p.price &&
          p.image_url?.startsWith("http") &&
          p.product_url?.startsWith("http")
      )
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
      }));
  } catch (e) {
    console.error(`[${platformId}] Scrape failed:`, e);
    return [];
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
  const rows = products.map((p) => ({
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
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const { query, platforms, limit = 20 } = body;

    if (!query || typeof query !== "string" || query.trim().length < 2) {
      return new Response(
        JSON.stringify({ error: "Query must be at least 2 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = getFirecrawlKey();
    const supabase = getServiceClient();

    // Determine which platforms to scrape
    const requestedPlatforms: string[] = platforms || Object.keys(PLATFORMS);
    const enabledPlatforms = requestedPlatforms.filter(
      (p) => PLATFORMS[p]?.enabled
    );

    console.log(
      `commerce-scraper: query="${query}", platforms=[${enabledPlatforms.join(",")}]`
    );

    // Scrape platforms in parallel (max 3 concurrent to stay within rate limits)
    const batchSize = 3;
    let allProducts: ScrapedProduct[] = [];

    for (let i = 0; i < enabledPlatforms.length; i += batchSize) {
      const batch = enabledPlatforms.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map((p) => scrapePlatform(p, query, apiKey))
      );
      allProducts.push(...results.flat());
    }

    // Deduplicate by title similarity
    const seen = new Set<string>();
    allProducts = allProducts.filter((p) => {
      const key = p.name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")
        .slice(0, 30);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Brand diversity: max 3 per brand
    const brandCount: Record<string, number> = {};
    allProducts = allProducts.filter((p) => {
      const b = (p.brand || "").toLowerCase();
      brandCount[b] = (brandCount[b] || 0) + 1;
      return brandCount[b] <= 3;
    });

    // Platform diversity: max 5 per platform in top results
    const platCount: Record<string, number> = {};
    allProducts = allProducts.filter((p) => {
      platCount[p.platform] = (platCount[p.platform] || 0) + 1;
      return platCount[p.platform] <= 5;
    });

    allProducts = allProducts.slice(0, limit);

    // Cache to DB in background
    cacheToDB(supabase, allProducts)
      .then((n) => {
        if (n > 0) console.log(`Cached ${n} scraped products`);
      })
      .catch((e) => console.error("Cache error:", e));

    // Normalize for response
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
