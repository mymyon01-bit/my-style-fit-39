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

// ── APIFY GATE (stabilization pass 2026-04-19) ─────────────────────────────
// Apify is disabled by default. When false, every fetchApify* call short-
// circuits and only ScrapingBee KR routes return rows.
const APIFY_ENABLED = (Deno.env.get("APIFY_ENABLED") || "false").toLowerCase() === "true";

// ── SOURCE LOCK ────────────────────────────────────────────────────────────
// Comma-separated list of allowed source labels. Defaults to KR-only ScrapingBee.
// To re-enable an Apify source, set APIFY_ENABLED=true AND list the label here.
// KR routes via ScrapingBee + Global routes (ASOS / Zalando / SSENSE) via direct ScrapingBee.
// Global labels share the apify_* prefix for legacy compatibility but actually run via ScrapingBee.
const DEFAULT_ENABLED = "apify_musinsa,apify_29cm,apify_wconcept,apify_ssg,apify_naver,sb_asos,sb_zalando,sb_ssense";
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

// ── ScraperAPI provider (extra source for product diversity) ────────────────
// Hits Google Shopping + targeted retailer site: queries via ScraperAPI render.
// Used as a TOP-UP source: only fires when other providers underperform.
const SCRAPERAPI_KEY = Deno.env.get("SCRAPERAPI_KEY");
const SCRAPERAPI_TIMEOUT_MS = 20_000;
const SCRAPERAPI_MAX_CALLS_PER_QUERY = 3;

const SCRAPERAPI_TARGETS: Array<(q: string) => { url: string; retailer: string }> = [
  (q) => ({
    url: `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(q + " fashion")}`,
    retailer: "google_shopping",
  }),
  (q) => ({
    url: `https://www.google.com/search?q=${encodeURIComponent(q + " site:ssense.com")}`,
    retailer: "ssense",
  }),
  (q) => ({
    url: `https://www.google.com/search?q=${encodeURIComponent(q + " site:farfetch.com")}`,
    retailer: "farfetch",
  }),
  (q) => ({
    url: `https://www.google.com/search?q=${encodeURIComponent(q + " site:asos.com")}`,
    retailer: "asos",
  }),
  (q) => ({
    url: `https://www.google.com/search?q=${encodeURIComponent(q + " site:mrporter.com")}`,
    retailer: "mrporter",
  }),
  (q) => ({
    url: `https://www.google.com/search?q=${encodeURIComponent(q + " site:net-a-porter.com")}`,
    retailer: "netaporter",
  }),
  (q) => ({
    url: `https://www.google.com/search?q=${encodeURIComponent(q + " site:matchesfashion.com")}`,
    retailer: "matches",
  }),
  (q) => ({
    url: `https://www.google.com/search?q=${encodeURIComponent(q + " site:endclothing.com")}`,
    retailer: "endclothing",
  }),
];

async function fetchScraperApiOnce(target: { url: string; retailer: string }): Promise<RawProduct[]> {
  if (!SCRAPERAPI_KEY) return [];
  const apiUrl = `https://api.scraperapi.com/?api_key=${SCRAPERAPI_KEY}&url=${encodeURIComponent(target.url)}&render=true&country_code=us`;
  let attempt = 0;
  while (attempt < 2) {
    attempt++;
    try {
      const res = await withTimeout(fetch(apiUrl), SCRAPERAPI_TIMEOUT_MS, `scraperapi:${target.retailer}`);
      if (!res.ok) {
        console.warn(`[scraperapi:${target.retailer}] HTTP ${res.status}`);
        if (attempt >= 2) return [];
        continue;
      }
      const html = await res.text();
      const extracted = extractProductsFromHtml(html, target.url);
      const out: RawProduct[] = [];
      for (const e of extracted) {
        // Mandatory: image + product url + non-trivial title
        if (!e.image || !e.url) continue;
        if (!e.title || e.title.trim().length < 3) continue;
        // Reject obvious ads / navigation cruft
        if (/^(shop|sale|new in|sign in|menu|home)$/i.test(e.title.trim())) continue;
        out.push({
          external_id: `scraperapi-${target.retailer}-${urlKey(e.url).slice(0, 80)}`,
          name: e.title,
          brand: e.brand,
          price: e.price,
          currency: e.currency || "USD",
          image_url: e.image,
          source_url: e.url,
          store_name: target.retailer.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
          platform: `scraperapi_${target.retailer}`,
          source_type: "scraperapi",
          source_trust_level: "medium" as const,
          category: null,
        });
      }
      console.log(`[scraperapi:${target.retailer}] parsed=${extracted.length} validated=${out.length}`);
      return out;
    } catch (e) {
      console.warn(`[scraperapi:${target.retailer}] error attempt=${attempt} ${(e as Error).message}`);
      if (attempt >= 2) return [];
    }
  }
  return [];
}

async function fetchScraperApiTopUp(query: string, maxCalls: number): Promise<RawProduct[]> {
  if (!SCRAPERAPI_KEY) {
    console.log("[scraperapi] skipped — no SCRAPERAPI_KEY");
    return [];
  }
  const calls = Math.min(maxCalls, SCRAPERAPI_MAX_CALLS_PER_QUERY, SCRAPERAPI_TARGETS.length);
  // Pick first N targets — Google Shopping first (broadest), then luxury/site-restricted searches.
  const targets = SCRAPERAPI_TARGETS.slice(0, calls).map((fn) => fn(query));
  const settled = await Promise.allSettled(targets.map((t) => fetchScraperApiOnce(t)));
  const merged: RawProduct[] = [];
  settled.forEach((r) => {
    if (r.status === "fulfilled") merged.push(...r.value);
  });
  return merged;
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

// Score how "rich" a product row is — used to pick the better duplicate.
function richness(p: RawProduct): number {
  let s = 0;
  if (p.brand && p.brand.trim().length > 1) s += 3;
  if (p.price && p.price.toString().trim().length) s += 2;
  if (p.category) s += 1;
  if (p.name && p.name.length > 25) s += 1;
  if (p.source_trust_level === "high") s += 2;
  else if (p.source_trust_level === "medium") s += 1;
  return s;
}

// Dedupe across URL / title / image-host keys. When duplicates collide, keep
// the row with the richest metadata (brand+price+category+trust). This means
// a sparse ScraperAPI hit won't displace an Apify/ScrapingBee row that already
// has full data — and vice versa.
function dedupe(items: RawProduct[]): RawProduct[] {
  const byKey = new Map<string, RawProduct>();
  const keyToCanonical = new Map<string, string>(); // any-key -> canonical key
  for (const p of items) {
    const keys = [
      `u:${urlKey(p.source_url)}`,
      `t:${normalizedTitleKey(p.name)}`,
      `i:${imageHostKey(p.image_url)}`,
    ];
    // Find any existing canonical bucket this product collides with.
    let canonical: string | null = null;
    for (const k of keys) {
      const c = keyToCanonical.get(k);
      if (c) { canonical = c; break; }
    }
    if (canonical) {
      const existing = byKey.get(canonical)!;
      if (richness(p) > richness(existing)) byKey.set(canonical, p);
      // Map any new keys this product introduces back to the canonical bucket.
      for (const k of keys) if (!keyToCanonical.has(k)) keyToCanonical.set(k, canonical);
    } else {
      const c = keys[0];
      byKey.set(c, p);
      for (const k of keys) keyToCanonical.set(k, c);
    }
  }
  return [...byKey.values()];
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Source-balanced interleave: groups items by platform, shuffles within each
// group, then round-robins across groups so the top of the feed always mixes
// sources instead of being dominated by whichever provider returned most rows.
// Also enforces a soft per-platform cap (default ~30% of total) so a single
// source can never crowd out everything else.
function balancedInterleave(items: RawProduct[], maxShareOfTotal = 0.3): RawProduct[] {
  if (items.length <= 1) return items;
  const groups = new Map<string, RawProduct[]>();
  for (const p of items) {
    const key = (p.platform || p.source_type || "unknown").toLowerCase();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(p);
  }
  // Shuffle within each platform bucket so we don't always show the same row first.
  const buckets = [...groups.entries()].map(([k, list]) => ({ key: k, list: shuffle(list) }));
  // Per-platform cap: at most maxShareOfTotal of total items (rounded up, min 4).
  const cap = Math.max(4, Math.ceil(items.length * maxShareOfTotal));
  const taken: Record<string, number> = {};
  const overflow: RawProduct[] = [];
  // Randomize the round-robin start order each call to vary which source leads.
  const order = shuffle(buckets);
  const out: RawProduct[] = [];
  let added = true;
  while (added) {
    added = false;
    for (const b of order) {
      const next = b.list.shift();
      if (!next) continue;
      added = true;
      const used = taken[b.key] ?? 0;
      if (used >= cap) {
        overflow.push(next);
      } else {
        out.push(next);
        taken[b.key] = used + 1;
      }
    }
  }
  // Append any overflow at the tail (still better than dropping them entirely).
  return out.concat(overflow);
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
    ]);

    const labels = [
      "apify_asos", "apify_zalando", "apify_coupang", "apify_gshopping",
      "crawlbase_farfetch",
      "apify_musinsa", "apify_29cm", "apify_wconcept", "apify_ssg", "apify_naver",
      "sb_asos", "sb_zalando", "sb_ssense",
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

    // ── ScraperAPI top-up: if combined sources are still thin, augment with
    // ScraperAPI (Google Shopping + site-restricted luxury queries). Capped at
    // 3 calls per query. Image-less / titleless results are dropped inside.
    const preDedupedCount = dedupe(merged).length;
    let scraperapiAdded = 0;
    if (SCRAPERAPI_KEY && preDedupedCount < 24) {
      const deficit = Math.max(0, 60 - preDedupedCount);
      const calls = deficit >= 40 ? 3 : deficit >= 20 ? 2 : 1;
      const sapi = await fetchScraperApiTopUp(query, calls);
      scraperapiAdded = sapi.length;
      perSource["scraperapi"] = scraperapiAdded;
      if (scraperapiAdded) {
        fallbackUsed.push("scraperapi");
        merged.push(...sapi);
      }
      console.log(`[MYMYON SOURCING] scraperapi calls=${calls} added=${scraperapiAdded} preDedupe=${preDedupedCount}`);
    }

    const deduped = dedupe(merged);
    const duplicatesRemoved = merged.length - deduped.length;
    // Source-balanced interleave: round-robin across platforms with a soft
    // 30% cap per source so no single provider (incl. ScraperAPI) dominates.
    const shuffled = balancedInterleave(deduped, 0.3);
    const inserted = await upsertCache(shuffled, query);

    console.log(
      `[MYMYON SOURCING] existing_provider=${preDedupedCount} scraperapi_added=${scraperapiAdded} ` +
      `final_normalized=${deduped.length} duplicates_removed=${duplicatesRemoved} inserted=${inserted}`,
    );

    const result = {
      query,
      intensity,
      sources: perSource,
      fallback_used: fallbackUsed,
      scrapingbee_available: !!SCRAPINGBEE_API_KEY,
      scraperapi_available: !!SCRAPERAPI_KEY,
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
