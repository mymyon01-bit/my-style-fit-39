// User-submitted product URL → scrape via Firecrawl → save to product_cache → reward +1 star.
// Designed to be called from the Discover "+ 상품 넣기" flow.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const FIRECRAWL_V2 = "https://api.firecrawl.dev/v2";

const BLOCKED_IMAGE_DOMAINS = [
  "via.placeholder.com", "placehold.it", "placekitten.com",
  "dummyimage.com", "fakeimg.pl", "picsum.photos", "lorempixel.com",
];

function isImageUrlSafe(url: unknown): boolean {
  if (!url || typeof url !== "string") return false;
  try {
    const u = new URL(url.trim());
    if (u.protocol !== "https:") return false;
    if (BLOCKED_IMAGE_DOMAINS.some((d) => u.hostname.includes(d))) return false;
    if (url.length > 2000) return false;
    return true;
  } catch {
    return false;
  }
}

function inferCategory(text: string): string {
  const t = text.toLowerCase();
  if (/(shoe|sneaker|boot|loafer|sandal|heel|pump|mule)/i.test(t)) return "shoes";
  if (/(bag|tote|backpack|clutch|crossbody|purse)/i.test(t)) return "bags";
  if (/(watch|ring|necklace|earring|bracelet|sunglass|belt|hat|cap|beanie|scarf|glove)/i.test(t)) return "accessories";
  if (/(pants?|trousers?|jeans?|shorts?|skirt|legging|chino|jogger|slack)/i.test(t)) return "bottoms";
  if (/(dress|jumpsuit|romper)/i.test(t)) return "dresses";
  if (/(jacket|coat|blazer|hoodie|sweater|cardigan|vest|shirt|tee|top|polo|blouse|knit|tunic|tank|bomber|parka)/i.test(t)) return "tops";
  return "tops";
}

function inferFit(text: string): string {
  const t = text.toLowerCase();
  if (/oversized|relaxed|loose|baggy/i.test(t)) return "oversized";
  if (/slim|skinny|fitted/i.test(t)) return "slim";
  return "regular";
}

function inferStyle(text: string): string[] {
  const out: string[] = [];
  const t = text.toLowerCase();
  if (/minimal|clean|simple/i.test(t)) out.push("minimal");
  if (/street|urban/i.test(t)) out.push("street");
  if (/classic|timeless/i.test(t)) out.push("classic");
  if (/casual|everyday/i.test(t)) out.push("casual");
  if (/formal|suit|business/i.test(t)) out.push("formal");
  if (/vintage|retro/i.test(t)) out.push("vintage");
  return out;
}

function extractPrice(text: string): string | null {
  // Match common currency-prefixed numbers (₩100,000 / $89.99 / €120 / 89000원)
  const m = text.match(/(?:[$€£¥₩]|USD|EUR|KRW)\s?[\d,]+(?:\.\d{1,2})?|\d{2,7}\s?원/i);
  return m ? m[0].trim() : null;
}

function extractBrandFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "").split(".")[0];
    return host.charAt(0).toUpperCase() + host.slice(1);
  } catch {
    return "";
  }
}

interface ScrapedMeta {
  title?: string;
  description?: string;
  ogImage?: string;
  ogSiteName?: string;
  sourceURL?: string;
}

async function firecrawlScrape(url: string, apiKey: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  try {
    const res = await fetch(`${FIRECRAWL_V2}/scrape`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: ["markdown"],
        onlyMainContent: true,
        waitFor: 1500,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) {
      throw new Error(`Firecrawl ${res.status}`);
    }
    const data = await res.json();
    // v2 returns { success, data: { markdown, metadata } } OR flat { markdown, metadata }
    const payload = data?.data ?? data;
    const markdown: string = payload?.markdown ?? "";
    const metadata: ScrapedMeta = payload?.metadata ?? {};
    return { markdown, metadata };
  } catch (e) {
    clearTimeout(timeout);
    throw e;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!jwt) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");

    if (!firecrawlKey) {
      return new Response(JSON.stringify({ error: "scraper_not_configured" }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve user from JWT
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const rawUrl = String(body?.url ?? "").trim();
    if (!rawUrl) {
      return new Response(JSON.stringify({ error: "missing_url" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(rawUrl);
      if (!/^https?:$/.test(parsedUrl.protocol)) throw new Error("bad protocol");
    } catch {
      return new Response(JSON.stringify({ error: "invalid_url" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    // Dedupe — if URL was already submitted, return the existing product
    {
      const { data: existing } = await admin
        .from("product_cache")
        .select("id, name, brand, image_url, source_url, category, fit, price")
        .eq("source_url", rawUrl)
        .maybeSingle();
      if (existing) {
        return new Response(JSON.stringify({
          ok: true, product: existing, deduped: true, awardedStars: 0,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // Scrape
    let scraped: { markdown: string; metadata: ScrapedMeta };
    try {
      scraped = await firecrawlScrape(rawUrl, firecrawlKey);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[submit-product-url] scrape failed:", msg);
      return new Response(JSON.stringify({ error: "scrape_failed", detail: msg }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const md = scraped.markdown || "";
    const meta = scraped.metadata || {};
    const title = (meta.title || md.split("\n").find((l) => l.trim().startsWith("# "))?.replace(/^#+\s*/, "") || parsedUrl.hostname).slice(0, 200).trim();
    const description = (meta.description || "").slice(0, 500);
    const imageCandidate = meta.ogImage;
    const image_url = isImageUrlSafe(imageCandidate) ? imageCandidate : null;

    const haystack = `${title} ${description} ${md.slice(0, 2000)}`;
    const category = inferCategory(haystack);
    const fit = inferFit(haystack);
    const style_tags = inferStyle(haystack);
    const price = extractPrice(haystack);
    const brand = (meta.ogSiteName || extractBrandFromUrl(rawUrl)).slice(0, 80);

    if (!image_url) {
      return new Response(JSON.stringify({
        error: "no_image_found",
        message: "이 페이지에서 상품 이미지를 찾을 수 없어요. 상품 상세 페이지 URL을 직접 입력해 주세요.",
      }), { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const insertRow = {
      external_id: `user-${user.id.slice(0, 8)}-${Date.now().toString(36)}`,
      name: title,
      brand,
      price: price ?? "—",
      currency: price?.includes("₩") || /원/.test(price ?? "") ? "KRW" : "USD",
      category,
      subcategory: "",
      style_tags,
      color_tags: [],
      fit,
      image_url,
      source_url: rawUrl,
      store_name: brand || parsedUrl.hostname,
      reason: "User submitted",
      platform: "user_submission",
      image_valid: true,
      is_active: true,
      source_type: "user_submission",
      source_trust_level: "low",
      search_query: null,
    };

    const { data: inserted, error: insertErr } = await admin
      .from("product_cache")
      .insert(insertRow)
      .select("id, name, brand, image_url, source_url, category, fit, price")
      .single();

    if (insertErr || !inserted) {
      console.error("[submit-product-url] insert failed:", insertErr);
      return new Response(JSON.stringify({ error: "insert_failed", detail: insertErr?.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Reward +1 bonus star (best-effort — don't fail the request if this fails)
    let awardedStars = 0;
    try {
      const { data: prof } = await admin
        .from("profiles")
        .select("bonus_stars")
        .eq("user_id", user.id)
        .maybeSingle();
      const current = prof?.bonus_stars ?? 0;
      const { error: updErr } = await admin
        .from("profiles")
        .update({ bonus_stars: current + 1 })
        .eq("user_id", user.id);
      if (!updErr) awardedStars = 1;
    } catch (e) {
      console.warn("[submit-product-url] star award failed:", e);
    }

    return new Response(JSON.stringify({
      ok: true,
      product: inserted,
      awardedStars,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[submit-product-url] fatal:", msg);
    return new Response(JSON.stringify({ error: "internal_error", detail: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
