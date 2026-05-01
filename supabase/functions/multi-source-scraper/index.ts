// Multi-source product scraper — Apify-first parallel fetch.
//
// Runs Apify actors in parallel for FRESH inventory on every call:
//   - ASOS    (jupri/asos-scraper)
//   - Zalando (tugkan/zalando-scraper)
//   - Coupang (KR) — actor id from APIFY_COUPANG_ACTOR or default
//   - Google Shopping — actor id from APIFY_GSHOPPING_ACTOR or default
// Plus optional Crawlbase (Farfetch).
//
// 60-second per-query cooldown: same query within the cooldown reuses the
// last result set instead of re-running paid actors.
//
// Each source has a hard 14s budget. Partial failure is tolerated
// (allSettled). Results are deduped (URL + normalized title + image host),
// shuffled, then upserted into product_cache.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APIFY_TOKEN = Deno.env.get("APIFY_TOKEN");
const CRAWLBASE_TOKEN = Deno.env.get("CRAWLBASE_TOKEN");
const SCRAPINGBEE_API_KEY = Deno.env.get("SCRAPINGBEE_API_KEY");
const DATAFORSEO_LOGIN = Deno.env.get("DATAFORSEO_LOGIN");
const DATAFORSEO_PASSWORD = Deno.env.get("DATAFORSEO_PASSWORD");
const DATAFORSEO_BASIC_AUTH = Deno.env.get("DATAFORSEO_BASIC_AUTH");

// ── APIFY GATE (stabilization pass 2026-04-19) ─────────────────────────────
// Apify is disabled by default. When false, every fetchApify* call short-
// circuits and only ScrapingBee KR routes return rows.
const APIFY_ENABLED = (Deno.env.get("APIFY_ENABLED") || "false").toLowerCase() === "true";

// ── SOURCE LOCK ────────────────────────────────────────────────────────────
// Comma-separated list of allowed source labels. Defaults to KR-only ScrapingBee.
// To re-enable an Apify source, set APIFY_ENABLED=true AND list the label here.
// KR routes via ScrapingBee + Global routes (ASOS / Zalando / SSENSE) via direct ScrapingBee.
// Global labels share the apify_* prefix for legacy compatibility but actually run via ScrapingBee.
const DEFAULT_ENABLED = "apify_musinsa,apify_29cm,apify_wconcept,apify_ssg,apify_naver,sb_asos,sb_zalando,sb_ssense,dataforseo";
const ENABLED_SOURCES = new Set(
  (Deno.env.get("ENABLED_SOURCES") || DEFAULT_ENABLED)
    .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
);
function sourceEnabled(label: string): boolean {
  if (!ENABLED_SOURCES.has(label.toLowerCase())) return false;
  // Apify-backed labels (NOT the KR ScrapingBee ones, which are also prefixed
  // apify_* for legacy reasons but actually run via ScrapingBee).
  const APIFY_BACKED = new Set([
    "apify_asos", "apify_zalando", "apify_coupang", "apify_gshopping",
  ]);
  if (APIFY_BACKED.has(label.toLowerCase()) && !APIFY_ENABLED) return false;
  return true;
}

const SOURCE_BUDGET_MS = 14_000;
const COOLDOWN_MS = 60_000;

// Apify actor IDs. Defaults are public actors known to return JSON via the
// run-sync-get-dataset-items endpoint. Override via env if you want to swap
// in a different actor (e.g. private Coupang scraper).
const APIFY_ACTORS = {
  asos: "jupri~asos-scraper",
  zalando: "tugkan~zalando-scraper",
  coupang: Deno.env.get("APIFY_COUPANG_ACTOR") || "epctex~coupang-scraper",
  gshopping: Deno.env.get("APIFY_GSHOPPING_ACTOR") || "emastra~google-shopping-scraper",
} as const;

interface RawProduct {
  external_id: string;
  name: string;
  brand: string | null;
  price: string | null;
  currency: string;
  image_url: string;
  source_url: string;
  store_name: string;
  platform: string;
  source_type: string;
  source_trust_level: "high" | "medium" | "low";
  category: string | null;
}

const FASHION_RE = /\b(jacket|coat|blazer|shirt|hoodie|sweater|cardigan|vest|tee|t-shirt|polo|pants|trousers|jeans|shorts|skirt|dress|sneakers?|boots?|shoes?|loafers?|sandals?|bag|tote|backpack|hat|cap|beanie|belt|scarf|bomber|parka|pullover|sweatshirt|chinos?|joggers?|blouse|knit|denim|leather|jumpsuit|trench|gilet|leggings?|tank|mules?|oxfords?|brogues?|espadrilles?|pumps?|heels?|flats?|clutch|crossbody|outfit|outerwear|footwear)\b/i;
const FASHION_KR_RE = /(자켓|재킷|코트|블레이저|셔츠|후디|스웨터|니트|가디건|티셔츠|폴로|바지|팬츠|청바지|진|반바지|스커트|치마|드레스|원피스|운동화|스니커즈|신발|부츠|로퍼|샌들|가방|백|토트|백팩|모자|벨트|봄버|파카|풀오버|맨투맨|블라우스|점퍼|패딩|아우터)/;

function isFashion(title: string): boolean {
  return FASHION_RE.test(title) || FASHION_KR_RE.test(title);
}

function safeImage(u: unknown): string | null {
  if (typeof u !== "string") return null;
  try {
    const url = new URL(u.trim());
    if (url.protocol !== "https:") return null;
    if (/placehold|placekitten|dummyimage/i.test(url.hostname)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`${label}_timeout`)), ms)),
  ]);
}

// ── Per-query 60s cooldown ──────────────────────────────────────────────────
// Lives in worker memory. Cheap insurance against Apify cost spikes when the
// same user retries the same query rapidly.
interface CacheRow { ts: number; result: unknown; }
const cooldownCache = new Map<string, CacheRow>();
function cooldownKey(query: string): string {
  return query.trim().toLowerCase();
}

// ── Generic Apify caller ────────────────────────────────────────────────────

async function callApifyActor(actorId: string, input: Record<string, unknown>): Promise<unknown[]> {
  if (!APIFY_TOKEN) return [];
  const url = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${APIFY_TOKEN}&timeout=14`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    console.warn(`[apify:${actorId}] HTTP ${res.status}`);
    return [];
  }
  const data = await res.json().catch(() => null);
  return Array.isArray(data) ? data : [];
}

async function fetchApifyAsos(query: string, max: number): Promise<RawProduct[]> {
  try {
    const items = await withTimeout(
      callApifyActor(APIFY_ACTORS.asos, { searchTerms: [query], maxItems: max, country: "US" }),
      SOURCE_BUDGET_MS,
      "apify_asos",
    );
    return items.flatMap((it) => {
      const o = it as Record<string, unknown>;
      const img = safeImage(o.image ?? (Array.isArray(o.images) ? (o.images as unknown[])[0] : null));
      const name = String(o.name ?? o.title ?? "").trim();
      const link = typeof o.url === "string" ? o.url : null;
      if (!img || !link || !name || !isFashion(name)) return [];
      return [{
        external_id: `asos-${String(o.productId ?? o.id ?? link)}`,
        name,
        brand: typeof o.brandName === "string" ? o.brandName : (typeof o.brand === "string" ? o.brand : null),
        price: o.price != null ? String(o.price) : null,
        currency: typeof o.currency === "string" ? o.currency : "USD",
        image_url: img,
        source_url: link,
        store_name: "ASOS",
        platform: "asos",
        source_type: "scraper",
        source_trust_level: "medium" as const,
        category: typeof o.productType === "string" ? o.productType : null,
      }];
    });
  } catch (e) {
    console.warn("[apify:asos] failed", (e as Error).message);
    return [];
  }
}

async function fetchApifyZalando(query: string, max: number): Promise<RawProduct[]> {
  try {
    const items = await withTimeout(
      callApifyActor(APIFY_ACTORS.zalando, { search: query, maxItems: max, country: "DE" }),
      SOURCE_BUDGET_MS,
      "apify_zalando",
    );
    return items.flatMap((it) => {
      const o = it as Record<string, unknown>;
      const img = safeImage(o.image ?? (Array.isArray(o.images) ? (o.images as unknown[])[0] : null));
      const name = String(o.name ?? o.title ?? "").trim();
      const link = typeof o.url === "string" ? o.url : null;
      if (!img || !link || !name || !isFashion(name)) return [];
      return [{
        external_id: `zalando-${String(o.sku ?? o.id ?? link)}`,
        name,
        brand: typeof o.brand === "string" ? o.brand : null,
        price: o.price != null ? String(o.price) : null,
        currency: typeof o.currency === "string" ? o.currency : "EUR",
        image_url: img,
        source_url: link,
        store_name: "Zalando",
        platform: "zalando",
        source_type: "scraper",
        source_trust_level: "medium" as const,
        category: typeof o.category === "string" ? o.category : null,
      }];
    });
  } catch (e) {
    console.warn("[apify:zalando] failed", (e as Error).message);
    return [];
  }
}

// Coupang (KR). Field names follow `epctex/coupang-scraper`-style outputs;
// safely handles missing fields if you swap actors.
async function fetchApifyCoupang(query: string, max: number): Promise<RawProduct[]> {
  try {
    const items = await withTimeout(
      callApifyActor(APIFY_ACTORS.coupang, {
        search: [query],
        searches: [query],
        keywords: [query],
        maxItems: max,
        startUrls: [],
      }),
      SOURCE_BUDGET_MS,
      "apify_coupang",
    );
    return items.flatMap((it) => {
      const o = it as Record<string, unknown>;
      const img = safeImage(
        o.image ?? o.imageUrl ?? o.thumbnail ??
        (Array.isArray(o.images) ? (o.images as unknown[])[0] : null),
      );
      const name = String(o.name ?? o.title ?? o.productName ?? "").trim();
      const link =
        typeof o.url === "string" ? o.url :
        typeof o.productUrl === "string" ? o.productUrl :
        typeof o.link === "string" ? o.link : null;
      if (!img || !link || !name || !isFashion(name)) return [];
      return [{
        external_id: `coupang-${String(o.productId ?? o.id ?? link)}`,
        name,
        brand: typeof o.brand === "string" ? o.brand : null,
        price: o.price != null ? String(o.price) : (o.salePrice != null ? String(o.salePrice) : null),
        currency: typeof o.currency === "string" ? o.currency : "KRW",
        image_url: img,
        source_url: link,
        store_name: "Coupang",
        platform: "coupang",
        source_type: "scraper",
        source_trust_level: "medium" as const,
        category: typeof o.category === "string" ? o.category : null,
      }];
    });
  } catch (e) {
    console.warn("[apify:coupang] failed", (e as Error).message);
    return [];
  }
}

// Google Shopping — universal coverage. Returns merchant-tagged items so
// platform reflects the upstream store when available.
async function fetchApifyGoogleShopping(query: string, max: number): Promise<RawProduct[]> {
  try {
    const items = await withTimeout(
      callApifyActor(APIFY_ACTORS.gshopping, {
        queries: [query],
        searchQueries: [query],
        maxItems: max,
        countryCode: "us",
      }),
      SOURCE_BUDGET_MS,
      "apify_gshopping",
    );
    return items.flatMap((it) => {
      const o = it as Record<string, unknown>;
      const img = safeImage(
        o.image ?? o.imageUrl ?? o.thumbnail ??
        (Array.isArray(o.images) ? (o.images as unknown[])[0] : null),
      );
      const name = String(o.title ?? o.name ?? "").trim();
      const link =
        typeof o.link === "string" ? o.link :
        typeof o.productUrl === "string" ? o.productUrl :
        typeof o.url === "string" ? o.url : null;
      if (!img || !link || !name || !isFashion(name)) return [];
      const merchant = typeof o.merchant === "string" ? o.merchant.toLowerCase() :
        (typeof o.source === "string" ? o.source.toLowerCase() : "google_shopping");
      return [{
        external_id: `gshop-${String(o.productId ?? o.id ?? link)}`,
        name,
        brand: typeof o.brand === "string" ? o.brand : null,
        price: o.price != null ? String(o.price) : null,
        currency: typeof o.currency === "string" ? o.currency : "USD",
        image_url: img,
        source_url: link,
        store_name: typeof o.merchant === "string" ? o.merchant : "Google Shopping",
        platform: merchant.replace(/\s+/g, "_").slice(0, 32),
        source_type: "scraper",
        source_trust_level: "medium" as const,
        category: typeof o.category === "string" ? o.category : null,
      }];
    });
  } catch (e) {
    console.warn("[apify:gshopping] failed", (e as Error).message);
    return [];
  }
}

// ── ScrapingBee — backup HTML fetch + JSON-LD extractor ─────────────────────
// Used as automatic fallback when Apify kickoff fails / returns empty,
// and as the primary route for Korean domains without a working Apify actor.
//
// Strategy: hit each retailer's search URL through ScrapingBee with JS render,
// pull JSON-LD `Product` blocks (most KR shops emit them), then fall back to
// og:image + <title>. Normalized into the same RawProduct shape used by the
// Apify branch so the rest of the pipeline (dedupe, upsert) is unchanged.

interface ScrapingBeeResult { ok: boolean; html?: string; status?: number; error?: string; }

async function fetchWithScrapingBee(input: {
  url: string;
  renderJs?: boolean;
  timeoutMs?: number;
  blockResources?: boolean;
}): Promise<ScrapingBeeResult> {
  if (!SCRAPINGBEE_API_KEY) return { ok: false, error: "SCRAPINGBEE_API_KEY_MISSING" };
  const timeoutMs = input.timeoutMs ?? SOURCE_BUDGET_MS;
  try {
    const endpoint = new URL("https://app.scrapingbee.com/api/v1/");
    endpoint.searchParams.set("api_key", SCRAPINGBEE_API_KEY);
    endpoint.searchParams.set("url", input.url);
    if (input.renderJs) endpoint.searchParams.set("render_js", "true");
    if (input.blockResources !== false) endpoint.searchParams.set("block_resources", "true");
    const res = await withTimeout(fetch(endpoint.toString()), timeoutMs, "scrapingbee");
    if (!res.ok) return { ok: false, status: res.status, error: `SCRAPINGBEE_HTTP_${res.status}` };
    const html = await res.text();
    if (!html || html.length < 200) return { ok: false, error: "SCRAPINGBEE_EMPTY_HTML" };
    return { ok: true, html, status: res.status };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// Domain-aware fetch with one-retry policy. WConcept retries without JS if
// the JS-rendered call times out; SSG gets a slightly longer budget.
async function fetchKrPage(domain: string, url: string): Promise<ScrapingBeeResult> {
  const t0 = Date.now();
  if (domain === "ssg") {
    const r = await fetchWithScrapingBee({ url, renderJs: true, timeoutMs: 22_000 });
    console.log(`[scrapingbee:${domain}] fetched in ${Date.now() - t0}ms ok=${r.ok}`);
    return r;
  }
  if (domain === "wconcept") {
    const r1 = await fetchWithScrapingBee({ url, renderJs: true, timeoutMs: 16_000 });
    if (r1.ok) { console.log(`[scrapingbee:${domain}] fetched in ${Date.now() - t0}ms ok=true`); return r1; }
    console.warn(`[scrapingbee:${domain}] retry without JS (${r1.error})`);
    const r2 = await fetchWithScrapingBee({ url, renderJs: false, timeoutMs: 10_000 });
    console.log(`[scrapingbee:${domain}] fallback fetched in ${Date.now() - t0}ms ok=${r2.ok}`);
    return r2;
  }
  // Default: render JS, standard budget.
  const r = await fetchWithScrapingBee({ url, renderJs: true, timeoutMs: SOURCE_BUDGET_MS });
  console.log(`[scrapingbee:${domain}] fetched in ${Date.now() - t0}ms ok=${r.ok}`);
  return r;
}

// Extract product objects from JSON-LD blocks. Handles single Product and
// arrays/ItemList graphs (ssg, wconcept, 29cm all use these patterns).
function extractJsonLdProducts(html: string): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(m[1].trim());
      const list = Array.isArray(parsed) ? parsed : [parsed];
      for (const node of list) {
        if (!node || typeof node !== "object") continue;
        const o = node as Record<string, unknown>;
        const t = String(o["@type"] ?? "").toLowerCase();
        if (t.includes("product")) out.push(o);
        const graph = o["@graph"];
        if (Array.isArray(graph)) {
          for (const g of graph) {
            if (g && typeof g === "object" && String((g as Record<string, unknown>)["@type"] ?? "").toLowerCase().includes("product")) {
              out.push(g as Record<string, unknown>);
            }
          }
        }
        const items = (o.itemListElement ?? null) as unknown;
        if (Array.isArray(items)) {
          for (const it of items) {
            const item = (it as Record<string, unknown>)?.item;
            if (item && typeof item === "object") out.push(item as Record<string, unknown>);
          }
        }
      }
    } catch { /* ignore malformed JSON-LD */ }
  }
  return out;
}

function pickPrice(o: Record<string, unknown>): { price: string | null; currency: string | null } {
  const offers = o.offers as unknown;
  if (offers && typeof offers === "object") {
    const arr = Array.isArray(offers) ? offers : [offers];
    for (const off of arr) {
      const ob = off as Record<string, unknown>;
      const p = ob.price ?? ob.lowPrice;
      if (p != null) return { price: String(p), currency: typeof ob.priceCurrency === "string" ? ob.priceCurrency : null };
    }
  }
  return { price: null, currency: null };
}

interface ExtractedItem {
  title: string; image: string | null; brand: string | null;
  price: string | null; currency: string | null; url: string;
}

function extractProductsFromHtml(html: string, pageUrl: string): ExtractedItem[] {
  const products = extractJsonLdProducts(html);
  const out: ExtractedItem[] = [];
  for (const o of products) {
    const title = String(o.name ?? "").trim();
    if (!title) continue;
    const image = (() => {
      const img = o.image;
      if (typeof img === "string") return safeImage(img);
      if (Array.isArray(img) && typeof img[0] === "string") return safeImage(img[0]);
      if (img && typeof img === "object") return safeImage((img as Record<string, unknown>).url as string);
      return null;
    })();
    const brand = (() => {
      const b = o.brand;
      if (typeof b === "string") return b;
      if (b && typeof b === "object") {
        const n = (b as Record<string, unknown>).name;
        if (typeof n === "string") return n;
      }
      return null;
    })();
    const url = (() => {
      const u = o.url;
      if (typeof u === "string") {
        try { return new URL(u, pageUrl).toString(); } catch { return u; }
      }
      return pageUrl;
    })();
    const { price, currency } = pickPrice(o);
    out.push({ title, image, brand, price, currency, url });
  }
  return out;
}

// ── Domain-specific HTML card extractors ───────────────────────────────────
// KR commerce pages render product cards client-side and rarely include
// JSON-LD on listing pages. For each domain we walk a regex over the HTML
// to find product anchors + their nearest <img> + nearest price text.
//
// This is intentionally regex-based (not a DOM parser) because the Deno
// edge runtime doesn't ship a full HTML parser and we want low latency.

function absUrl(href: string, base: string): string | null {
  try { return new URL(href, base).toString(); } catch { return null; }
}

// Generic anchor + image + price triple-walker. Slices the HTML around each
// matching anchor and looks for the nearest <img src=...> and the nearest
// price string within ~1200 chars of context.
function walkAnchorsForCards(opts: {
  html: string;
  baseUrl: string;
  linkRe: RegExp;
  pricePatterns: RegExp[];
  store: string;
  defaultCurrency: string;
}): ExtractedItem[] {
  const { html, baseUrl, linkRe, pricePatterns, defaultCurrency } = opts;
  const out: ExtractedItem[] = [];
  const seen = new Set<string>();
  // Find every anchor with a product-shaped href.
  const anchorRe = /<a[^>]+href=["']([^"'#]+)["'][^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = anchorRe.exec(html)) !== null) {
    const href = m[1];
    if (!linkRe.test(href)) continue;
    const abs = absUrl(href, baseUrl);
    if (!abs) continue;
    const key = abs.split("?")[0].split("#")[0];
    if (seen.has(key)) continue;

    const context = html.slice(Math.max(0, m.index - 200), Math.min(html.length, m.index + 1400));

    // Title — anchor's own text content or alt= of nearest img.
    let title = "";
    const closingTagAt = context.indexOf("</a>", 200);
    if (closingTagAt > 0) {
      const inner = context.slice(200, closingTagAt);
      // Strip nested tags
      const text = inner.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      if (text.length >= 3 && text.length <= 200) title = text;
    }
    const altMatch = /<img[^>]+alt=["']([^"']{3,200})["']/i.exec(context);
    if (!title && altMatch) title = altMatch[1].trim();
    if (!title) continue;

    // Image — first <img> with src/data-src/srcset in the surrounding card.
    const imgMatch = /<img[^>]+(?:src|data-src|data-original|data-lazy-src|data-srcset|srcset)=["']([^"' ]+)/i.exec(context);
    let image: string | null = null;
    if (imgMatch) {
      let src = imgMatch[1].trim();
      if (src.startsWith("//")) src = "https:" + src;
      const safe = safeImage(absUrl(src, baseUrl) || src);
      if (safe) image = safe;
    }
    if (!image) continue;

    // Price — first matching pattern.
    let price: string | null = null;
    for (const p of pricePatterns) {
      const pm = p.exec(context);
      if (pm) { price = pm[0].replace(/[^0-9.,]/g, "").replace(/^[.,]+/, ""); break; }
    }

    seen.add(key);
    out.push({ title: title.slice(0, 180), image, brand: null, price, currency: defaultCurrency, url: abs });
  }
  return out;
}

const KR_PRICE_PATTERNS = [
  /[0-9]{1,3}(?:,[0-9]{3})+\s*원/,
  /₩\s*[0-9]{1,3}(?:,[0-9]{3})+/,
  /[0-9]{4,}\s*원/,
];

function extractCardsForDomain(domain: string, html: string, pageUrl: string): ExtractedItem[] {
  const linkPatterns: Record<string, RegExp> = {
    musinsa: /\/products\/\d+|\/app\/goods\/\d+|\/goods\/\d+/i,
    "29cm": /\/product\/\d+|\/catalog\/\d+/i,
    wconcept: /\/Product\/[^"' ]+|\/product\/[^"' ]+/i,
    ssg: /\/item\/itemView\.ssg|\/item\/[^"' ]+/i,
    naver: /shopping\.naver\.com\/[^"' ]*?\/(?:catalog|products?)\/\d+|smartstore\.naver\.com\/[^"' ]+\/products\/\d+|brand\.naver\.com\/[^"' ]+\/products\/\d+/i,
  };
  const linkRe = linkPatterns[domain];
  if (!linkRe) return [];
  return walkAnchorsForCards({
    html, baseUrl: pageUrl, linkRe,
    pricePatterns: KR_PRICE_PATTERNS,
    store: domain,
    defaultCurrency: "KRW",
  });
}

// Final extractor: try JSON-LD, then domain-specific cards, then og: fallback.
function extractAllProducts(domain: string, html: string, pageUrl: string): ExtractedItem[] {
  const jsonld = extractProductsFromHtml(html, pageUrl);
  if (jsonld.length >= 3) return jsonld;
  const cards = extractCardsForDomain(domain, html, pageUrl);
  if (jsonld.length + cards.length > 0) {
    // Merge, prefer JSON-LD then cards, dedupe by url
    const seen = new Set<string>();
    const out: ExtractedItem[] = [];
    for (const it of [...jsonld, ...cards]) {
      const k = it.url.split("?")[0].toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k); out.push(it);
    }
    return out;
  }
  // og: image + <title> single-product fallback (last resort)
  const ogImg = /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i.exec(html)?.[1];
  const ogTitle = /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i.exec(html)?.[1]
    || /<title>([^<]+)<\/title>/i.exec(html)?.[1];
  if (ogImg && ogTitle) {
    return [{ title: ogTitle.trim(), image: safeImage(ogImg), brand: null, price: null, currency: "KRW", url: pageUrl }];
  }
  return [];
}

// Korean retailer search URLs. ScrapingBee fetches the search results page,
// JSON-LD extractor pulls Product nodes. Most KR shops emit ItemList JSON-LD
// on category/search pages — this is enough to seed product_cache entries.
const KR_SEARCH_URLS: Record<string, (q: string) => string> = {
  musinsa: (q) => `https://www.musinsa.com/search/musinsa/integration?q=${encodeURIComponent(q)}`,
  "29cm": (q) => `https://search.29cm.co.kr/search?keyword=${encodeURIComponent(q)}`,
  wconcept: (q) => `https://www.wconcept.co.kr/Search?kwd=${encodeURIComponent(q)}`,
  ssg: (q) => `https://www.ssg.com/search.ssg?target=all&query=${encodeURIComponent(q)}`,
  naver: (q) => `https://search.shopping.naver.com/search/all?query=${encodeURIComponent(q)}`,
};

async function fetchScrapingBeeKR(domain: keyof typeof KR_SEARCH_URLS, query: string, max: number): Promise<RawProduct[]> {
  const pageUrl = KR_SEARCH_URLS[domain](query);
  const r = await fetchKrPage(domain, pageUrl);
  if (!r.ok || !r.html) {
    console.warn(`[scrapingbee:${domain}] fetch_failed ${r.error}`);
    return [];
  }
  const extracted = extractAllProducts(domain, r.html, pageUrl);
  console.log(`[scrapingbee:${domain}] parsed_rows=${extracted.length}`);
  const out: RawProduct[] = [];
  for (const e of extracted) {
    if (!e.image || !e.title) continue;
    // RELAXED gate: a card with image + title + KR-domain context is enough.
    // The strict isFashion regex was rejecting most KR card titles because
    // tile text often lacks Hangul fashion vocabulary (just brand + model).
    out.push({
      external_id: `${domain}-${urlKey(e.url).slice(0, 80)}`,
      name: e.title,
      brand: e.brand,
      price: e.price,
      currency: e.currency || "KRW",
      image_url: e.image,
      source_url: e.url,
      store_name: domain.toUpperCase(),
      platform: `apify_${domain}`, // share platform tag w/ source-lock entries
      source_type: "scrapingbee",
      source_trust_level: "medium" as const,
      category: null,
    });
    if (out.length >= max) break;
  }
  console.log(`[scrapingbee:${domain}] validated_rows=${out.length}`);
  return out;
}

// Generic ScrapingBee fallback for an Apify-failed source. Hits the merchant's
// own search page (best-effort) and extracts JSON-LD products.
async function scrapingBeeFallbackFor(label: string, query: string, max: number): Promise<RawProduct[]> {
  const fallbackUrls: Record<string, string> = {
    apify_asos: `https://www.asos.com/search/?q=${encodeURIComponent(query)}`,
    apify_zalando: `https://www.zalando.de/catalog/?q=${encodeURIComponent(query)}`,
    apify_coupang: `https://www.coupang.com/np/search?q=${encodeURIComponent(query)}`,
    apify_gshopping: `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(query)}`,
    sb_asos: `https://www.asos.com/search/?q=${encodeURIComponent(query)}`,
    sb_zalando: `https://www.zalando.com/catalog/?q=${encodeURIComponent(query)}`,
    sb_ssense: `https://www.ssense.com/en-us/search?q=${encodeURIComponent(query)}`,
  };
  const url = fallbackUrls[label];
  if (!url) return [];
  const r = await fetchWithScrapingBee({ url, renderJs: true });
  if (!r.ok || !r.html) {
    console.warn(`[scrapingbee:${label}] fallback ${r.error}`);
    return [];
  }
  const extracted = extractProductsFromHtml(r.html, url);
  const out: RawProduct[] = [];
  for (const e of extracted) {
    if (!e.image || !e.title || !isFashion(e.title)) continue;
    out.push({
      external_id: `${label}-sb-${urlKey(e.url).slice(0, 80)}`,
      name: e.title,
      brand: e.brand,
      price: e.price,
      currency: e.currency || "USD",
      image_url: e.image,
      source_url: e.url,
      store_name: label.replace(/^apify_/, "").toUpperCase(),
      platform: label,
      source_type: "scrapingbee",
      source_trust_level: "medium" as const,
      category: null,
    });
    if (out.length >= max) break;
  }
  return out;
}

// ── Crawlbase — Farfetch (kept as supplemental high-trust source) ───────────

async function fetchCrawlbaseFarfetch(query: string): Promise<RawProduct[]> {
  if (!CRAWLBASE_TOKEN) return [];
  const target = `https://www.farfetch.com/shopping/men/search/items.aspx?q=${encodeURIComponent(query)}`;
  const url = `https://api.crawlbase.com/?token=${CRAWLBASE_TOKEN}&url=${encodeURIComponent(target)}&format=json&autoparse=true`;
  try {
    const res = await withTimeout(fetch(url), SOURCE_BUDGET_MS, "crawlbase_farfetch");
    if (!res.ok) {
      console.warn(`[crawlbase:farfetch] HTTP ${res.status}`);
      return [];
    }
    const data = await res.json().catch(() => null) as Record<string, unknown> | null;
    if (!data) return [];
    const items = Array.isArray((data as { products?: unknown[] }).products)
      ? (data as { products: unknown[] }).products
      : [];
    return items.flatMap((it) => {
      const o = it as Record<string, unknown>;
      const img = safeImage(o.image ?? (Array.isArray(o.images) ? (o.images as unknown[])[0] : null));
      const name = String(o.name ?? o.title ?? "").trim();
      const link = typeof o.url === "string" ? o.url : (typeof o.link === "string" ? o.link : null);
      if (!img || !link || !name || !isFashion(name)) return [];
      return [{
        external_id: `farfetch-${String(o.id ?? link)}`,
        name,
        brand: typeof o.brand === "string" ? o.brand : null,
        price: o.price != null ? String(o.price) : null,
        currency: typeof o.currency === "string" ? o.currency : "USD",
        image_url: img,
        source_url: link,
        store_name: "Farfetch",
        platform: "farfetch",
        source_type: "scraper",
        source_trust_level: "high" as const,
        category: typeof o.category === "string" ? o.category : null,
      }];
    });
  } catch (e) {
    console.warn("[crawlbase:farfetch] failed", (e as Error).message);
    return [];
  }
}

// ── DataForSEO — Google Shopping merchant API ───────────────────────────────
// Runs as one additional provider in the parallel multi-source fan-out.
// Uses task_post + task_get/advanced. Never throws — returns [] on any
// failure so Discovery keeps working from the other sources.

function dataForSeoAuthHeader(): string | null {
  if (DATAFORSEO_BASIC_AUTH) return `Basic ${DATAFORSEO_BASIC_AUTH}`;
  if (DATAFORSEO_LOGIN && DATAFORSEO_PASSWORD) {
    return `Basic ${btoa(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`)}`;
  }
  return null;
}

function parseDfsPrice(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "number") return String(v);
  if (typeof v === "string") {
    const m = v.replace(/[, ]/g, "").match(/(\d+(?:\.\d+)?)/);
    return m ? m[1] : null;
  }
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (o.current != null) return parseDfsPrice(o.current);
    if (o.value != null) return parseDfsPrice(o.value);
  }
  return null;
}

async function callDataForSeo(url: string, body: unknown, auth: string, label: string): Promise<{ ok: boolean; status: number; data: any }> {
  const res = await withTimeout(
    fetch(url, {
      method: "POST",
      headers: { "Authorization": auth, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    SOURCE_BUDGET_MS,
    label,
  );
  const data = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, data };
}

async function fetchDataForSeo(query: string, max: number): Promise<RawProduct[]> {
  const auth = dataForSeoAuthHeader();
  if (!auth) {
    console.warn("[DATAFORSEO_DISABLED] Missing credentials");
    return [];
  }
  try {
    const payload = [{
      location_name: "United States",
      language_name: "English",
      keyword: query,
      depth: Math.min(max * 2, 100),
    }];

    // Endpoint cascade — different DataForSEO plans expose different APIs.
    // We try in order; first non-empty result wins.
    const endpoints = [
      { url: "https://api.dataforseo.com/v3/merchant/google/products/live/advanced", label: "merchant_live" },
      { url: "https://api.dataforseo.com/v3/serp/google/shopping/live/advanced", label: "serp_shopping_live" },
    ];

    let items: unknown[] = [];
    let usedEndpoint = "";
    for (const ep of endpoints) {
      const r = await callDataForSeo(ep.url, payload, auth, `dataforseo_${ep.label}`);
      if (!r.ok) {
        console.warn(`[dataforseo:${ep.label}] HTTP ${r.status}`, r.data?.status_message ?? "");
        continue;
      }
      const taskStatus = r.data?.tasks?.[0]?.status_code;
      const taskMsg = r.data?.tasks?.[0]?.status_message;
      const result = r.data?.tasks?.[0]?.result?.[0];
      const candidate: unknown[] =
        result?.items || result?.products || [];
      if (taskStatus && taskStatus >= 40000) {
        console.warn(`[dataforseo:${ep.label}] task error ${taskStatus} ${taskMsg}`);
      }
      if (Array.isArray(candidate) && candidate.length) {
        items = candidate;
        usedEndpoint = ep.label;
        break;
      } else {
        console.log(`[dataforseo:${ep.label}] empty result`, { taskStatus, taskMsg });
      }
    }

    if (!items.length) return [];

    const out: RawProduct[] = [];
    for (const it of items.slice(0, max)) {
      const o = it as Record<string, unknown>;
      // SERP shopping items wrap product fields under various keys; flatten.
      const name = String(o.title ?? o.product_title ?? o.name ?? "").trim();
      const link = (typeof o.url === "string" ? o.url
        : typeof o.product_url === "string" ? o.product_url
        : typeof o.shop_ad_aclk === "string" ? o.shop_ad_aclk
        : typeof o.link === "string" ? o.link : null);
      const img = safeImage(
        o.image_url ?? o.thumbnail ?? o.image ??
        (Array.isArray(o.images) ? (o.images as unknown[])[0] : null),
      );
      if (!name || !link || !img) continue;
      if (!isFashion(name)) continue;
      const id = String(o.product_id ?? o.product_seller_id ?? o.id ?? link);
      const merchant = (typeof o.seller === "string" ? o.seller
        : typeof o.shop === "string" ? o.shop
        : typeof o.source === "string" ? o.source
        : typeof o.domain === "string" ? o.domain : "Google Shopping");
      out.push({
        external_id: `dfs-${id}`.slice(0, 120),
        name,
        brand: typeof o.brand === "string" ? o.brand : null,
        price: parseDfsPrice(o.price ?? o.price_value),
        currency: typeof o.currency === "string" ? o.currency : "USD",
        image_url: img,
        source_url: link,
        store_name: typeof merchant === "string" ? merchant : "Google Shopping",
        platform: String(merchant).toLowerCase().replace(/\s+/g, "_").slice(0, 32) || "google_shopping",
        source_type: "scraper",
        source_trust_level: link && img ? "high" : "medium",
        category: typeof o.category === "string" ? o.category : null,
      });
    }
    console.log("[DATAFORSEO_RESULT_COUNT]", { query, count: out.length, endpoint: usedEndpoint });
    return out;
  } catch (e) {
    console.warn("[DATAFORSEO_SKIPPED_OR_FAILED]", (e as Error).message);
    return [];
  }
}

// ── Dedupe (URL + normalized title + image host) ────────────────────────────

function imageHostKey(u: string): string {
  try {
    const url = new URL(u);
    return `${url.host}${url.pathname}`.toLowerCase();
  } catch {
    return u.toLowerCase();
  }
}
function normalizedTitleKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9가-힣]+/g, "").slice(0, 60);
}
function urlKey(u: string): string {
  try {
    const url = new URL(u);
    return `${url.host}${url.pathname}`.toLowerCase();
  } catch {
    return u.toLowerCase();
  }
}

function dedupe(items: RawProduct[]): RawProduct[] {
  const seenUrl = new Set<string>();
  const seenTitle = new Set<string>();
  const seenImage = new Set<string>();
  const out: RawProduct[] = [];
  for (const p of items) {
    const u = urlKey(p.source_url);
    const t = normalizedTitleKey(p.name);
    const i = imageHostKey(p.image_url);
    if (seenUrl.has(u) || seenTitle.has(t) || seenImage.has(i)) continue;
    seenUrl.add(u); seenTitle.add(t); seenImage.add(i);
    out.push(p);
  }
  return out;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Persist into product_cache (with normalized_title in search_query) ──────

async function upsertCache(items: RawProduct[], query: string): Promise<number> {
  if (!items.length) return 0;
  const sb = createClient(SUPABASE_URL, SERVICE_KEY);
  const rows = items.map((p) => ({
    external_id: p.external_id,
    name: p.name,
    brand: p.brand,
    price: p.price,
    currency: p.currency,
    category: p.category,
    image_url: p.image_url,
    source_url: p.source_url,
    store_name: p.store_name,
    platform: p.platform,
    source_type: p.source_type,
    source_trust_level: p.source_trust_level,
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
    console.warn("[multi-source] upsert error", error.message);
    return 0;
  }
  return count ?? rows.length;
}

// ── Handler ─────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const body = await req.json().catch(() => ({}));
    const query = body?.query;
    // intensity: "live" (default, lower per-actor cap) or "cron" (bulk, higher cap)
    const intensity: "live" | "cron" = body?.intensity === "cron" ? "cron" : "live";
    if (!query || typeof query !== "string") {
      return new Response(JSON.stringify({ error: "query required" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Per-actor maxItems caps. Live keeps cost low; cron pulls bulk.
    const cap = intensity === "cron"
      ? { asos: 40, zalando: 40, coupang: 40, gshopping: 50 }
      : { asos: 12, zalando: 12, coupang: 12, gshopping: 15 };

    // 60s cooldown — only applies to live calls. Cron always re-fetches.
    const ck = cooldownKey(`${intensity}:${query}`);
    if (intensity === "live") {
      const cached = cooldownCache.get(ck);
      if (cached && Date.now() - cached.ts < COOLDOWN_MS) {
        console.log("[multi-source] cooldown hit", { query, age_ms: Date.now() - cached.ts });
        return new Response(
          JSON.stringify({ ok: true, cached: true, intensity, ...(cached.result as object) }),
          { headers: { ...cors, "Content-Type": "application/json" } },
        );
      }
    }

    const t0 = Date.now();
    const krCap = intensity === "cron" ? 25 : 10;
    // Source-lock: short-circuit any source not in ENABLED_SOURCES so we
    // don't waste actor budget or Crawlbase credits on disabled platforms.
    const skip = async () => [] as RawProduct[];
    const settled = await Promise.allSettled([
      sourceEnabled("apify_asos") ? fetchApifyAsos(query, cap.asos) : skip(),
      sourceEnabled("apify_zalando") ? fetchApifyZalando(query, cap.zalando) : skip(),
      sourceEnabled("apify_coupang") ? fetchApifyCoupang(query, cap.coupang) : skip(),
      sourceEnabled("apify_gshopping") ? fetchApifyGoogleShopping(query, cap.gshopping) : skip(),
      sourceEnabled("crawlbase_farfetch") ? fetchCrawlbaseFarfetch(query) : skip(),
      // KR retailers — Apify actors don't exist for these, so route directly to ScrapingBee.
      sourceEnabled("apify_musinsa") ? fetchScrapingBeeKR("musinsa", query, krCap) : skip(),
      sourceEnabled("apify_29cm") ? fetchScrapingBeeKR("29cm", query, krCap) : skip(),
      sourceEnabled("apify_wconcept") ? fetchScrapingBeeKR("wconcept", query, krCap) : skip(),
      sourceEnabled("apify_ssg") ? fetchScrapingBeeKR("ssg", query, krCap) : skip(),
      sourceEnabled("apify_naver") ? fetchScrapingBeeKR("naver", query, krCap) : skip(),
      // Global retailers via direct ScrapingBee (independent of Apify gate).
      sourceEnabled("sb_asos") && SCRAPINGBEE_API_KEY ? scrapingBeeFallbackFor("sb_asos", query, krCap) : skip(),
      sourceEnabled("sb_zalando") && SCRAPINGBEE_API_KEY ? scrapingBeeFallbackFor("sb_zalando", query, krCap) : skip(),
      sourceEnabled("sb_ssense") && SCRAPINGBEE_API_KEY ? scrapingBeeFallbackFor("sb_ssense", query, krCap) : skip(),
      // DataForSEO Google Shopping — additional provider, never blocks others.
      sourceEnabled("dataforseo") ? fetchDataForSeo(query, intensity === "cron" ? 40 : 20) : skip(),
    ]);

    const labels = [
      "apify_asos", "apify_zalando", "apify_coupang", "apify_gshopping",
      "crawlbase_farfetch",
      "apify_musinsa", "apify_29cm", "apify_wconcept", "apify_ssg", "apify_naver",
      "sb_asos", "sb_zalando", "sb_ssense",
      "dataforseo",
    ];
    const perSource: Record<string, number> = {};
    const fallbackUsed: string[] = [];
    const merged: RawProduct[] = [];
    settled.forEach((r, i) => {
      const items = r.status === "fulfilled" ? r.value : [];
      perSource[labels[i]] = items.length;
      merged.push(...items);
    });

    // Apify-empty fallback: if a major Apify actor returned 0, try ScrapingBee
    // on the merchant's own search page. Runs in parallel; bounded budget.
    const apifyFallbackTargets = (["apify_asos", "apify_zalando", "apify_coupang", "apify_gshopping"] as const)
      .filter((label) => sourceEnabled(label) && (perSource[label] ?? 0) === 0 && SCRAPINGBEE_API_KEY);
    if (apifyFallbackTargets.length) {
      const fbCap = intensity === "cron" ? 20 : 8;
      const fbResults = await Promise.allSettled(
        apifyFallbackTargets.map((label) => scrapingBeeFallbackFor(label, query, fbCap)),
      );
      fbResults.forEach((r, i) => {
        const label = apifyFallbackTargets[i];
        const items = r.status === "fulfilled" ? r.value : [];
        if (items.length) {
          perSource[`${label}_fallback`] = items.length;
          fallbackUsed.push(label);
          merged.push(...items);
        }
      });
    }

    const deduped = dedupe(merged);
    const shuffled = shuffle(deduped);
    const inserted = await upsertCache(shuffled, query);

    const result = {
      query,
      intensity,
      sources: perSource,
      fallback_used: fallbackUsed,
      scrapingbee_available: !!SCRAPINGBEE_API_KEY,
      merged: merged.length,
      deduped: deduped.length,
      inserted,
      products: shuffled.slice(0, 60),
    };


    if (intensity === "live") cooldownCache.set(ck, { ts: Date.now(), result });
    // Cheap eviction of old keys to keep memory bounded.
    if (cooldownCache.size > 200) {
      const cutoff = Date.now() - COOLDOWN_MS;
      for (const [k, v] of cooldownCache.entries()) if (v.ts < cutoff) cooldownCache.delete(k);
    }

    console.log("[multi-source] done", { ...result, products: shuffled.length, elapsed_ms: Date.now() - t0 });

    return new Response(
      JSON.stringify({ ok: true, cached: false, ...result }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[multi-source] fatal", (e as Error).message);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
