// Search-Discovery Engine
// Pipeline: query intent → shopping queries → web search for product URLs →
// product page extraction → validation → DB insert
//
// This replaces the brittle direct-scraper-only path. The function is designed
// to be called in the BACKGROUND from the client after DB-first results render.
// It keeps growing the DB so subsequent searches feel fast.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PERPLEXITY_KEY = Deno.env.get("PERPLEXITY_API_KEY");
const FIRECRAWL_KEY = Deno.env.get("FIRECRAWL_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// ─────────────────────────── helpers ───────────────────────────

const FASHION_RE = /\b(jacket|coat|blazer|shirt|hoodie|sweater|cardigan|vest|tee|t-shirt|polo|pants|trousers|jeans|shorts|skirt|dress|sneakers?|boots?|shoes?|loafers?|sandals?|bag|tote|backpack|hat|cap|beanie|belt|scarf|bomber|parka|pullover|sweatshirt|chinos?|joggers?|blouse|knit|denim|leather|jumpsuit|trench|gilet|leggings?|culottes|windbreaker|tank|fedora|mules?|oxfords?|brogues?|espadrilles?|pumps?|heels?|flats?|clutch|crossbody|outfit|outerwear|footwear)\b/i;

const TIMEOUT_MS = {
  perplexity: 12_000,
  perplexitySearch: 15_000,
  firecrawl: 15_000,
  plainFetch: 8_000,
};

function log(stage: string, payload: Record<string, unknown>) {
  console.log(`[DISCOVERY] ${stage} ${JSON.stringify(payload)}`);
}

async function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await p;
  } finally {
    clearTimeout(t);
  }
}

function safeUrl(u: unknown): string | null {
  if (typeof u !== "string") return null;
  const s = u.trim();
  if (!s) return null;
  try {
    const url = new URL(s);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function isImageSafe(u: unknown): boolean {
  const safe = safeUrl(u);
  if (!safe) return false;
  if (/\.(jpe?g|png|webp|avif)(\?|$)/i.test(safe)) return true;
  // allow CDNs without explicit extension
  return !/placehold|placekitten|dummyimage|via\.placeholder/i.test(safe);
}

// ─────────────────── 1. Query intent + expansion ───────────────────

const SCENARIO_FALLBACK: Record<string, string[]> = {
  "summer vacation": [
    "men linen shirt", "men relaxed shorts", "men resort sandals",
    "summer tote bag", "women linen dress", "women espadrilles",
    "lightweight bomber jacket", "panama hat",
  ],
  "winter": [
    "wool overcoat", "puffer jacket", "cashmere sweater",
    "leather boots", "wool scarf", "thermal layer", "beanie hat",
  ],
  "office": [
    "tailored blazer", "wool trousers", "oxford dress shirt",
    "leather loafers", "structured tote bag", "minimal watch",
  ],
  "date night": [
    "silk slip dress", "leather mini skirt", "satin blouse",
    "heeled mules", "small clutch bag", "tailored blazer",
  ],
  "weekend casual": [
    "oversized sweatshirt", "vintage denim jeans", "white sneakers",
    "canvas tote bag", "relaxed t-shirt",
  ],
  "modern": [
    "structured blazer", "clean trousers", "monochrome coat",
    "sleek leather sneakers", "minimal crossbody bag",
  ],
};

function fallbackExpand(query: string): string[] {
  const q = query.toLowerCase().trim();
  for (const [k, v] of Object.entries(SCENARIO_FALLBACK)) {
    if (q.includes(k)) return v;
  }
  // Generic: just append common fashion modifiers
  return [
    `${q} men`,
    `${q} women`,
    `${q} outfit`,
    `buy ${q} online`,
    `${q} new collection`,
    `${q} shop`,
  ];
}

async function perplexityExpand(query: string): Promise<{ queries: string[]; usedPerplexity: boolean }> {
  if (!PERPLEXITY_KEY) {
    log("perplexity_skip", { reason: "no_key" });
    return { queries: fallbackExpand(query), usedPerplexity: false };
  }
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS.perplexity);
    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PERPLEXITY_KEY}`,
        "Content-Type": "application/json",
      },
      signal: ctrl.signal,
      body: JSON.stringify({
        model: "sonar",
        messages: [
          {
            role: "system",
            content:
              "You are a shopping query generator. Return ONLY a JSON array of 6-8 specific shopping queries (each 3-7 words) that a user could type into a fashion store search to find products matching their intent. No prose, no numbering, just the JSON array.",
          },
          { role: "user", content: query },
        ],
        max_tokens: 400,
        temperature: 0.3,
      }),
    });
    clearTimeout(timer);
    if (!res.ok) {
      log("perplexity_fail", { status: res.status });
      return { queries: fallbackExpand(query), usedPerplexity: false };
    }
    const data = await res.json();
    const text: string = data?.choices?.[0]?.message?.content || "";
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return { queries: fallbackExpand(query), usedPerplexity: false };
    const parsed = JSON.parse(match[0]);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return { queries: fallbackExpand(query), usedPerplexity: false };
    }
    const cleaned = parsed
      .map((s) => String(s).trim())
      .filter((s) => s.length > 2 && s.length < 80)
      .slice(0, 8);
    if (cleaned.length < 3) return { queries: fallbackExpand(query), usedPerplexity: false };
    return { queries: cleaned, usedPerplexity: true };
  } catch (e) {
    log("perplexity_error", { msg: (e as Error).message });
    return { queries: fallbackExpand(query), usedPerplexity: false };
  }
}

// ─────────────────── 2. URL discovery via Perplexity Search ───────────────────

const TRUSTED_STORES = [
  "asos.com", "ssense.com", "farfetch.com", "net-a-porter.com", "mrporter.com",
  "endclothing.com", "matchesfashion.com", "mytheresa.com", "nordstrom.com",
  "shopbop.com", "uniqlo.com", "hm.com", "zara.com", "cosstores.com", "arket.com",
  "everlane.com", "aritzia.com", "revolve.com", "saksfifthavenue.com",
  "neimanmarcus.com", "luisaviaroma.com", "yoox.com", "amazon.com/dp",
];

function looksLikeProductUrl(url: string, title?: string, snippet?: string): boolean {
  const u = url.toLowerCase();
  // Reject obvious non-product paths
  if (/\/(blog|news|article|guide|story|stories|editorial|magazine|press|about|help|faq|contact|search|category|categories|collection|collections|brand|brands|home)\/?($|\?)/i.test(u))
    return false;
  // Strong product-page markers
  if (/\/(p|product|products|item|items|shop|prd|dp)\/[\w\-]+/i.test(u)) return true;
  if (/[\?&](pid|productid|sku|itemid)=/i.test(u)) return true;
  // Trusted store domain
  const trusted = TRUSTED_STORES.some((d) => u.includes(d));
  if (!trusted) {
    // Allow any URL whose snippet/title screams "product"
    const text = `${title || ""} ${snippet || ""}`.toLowerCase();
    if (/\b(buy|shop|price|\$|€|£|₩|in stock|add to (cart|bag))\b/.test(text) && FASHION_RE.test(text)) {
      return true;
    }
    return false;
  }
  return true;
}

interface DiscoveredCandidate {
  url: string;
  title?: string;
  snippet?: string;
}

async function discoverUrls(shoppingQueries: string[]): Promise<DiscoveredCandidate[]> {
  if (!PERPLEXITY_KEY) {
    log("discover_skip", { reason: "no_perplexity_key" });
    return [];
  }
  const tasks = shoppingQueries.slice(0, 6).map((q) => discoverForQuery(q));
  const settled = await Promise.allSettled(tasks);
  const all: DiscoveredCandidate[] = [];
  for (const s of settled) {
    if (s.status === "fulfilled") all.push(...s.value);
  }
  // Dedupe by URL host+path
  const seen = new Set<string>();
  const deduped: DiscoveredCandidate[] = [];
  for (const c of all) {
    const key = c.url.split("?")[0].toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(c);
  }
  return deduped.slice(0, 30);
}

async function discoverForQuery(q: string): Promise<DiscoveredCandidate[]> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS.perplexitySearch);
    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PERPLEXITY_KEY}`,
        "Content-Type": "application/json",
      },
      signal: ctrl.signal,
      body: JSON.stringify({
        model: "sonar",
        messages: [
          {
            role: "system",
            content:
              "You find real product pages. Reply with ONLY a brief plain-text list of 5-8 product page URLs from major fashion stores (ASOS, SSENSE, Farfetch, Net-a-Porter, Nordstrom, COS, Arket, Uniqlo, Zara, etc). One URL per line. No prose, no markdown, no numbering. Each URL must point to a single buyable product page.",
          },
          { role: "user", content: `Find product pages for: ${q}` },
        ],
        max_tokens: 600,
        temperature: 0.2,
        search_recency_filter: "month",
      }),
    });
    clearTimeout(timer);
    if (!res.ok) {
      log("discover_fail", { q, status: res.status });
      return [];
    }
    const data = await res.json();
    const text: string = data?.choices?.[0]?.message?.content || "";
    const citations: string[] = Array.isArray(data?.citations) ? data.citations : [];
    const fromText = (text.match(/https?:\/\/[^\s)\]]+/g) || []).map((u) =>
      u.replace(/[.,)\];]+$/, "")
    );
    const candidates: DiscoveredCandidate[] = [];
    const merged = [...citations, ...fromText];
    for (const raw of merged) {
      const safe = safeUrl(raw);
      if (!safe) continue;
      if (looksLikeProductUrl(safe)) {
        candidates.push({ url: safe });
      }
    }
    log("discover_query", { q, found: candidates.length });
    return candidates;
  } catch (e) {
    log("discover_error", { q, msg: (e as Error).message });
    return [];
  }
}

// ─────────────────── 3. Product page extraction ───────────────────

interface ExtractedProduct {
  title: string;
  image_url: string;
  source_url: string;
  price?: string;
  brand?: string;
  store_name?: string;
}

async function extractWithFirecrawl(url: string): Promise<ExtractedProduct | null> {
  if (!FIRECRAWL_KEY) return null;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS.firecrawl);
    const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FIRECRAWL_KEY}`,
        "Content-Type": "application/json",
      },
      signal: ctrl.signal,
      body: JSON.stringify({
        url,
        formats: ["markdown"],
        onlyMainContent: true,
        waitFor: 1500,
        timeout: 12_000,
      }),
    });
    clearTimeout(timer);
    if (!res.ok) {
      log("firecrawl_fail", { url, status: res.status });
      return null;
    }
    const data = await res.json();
    const md: string = data?.data?.markdown || "";
    const meta = data?.data?.metadata || {};
    const title: string =
      meta.title || meta["og:title"] || meta.ogTitle || extractFirstHeading(md) || "";
    const image: string =
      meta["og:image"] || meta.ogImage || meta.image || extractFirstImage(md) || "";
    const description: string = meta.description || meta["og:description"] || "";
    const priceMatch = (md + " " + description).match(
      /(?:USD|US\$|EUR|GBP|KRW|\$|€|£|₩)\s?\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?/
    );
    const safeImg = safeUrl(image);
    if (!title || !safeImg || !isImageSafe(safeImg)) return null;
    const cleanTitle = title.replace(/\s*\|\s*.*$/, "").trim().slice(0, 180);
    if (!FASHION_RE.test(cleanTitle) && !FASHION_RE.test(description)) return null;
    const host = new URL(url).hostname.replace(/^www\./, "");
    const brand = (meta["og:site_name"] || meta.ogSiteName || "").toString();
    return {
      title: cleanTitle,
      image_url: safeImg,
      source_url: url,
      price: priceMatch?.[0],
      brand: brand || hostToBrand(host),
      store_name: hostToBrand(host),
    };
  } catch (e) {
    log("firecrawl_error", { url, msg: (e as Error).message });
    return null;
  }
}

async function extractWithSimpleFetch(url: string): Promise<ExtractedProduct | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS.plainFetch);
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; WardrobeBot/1.0; +https://mymyon.com)",
        Accept: "text/html,*/*",
      },
      redirect: "follow",
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const html = await res.text();
    const og = (prop: string) => {
      const m = html.match(
        new RegExp(`<meta[^>]+property=["']${prop}["'][^>]+content=["']([^"']+)["']`, "i")
      );
      return m?.[1];
    };
    const meta = (name: string) => {
      const m = html.match(
        new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`, "i")
      );
      return m?.[1];
    };
    const title =
      og("og:title") || (html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || "").trim();
    const image = og("og:image") || og("twitter:image");
    const description = og("og:description") || meta("description") || "";
    const priceMatch =
      og("product:price:amount") ||
      (html.match(/(?:USD|US\$|EUR|GBP|KRW|\$|€|£|₩)\s?\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?/)?.[0]);
    const safeImg = safeUrl(image);
    if (!title || !safeImg || !isImageSafe(safeImg)) return null;
    const cleanTitle = title.replace(/\s*\|\s*.*$/, "").trim().slice(0, 180);
    if (!FASHION_RE.test(cleanTitle) && !FASHION_RE.test(description)) return null;
    const host = new URL(url).hostname.replace(/^www\./, "");
    return {
      title: cleanTitle,
      image_url: safeImg,
      source_url: url,
      price: priceMatch ? String(priceMatch) : undefined,
      brand: og("og:site_name") || hostToBrand(host),
      store_name: hostToBrand(host),
    };
  } catch (e) {
    log("plainfetch_error", { url, msg: (e as Error).message });
    return null;
  }
}

function extractFirstImage(md: string): string | null {
  const m = md.match(/!\[[^\]]*\]\((https?:\/\/[^\s)]+)/);
  return m?.[1] || null;
}
function extractFirstHeading(md: string): string | null {
  const m = md.match(/^#\s+(.+)$/m);
  return m?.[1] || null;
}
function hostToBrand(host: string): string {
  const part = host.split(".")[0];
  return part.charAt(0).toUpperCase() + part.slice(1);
}

async function extractCandidate(c: DiscoveredCandidate): Promise<ExtractedProduct | null> {
  // Firecrawl primary, simple fetch fallback
  const fc = await extractWithFirecrawl(c.url);
  if (fc) return fc;
  return await extractWithSimpleFetch(c.url);
}

// ─────────────────── 4. Categorization ───────────────────

const CATEGORY_RULES: Array<{ re: RegExp; cat: string; sub?: string }> = [
  { re: /\b(jacket|blazer|coat|bomber|parka|trench|gilet|windbreaker|cardigan)\b/i, cat: "outerwear" },
  { re: /\b(shirt|blouse|tee|t-shirt|polo|tank|top|camisole|tunic|henley|knit|sweater|hoodie|sweatshirt|pullover)\b/i, cat: "tops" },
  { re: /\b(pants|trousers|jeans|chinos|shorts|joggers|leggings|culottes|slacks)\b/i, cat: "bottoms" },
  { re: /\b(skirt|dress|jumpsuit|romper|overalls)\b/i, cat: "dresses" },
  { re: /\b(sneakers?|boots?|shoes?|loafers?|sandals?|mules?|oxfords?|brogues?|espadrilles?|pumps?|heels?|flats?)\b/i, cat: "footwear" },
  { re: /\b(bag|tote|backpack|clutch|crossbody|satchel|duffle|messenger|purse|wallet)\b/i, cat: "bags" },
  { re: /\b(hat|cap|beanie|fedora|beret|bandana|headband)\b/i, cat: "accessories", sub: "hats" },
  { re: /\b(belt|scarf|gloves?|socks?|tie|cufflinks|sunglasses|watch|necklace|bracelet|earring|ring)\b/i, cat: "accessories" },
];

function categorize(title: string): { category: string; subcategory?: string } {
  for (const r of CATEGORY_RULES) {
    if (r.re.test(title)) return { category: r.cat, subcategory: r.sub };
  }
  return { category: "other" };
}

function inferStyleTags(title: string): string[] {
  const t = title.toLowerCase();
  const tags: string[] = [];
  if (/minimal|clean|structured|tailored/.test(t)) tags.push("minimal");
  if (/street|oversized|baggy|cargo/.test(t)) tags.push("street");
  if (/classic|elegant|formal/.test(t)) tags.push("classic");
  if (/leather|chain|punk/.test(t)) tags.push("edgy");
  if (/casual|relaxed|everyday/.test(t)) tags.push("casual");
  if (/chic|modern|sleek|slim/.test(t)) tags.push("chic");
  if (/vintage|retro/.test(t)) tags.push("vintage");
  if (/sport|athletic|track/.test(t)) tags.push("sporty");
  if (/linen|resort|breathable/.test(t)) tags.push("summer");
  return tags.length ? tags : ["casual"];
}

function inferColorTags(title: string): string[] {
  const t = title.toLowerCase();
  const colors: string[] = [];
  for (const [re, c] of [
    [/\bblack|noir\b/, "black"],
    [/\bwhite|ivory\b/, "white"],
    [/\bgrey|gray|charcoal\b/, "grey"],
    [/\bnavy\b/, "navy"],
    [/\bbeige|cream|sand\b/, "beige"],
    [/\bbrown|tan|camel\b/, "brown"],
    [/\bred|burgundy|wine\b/, "red"],
    [/\bblue\b/, "blue"],
    [/\bgreen|olive|khaki\b/, "green"],
    [/\bpink|rose\b/, "pink"],
  ] as Array<[RegExp, string]>) {
    if (re.test(t)) colors.push(c);
  }
  return colors;
}

// ─────────────────── 5. Image validation ───────────────────

async function validateImage(url: string): Promise<boolean> {
  // HEAD first, then GET fallback (some CDNs don't support HEAD)
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5_000);
    const res = await fetch(url, { method: "HEAD", signal: ctrl.signal });
    clearTimeout(timer);
    if (res.ok) {
      const ct = res.headers.get("content-type") || "";
      if (ct.startsWith("image/")) return true;
    }
  } catch {
    // fall through
  }
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6_000);
    const res = await fetch(url, {
      method: "GET",
      signal: ctrl.signal,
      headers: { Range: "bytes=0-1024" },
    });
    clearTimeout(timer);
    if (!res.ok && res.status !== 206) return false;
    const ct = res.headers.get("content-type") || "";
    // be permissive — allow if ct missing
    return ct.startsWith("image/") || !ct;
  } catch {
    return false;
  }
}

// ─────────────────── 6. Insert into product_cache ───────────────────

async function insertProducts(
  supabase: any,
  rows: ExtractedProduct[],
  sourceQuery: string
): Promise<{ inserted: number; duplicates: number }> {
  if (!rows.length) return { inserted: 0, duplicates: 0 };
  const records = rows.map((r) => {
    const { category, subcategory } = categorize(r.title);
    return {
      external_id: hashUrl(r.source_url),
      name: r.title,
      brand: r.brand || null,
      price: r.price || null,
      category,
      subcategory: subcategory || null,
      style_tags: inferStyleTags(r.title),
      color_tags: inferColorTags(r.title),
      fit: null,
      image_url: r.image_url,
      source_url: r.source_url,
      store_name: r.store_name || null,
      reason: `Discovered via "${sourceQuery}"`,
      platform: "web_search",
      image_valid: true,
      is_active: true,
      source_type: "discovery",
      source_trust_level: "medium",
      search_query: sourceQuery,
      last_validated: new Date().toISOString(),
    };
  });
  const { data, error } = await supabase
    .from("product_cache")
    .upsert(records, { onConflict: "platform,external_id" })
    .select("id");
  if (error) {
    log("insert_error", { msg: error.message });
    return { inserted: 0, duplicates: 0 };
  }
  const inserted = (data || []).length;
  return { inserted, duplicates: Math.max(records.length - inserted, 0) };
}

function hashUrl(u: string): string {
  // Stable id derived from URL (simple FNV-1a)
  let h = 2166136261;
  for (let i = 0; i < u.length; i++) {
    h ^= u.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `web_${(h >>> 0).toString(36)}_${u.length}`;
}

// ─────────────────── Main handler ───────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const body = await req.json().catch(() => ({}));
    const rawQuery: string = (body.query || "").toString().trim().slice(0, 200);
    const maxQueries = Math.min(Number(body.maxQueries) || 6, 8);
    const maxCandidates = Math.min(Number(body.maxCandidates) || 18, 30);

    if (!rawQuery) {
      return new Response(JSON.stringify({ error: "query is required" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const t0 = Date.now();

    // 1. Expand
    const { queries, usedPerplexity } = await perplexityExpand(rawQuery);
    const shoppingQueries = queries.slice(0, maxQueries);
    log("expand_done", { rawQuery, count: shoppingQueries.length, usedPerplexity, queries: shoppingQueries });

    // 2. Discover URLs
    const candidates = (await discoverUrls(shoppingQueries)).slice(0, maxCandidates);
    log("discover_done", { totalCandidates: candidates.length });

    if (candidates.length === 0) {
      return new Response(
        JSON.stringify({
          ok: true,
          rawQuery,
          shoppingQueries,
          usedPerplexity,
          candidatesFound: 0,
          inserted: 0,
          duplicates: 0,
          extracted: 0,
          rejected: 0,
          ms: Date.now() - t0,
          note: "No product URLs discovered. Discovery layer may be down.",
        }),
        { headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // 3. Extract (parallel, capped)
    const extractTasks = candidates.map((c) =>
      extractCandidate(c).catch(() => null)
    );
    const settled = await Promise.allSettled(extractTasks);
    const extracted: ExtractedProduct[] = [];
    let rejected = 0;
    for (const s of settled) {
      if (s.status === "fulfilled" && s.value) extracted.push(s.value);
      else rejected++;
    }
    log("extract_done", { extracted: extracted.length, rejected });

    // 4. Validate images in parallel (best effort)
    const valid: ExtractedProduct[] = [];
    const validationResults = await Promise.allSettled(
      extracted.map((p) => validateImage(p.image_url))
    );
    extracted.forEach((p, i) => {
      const r = validationResults[i];
      // Be permissive — accept if validation fails (we already have og:image)
      if (r.status === "fulfilled" && r.value === false) {
        // explicitly broken
        return;
      }
      valid.push(p);
    });
    log("validate_done", { valid: valid.length });

    // 5. Dedup by source URL within batch
    const seen = new Set<string>();
    const deduped = valid.filter((p) => {
      const k = p.source_url.split("?")[0].toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    // 6. Insert
    const { inserted, duplicates } = await insertProducts(supabase, deduped, rawQuery);
    log("insert_done", { inserted, duplicates });

    return new Response(
      JSON.stringify({
        ok: true,
        rawQuery,
        shoppingQueries,
        usedPerplexity,
        candidatesFound: candidates.length,
        extracted: extracted.length,
        validated: valid.length,
        inserted,
        duplicates,
        rejected,
        ms: Date.now() - t0,
      }),
      { headers: { ...cors, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[DISCOVERY] fatal", e);
    return new Response(
      JSON.stringify({ ok: false, error: (e as Error).message }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }
});
