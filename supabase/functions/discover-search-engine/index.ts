// discover-search-engine
// ----------------------
// Behaves like a real search engine, not a single crawler.
//
//   user query
//      │
//      ▼
//   expandQuery (10 variants)
//      │
//      ▼
//   Google CSE  ──▶ collect 50–100 product URLs (deduped by host+pathname)
//      │
//      ▼
//   Apify Web Scraper (jasef~web-scraper or APIFY_WEB_SCRAPER_ACTOR)
//   crawls all URLs in parallel, extracts JSON-LD / OpenGraph product data
//      │
//      ▼
//   normalize → dedupe → upsert into product_cache
//
// Idempotent. Tolerates partial failure. Always returns counts so the caller
// can log telemetry. Fire-and-forget from the client; also called by cron.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GOOGLE_CSE_KEY = Deno.env.get("GOOGLE_CSE_KEY");
const GOOGLE_CSE_CX = Deno.env.get("GOOGLE_CSE_CX");
const APIFY_TOKEN = Deno.env.get("APIFY_TOKEN");
const APIFY_WEB_SCRAPER =
  Deno.env.get("APIFY_WEB_SCRAPER_ACTOR") || "apify~web-scraper";

const CSE_BUDGET_MS = 6_000;
const APIFY_BUDGET_MS = 55_000; // server-side timeout for big page batches
const MAX_URLS = 80;            // hard cap per run (cost guard)
const VARIANTS_PER_RUN = 10;
const RESULTS_PER_VARIANT = 10; // CSE max per page

// ── Query expander (mirrors src/lib/discover/expand.ts) ─────────────────────
function expandQuery(q: string): string[] {
  const base = q.trim();
  if (!base) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of [
    base,
    `${base} outfit`,
    `${base} fashion`,
    `${base} style`,
    `${base} 코디`,
    `${base} 추천`,
    `${base} 브랜드`,
    `${base} streetwear`,
    `${base} outfit men`,
    `${base} outfit women`,
  ]) {
    const k = v.toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      out.push(v);
    }
  }
  return out.slice(0, VARIANTS_PER_RUN);
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`${label}_timeout`)), ms)),
  ]);
}

// Hosts we never want to crawl — irrelevant to product extraction.
const HOST_BLOCKLIST = /(youtube\.com|youtu\.be|tiktok\.com|instagram\.com|facebook\.com|x\.com|twitter\.com|pinterest\.|reddit\.com|wikipedia\.org|google\.|naver\.com\/search)/i;

function urlKey(u: string): string {
  try {
    const url = new URL(u);
    return `${url.host}${url.pathname}`.toLowerCase();
  } catch {
    return u.toLowerCase();
  }
}

// ── Google CSE ──────────────────────────────────────────────────────────────
async function searchCSE(query: string): Promise<string[]> {
  if (!GOOGLE_CSE_KEY || !GOOGLE_CSE_CX) return [];
  const u = new URL("https://www.googleapis.com/customsearch/v1");
  u.searchParams.set("key", GOOGLE_CSE_KEY);
  u.searchParams.set("cx", GOOGLE_CSE_CX);
  u.searchParams.set("q", query);
  u.searchParams.set("num", String(RESULTS_PER_VARIANT));
  u.searchParams.set("safe", "active");
  try {
    const res = await withTimeout(fetch(u.toString()), CSE_BUDGET_MS, "cse");
    if (!res.ok) {
      console.warn(`[cse] HTTP ${res.status} for "${query}"`);
      return [];
    }
    const data = await res.json().catch(() => null) as { items?: Array<{ link?: string }> } | null;
    return (data?.items ?? [])
      .map((it) => it.link)
      .filter((x): x is string => typeof x === "string" && x.startsWith("http"));
  } catch (e) {
    console.warn("[cse] failed", (e as Error).message);
    return [];
  }
}

async function collectUrls(variants: string[]): Promise<string[]> {
  const settled = await Promise.allSettled(variants.map((v) => searchCSE(v)));
  const urls: string[] = [];
  for (const r of settled) if (r.status === "fulfilled") urls.push(...r.value);
  // Filter + dedupe
  const seen = new Set<string>();
  const kept: string[] = [];
  for (const u of urls) {
    try {
      const url = new URL(u);
      if (HOST_BLOCKLIST.test(url.host)) continue;
      const key = urlKey(u);
      if (seen.has(key)) continue;
      seen.add(key);
      kept.push(u);
      if (kept.length >= MAX_URLS) break;
    } catch { /* skip */ }
  }
  return kept;
}

// ── Apify Web Scraper ───────────────────────────────────────────────────────
// Generic universal product extractor. We give Apify the URL list and a
// pageFunction that pulls JSON-LD Product / OpenGraph product fields.
// This works on virtually any e-commerce page without per-domain logic.

const PAGE_FUNCTION = `
async function pageFunction(context) {
  const { request, $, log } = context;
  const url = request.url;

  // 1. Try JSON-LD
  const products = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const raw = JSON.parse($(el).contents().text());
      const arr = Array.isArray(raw) ? raw : [raw];
      for (const node of arr) {
        const items = node['@graph'] || [node];
        for (const it of items) {
          if (it && (it['@type'] === 'Product' || (Array.isArray(it['@type']) && it['@type'].includes('Product')))) {
            products.push(it);
          }
        }
      }
    } catch (e) {}
  });

  // 2. OpenGraph fallback
  const og = {
    title: $('meta[property="og:title"]').attr('content'),
    image: $('meta[property="og:image"]').attr('content'),
    site: $('meta[property="og:site_name"]').attr('content'),
    desc: $('meta[property="og:description"]').attr('content'),
    type: $('meta[property="og:type"]').attr('content'),
    price: $('meta[property="product:price:amount"]').attr('content') ||
           $('meta[property="og:price:amount"]').attr('content'),
    currency: $('meta[property="product:price:currency"]').attr('content') ||
              $('meta[property="og:price:currency"]').attr('content'),
    brand: $('meta[property="product:brand"]').attr('content'),
  };

  if (products.length) {
    return products.map((p) => ({
      url,
      name: p.name || og.title,
      brand: (p.brand && (p.brand.name || p.brand)) || og.brand,
      image: Array.isArray(p.image) ? p.image[0] : (p.image || og.image),
      price: p.offers && (p.offers.price || (Array.isArray(p.offers) && p.offers[0] && p.offers[0].price)),
      currency: p.offers && (p.offers.priceCurrency || (Array.isArray(p.offers) && p.offers[0] && p.offers[0].priceCurrency)) || og.currency,
      site: og.site,
      source: 'jsonld',
    }));
  }
  if (og.image && og.title && (og.type === 'product' || /product|item|shop/i.test(url))) {
    return [{
      url, name: og.title, brand: og.brand, image: og.image,
      price: og.price, currency: og.currency, site: og.site, source: 'og',
    }];
  }
  return [];
}
`;

interface ExtractedProduct {
  url: string;
  name?: string;
  brand?: string | null;
  image?: string | null;
  price?: string | number | null;
  currency?: string | null;
  site?: string | null;
}

async function apifyWebScrape(urls: string[]): Promise<ExtractedProduct[]> {
  if (!APIFY_TOKEN || urls.length === 0) return [];
  const url = `https://api.apify.com/v2/acts/${APIFY_WEB_SCRAPER}/run-sync-get-dataset-items?token=${APIFY_TOKEN}&timeout=50`;
  try {
    const res = await withTimeout(
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startUrls: urls.map((u) => ({ url: u })),
          pageFunction: PAGE_FUNCTION,
          maxRequestsPerCrawl: urls.length,
          maxConcurrency: 10,
          proxyConfiguration: { useApifyProxy: true },
          injectJQuery: true,
          ignoreSslErrors: true,
        }),
      }),
      APIFY_BUDGET_MS,
      "apify_web_scraper",
    );
    if (!res.ok) {
      console.warn(`[apify:web-scraper] HTTP ${res.status}`);
      return [];
    }
    const data = await res.json().catch(() => null);
    if (!Array.isArray(data)) return [];
    // pageFunction returns arrays — flatten
    const out: ExtractedProduct[] = [];
    for (const row of data) {
      if (Array.isArray(row)) out.push(...row as ExtractedProduct[]);
      else if (row && typeof row === "object") out.push(row as ExtractedProduct);
    }
    return out;
  } catch (e) {
    console.warn("[apify:web-scraper] failed", (e as Error).message);
    return [];
  }
}

// ── Normalize + dedupe ──────────────────────────────────────────────────────
const FASHION_RE = /\b(jacket|coat|blazer|shirt|hoodie|sweater|cardigan|vest|tee|t-shirt|polo|pants|trousers|jeans|shorts|skirt|dress|sneakers?|boots?|shoes?|loafers?|sandals?|bag|tote|backpack|hat|cap|beanie|belt|scarf|bomber|parka|pullover|sweatshirt|chinos?|joggers?|blouse|knit|denim|leather|jumpsuit|trench|gilet|leggings?|tank|outfit|outerwear|footwear)\b/i;
const FASHION_KR_RE = /(자켓|재킷|코트|블레이저|셔츠|후디|스웨터|니트|가디건|티셔츠|폴로|바지|팬츠|청바지|진|반바지|스커트|치마|드레스|원피스|운동화|스니커즈|신발|부츠|로퍼|샌들|가방|백|토트|백팩|모자|벨트|봄버|파카|풀오버|맨투맨|블라우스|점퍼|패딩|아우터)/;

function safeImage(u: unknown): string | null {
  if (typeof u !== "string") return null;
  try {
    const url = new URL(u.trim());
    if (url.protocol !== "https:") return null;
    if (/placehold|placekitten|dummyimage/i.test(url.hostname)) return null;
    return url.toString();
  } catch { return null; }
}

function normalizedTitleKey(t: string): string {
  return t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "").slice(0, 60);
}

function imageHostKey(u: string): string {
  try {
    const url = new URL(u);
    return `${url.host}${url.pathname}`.toLowerCase();
  } catch { return u.toLowerCase(); }
}

interface NormalizedProduct {
  external_id: string;
  name: string;
  brand: string | null;
  price: string | null;
  currency: string;
  image_url: string;
  source_url: string;
  store_name: string;
  platform: string;
}

function normalize(items: ExtractedProduct[]): NormalizedProduct[] {
  const out: NormalizedProduct[] = [];
  for (const it of items) {
    const name = String(it.name ?? "").trim();
    const img = safeImage(it.image);
    const link = typeof it.url === "string" ? it.url : null;
    if (!name || !img || !link) continue;
    if (!FASHION_RE.test(name) && !FASHION_KR_RE.test(name)) continue;
    let host = "web";
    try { host = new URL(link).host.replace(/^www\./, ""); } catch { /* */ }
    const platform = host.split(".")[0] || "web";
    out.push({
      external_id: `cse-${urlKey(link)}`,
      name,
      brand: it.brand ? String(it.brand) : null,
      price: it.price != null ? String(it.price) : null,
      currency: it.currency ? String(it.currency) : "USD",
      image_url: img,
      source_url: link,
      store_name: it.site ? String(it.site) : host,
      platform,
    });
  }
  // dedupe
  const seenU = new Set<string>(), seenT = new Set<string>(), seenI = new Set<string>();
  const kept: NormalizedProduct[] = [];
  for (const p of out) {
    const u = urlKey(p.source_url);
    const t = normalizedTitleKey(p.name);
    const i = imageHostKey(p.image_url);
    if (seenU.has(u) || seenT.has(t) || seenI.has(i)) continue;
    seenU.add(u); seenT.add(t); seenI.add(i);
    kept.push(p);
  }
  return kept;
}

async function upsertCache(items: NormalizedProduct[], query: string): Promise<number> {
  if (!items.length) return 0;
  const sb = createClient(SUPABASE_URL, SERVICE_KEY);
  const rows = items.map((p) => ({
    external_id: p.external_id,
    name: p.name,
    brand: p.brand,
    price: p.price,
    currency: p.currency,
    image_url: p.image_url,
    source_url: p.source_url,
    store_name: p.store_name,
    platform: p.platform,
    source_type: "search_engine",
    source_trust_level: "medium",
    image_valid: true,
    is_active: true,
    last_validated: new Date().toISOString(),
    search_query: query.toLowerCase().trim(),
    trend_score: 1,
  }));
  const { error, count } = await sb
    .from("product_cache")
    .upsert(rows, { onConflict: "platform,external_id", count: "exact", ignoreDuplicates: false });
  if (error) {
    console.warn("[discover-search-engine] upsert error", error.message);
    return 0;
  }
  return count ?? rows.length;
}

// ── Handler ─────────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const t0 = Date.now();
  try {
    const body = await req.json().catch(() => ({}));
    // Two modes:
    //   { query: "minimal beige knit" }       — one user query
    //   { queries: ["..", ".."] }             — cron batch
    const queries: string[] = Array.isArray(body?.queries)
      ? body.queries.filter((q: unknown): q is string => typeof q === "string" && q.trim().length > 0)
      : (typeof body?.query === "string" && body.query.trim() ? [body.query.trim()] : []);

    if (queries.length === 0) {
      return new Response(JSON.stringify({ error: "query or queries required" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    if (!GOOGLE_CSE_KEY || !GOOGLE_CSE_CX) {
      return new Response(JSON.stringify({ error: "GOOGLE_CSE_KEY/GOOGLE_CSE_CX not configured" }), {
        status: 500, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    if (!APIFY_TOKEN) {
      return new Response(JSON.stringify({ error: "APIFY_TOKEN not configured" }), {
        status: 500, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const results: Array<Record<string, unknown>> = [];
    let totalInserted = 0;

    for (const q of queries) {
      const variants = expandQuery(q);
      const urls = await collectUrls(variants);
      const extracted = await apifyWebScrape(urls);
      const normalized = normalize(extracted);
      const inserted = await upsertCache(normalized, q);
      totalInserted += inserted;
      results.push({
        query: q,
        variants: variants.length,
        urls: urls.length,
        extracted: extracted.length,
        normalized: normalized.length,
        inserted,
      });
      console.log("[discover-search-engine]", {
        query: q, variants: variants.length, urls: urls.length,
        extracted: extracted.length, inserted,
      });
    }

    return new Response(
      JSON.stringify({ ok: true, totalInserted, results, elapsed_ms: Date.now() - t0 }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[discover-search-engine] fatal", (e as Error).message);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
