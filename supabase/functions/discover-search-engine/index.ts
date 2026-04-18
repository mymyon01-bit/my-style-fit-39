// discover-search-engine
// ----------------------
// APIFY-FIRST Korean commerce discovery + Firecrawl refinement.
// No Google CSE. No Naver Search API. No external search-engine keys.
//
//   query
//     │
//     ▼
//   expandQuery (Korean + EN variants)
//     │
//     ▼
//   per-domain Apify Web Scraper runs in parallel
//   (musinsa, 29cm, wconcept, ssg, yoox, asos, oakandfort)
//     │
//     ▼
//   Firecrawl refines pages with missing title/price/image
//     │
//     ▼
//   normalize → dedupe → upsert product_cache
//     │
//     ▼
//   diagnostics_events (discover_*)
//
// Idempotent. Tolerates partial domain failure. Returns per-domain telemetry.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APIFY_TOKEN = Deno.env.get("APIFY_TOKEN");
const FIRECRAWL_KEY = Deno.env.get("FIRECRAWL_API_KEY");
const APIFY_WEB_SCRAPER =
  Deno.env.get("APIFY_WEB_SCRAPER_ACTOR") || "apify~web-scraper";

const APIFY_BUDGET_MS = 55_000;
const FIRECRAWL_BUDGET_MS = 12_000;
const VARIANTS_PER_RUN = 10;
const DEFAULT_LIMIT_PER_DOMAIN = 30;

const KR_PRIMARY = ["musinsa.com", "29cm.co.kr", "wconcept.co.kr", "ssg.com"];
const GLOBAL_SECONDARY = ["yoox.com", "asos.com", "oakandfort.com"];
const DEFAULT_DOMAINS = [...KR_PRIMARY, ...GLOBAL_SECONDARY];

// ── Query expansion ─────────────────────────────────────────────────────────
function expandQuery(q: string): string[] {
  const base = q.trim();
  if (!base) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of [
    base,
    `${base} 코디`,
    `${base} 추천`,
    `${base} 스타일`,
    `${base} 브랜드`,
    `${base} outfit`,
    `${base} fashion`,
    `${base} look`,
    `${base} streetwear`,
    `${base} minimal`,
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

// ── Per-domain start URLs ───────────────────────────────────────────────────
// We seed each domain's own search/listing pages with the expanded variants.
// The Apify pageFunction then walks any product detail links it finds.
function buildStartUrls(domain: string, variants: string[], limit: number): string[] {
  const urls: string[] = [];
  for (const v of variants) {
    const q = encodeURIComponent(v);
    switch (domain) {
      case "musinsa.com":
        urls.push(`https://www.musinsa.com/search/musinsa/integration?q=${q}`);
        break;
      case "29cm.co.kr":
        urls.push(`https://search.29cm.co.kr/search/index?keyword=${q}`);
        break;
      case "wconcept.co.kr":
        urls.push(`https://www.wconcept.co.kr/Search?kwd=${q}`);
        break;
      case "ssg.com":
        urls.push(`https://www.ssg.com/search.ssg?target=all&query=${q}`);
        break;
      case "yoox.com":
        urls.push(`https://www.yoox.com/us/shoponline?textsearch=${q}`);
        break;
      case "asos.com":
        urls.push(`https://www.asos.com/search/?q=${q}`);
        break;
      case "oakandfort.com":
        urls.push(`https://oakandfort.com/search?q=${q}`);
        break;
      default:
        // Unknown domain — best-effort generic search path.
        urls.push(`https://${domain}/search?q=${q}`);
    }
  }
  return urls.slice(0, Math.max(2, Math.ceil(limit / 5)));
}

// Per-domain page function templates. Each one:
//  1. extracts JSON-LD Product nodes (most reliable),
//  2. falls back to OpenGraph,
//  3. on listing pages, enqueues product detail links so we get more candidates.
function pageFunctionForDomain(domain: string, limit: number): string {
  // The selector that identifies "product detail link" varies per site;
  // we keep it permissive and rely on per-domain link-shape regexes.
  const linkPatterns: Record<string, string> = {
    "musinsa.com": "/app/goods/|/goods/",
    "29cm.co.kr": "/product/",
    "wconcept.co.kr": "/Product/",
    "ssg.com": "/item/itemView.ssg|/item/",
    "yoox.com": "/item|/p/",
    "asos.com": "/prd/",
    "oakandfort.com": "/products/",
  };
  const linkRe = linkPatterns[domain] || "/product|/item|/goods|/p/";
  return `
async function pageFunction(context) {
  const { request, enqueueRequest, log } = context;
  const $ = context.jQuery;
  if (typeof $ !== 'function') {
    return [{ url: request.url, _err: 'jquery_not_injected' }];
  }
  const url = request.url;
  const host = (() => { try { return new URL(url).host.replace(/^www\\./, ''); } catch { return ''; } })();
  const out = [];

  // 1. JSON-LD
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const raw = JSON.parse($(el).contents().text());
      const arr = Array.isArray(raw) ? raw : [raw];
      for (const node of arr) {
        const items = (node && node['@graph']) || [node];
        for (const it of items) {
          if (it && (it['@type'] === 'Product' || (Array.isArray(it['@type']) && it['@type'].includes('Product')))) {
            out.push(it);
          }
        }
      }
    } catch (e) {}
  });

  const og = {
    title: $('meta[property="og:title"]').attr('content'),
    image: $('meta[property="og:image"]').attr('content'),
    site:  $('meta[property="og:site_name"]').attr('content'),
    desc:  $('meta[property="og:description"]').attr('content'),
    type:  $('meta[property="og:type"]').attr('content'),
    price: $('meta[property="product:price:amount"]').attr('content') ||
           $('meta[property="og:price:amount"]').attr('content'),
    currency: $('meta[property="product:price:currency"]').attr('content') ||
              $('meta[property="og:price:currency"]').attr('content'),
    brand: $('meta[property="product:brand"]').attr('content'),
  };

  const results = [];
  if (out.length) {
    for (const p of out) {
      results.push({
        url, host, sourceDomain: '${domain}',
        name: p.name || og.title,
        brand: (p.brand && (p.brand.name || p.brand)) || og.brand,
        image: Array.isArray(p.image) ? p.image[0] : (p.image || og.image),
        price: p.offers && (p.offers.price || (Array.isArray(p.offers) && p.offers[0] && p.offers[0].price)),
        currency: (p.offers && (p.offers.priceCurrency || (Array.isArray(p.offers) && p.offers[0] && p.offers[0].priceCurrency))) || og.currency,
        site: og.site,
        source: 'jsonld',
      });
    }
  } else if (og.image && og.title && (og.type === 'product' || /product|item|goods/i.test(url))) {
    results.push({
      url, host, sourceDomain: '${domain}',
      name: og.title, brand: og.brand, image: og.image,
      price: og.price, currency: og.currency, site: og.site, source: 'og',
    });
  }

  // 2. Enqueue product detail links from listing/search pages.
  const linkRe = new RegExp(${JSON.stringify(linkRe)});
  const seen = new Set();
  let enqueued = 0;
  $('a[href]').each((_, el) => {
    if (enqueued >= ${limit}) return false;
    let href = $(el).attr('href');
    if (!href) return;
    try {
      const abs = new URL(href, url).toString();
      const u = new URL(abs);
      if (u.host.replace(/^www\\./, '') !== '${domain}') return;
      if (!linkRe.test(u.pathname)) return;
      if (seen.has(abs)) return;
      seen.add(abs);
      enqueueRequest({ url: abs, userData: { detail: true } });
      enqueued++;
    } catch (e) {}
  });

  return results;
}
`;
}

// ── Apify per-domain runner ─────────────────────────────────────────────────
interface ExtractedProduct {
  url: string;
  host?: string;
  sourceDomain?: string;
  name?: string;
  brand?: string | null;
  image?: string | null;
  price?: string | number | null;
  currency?: string | null;
  site?: string | null;
}

async function apifyScrapeDomain(
  domain: string,
  variants: string[],
  limit: number,
): Promise<{ items: ExtractedProduct[]; failed: boolean }> {
  if (!APIFY_TOKEN) return { items: [], failed: true };
  const startUrls = buildStartUrls(domain, variants, limit).map((u) => ({ url: u }));
  if (startUrls.length === 0) return { items: [], failed: false };
  const url = `https://api.apify.com/v2/acts/${APIFY_WEB_SCRAPER}/run-sync-get-dataset-items?token=${APIFY_TOKEN}&timeout=50`;
  try {
    const res = await withTimeout(
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startUrls,
          pageFunction: pageFunctionForDomain(domain, limit),
          maxRequestsPerCrawl: limit + startUrls.length,
          maxConcurrency: 8,
          proxyConfiguration: { useApifyProxy: true },
          injectJQuery: true,
          ignoreSslErrors: true,
        }),
      }),
      APIFY_BUDGET_MS,
      `apify_${domain}`,
    );
    if (!res.ok) {
      console.warn(`[apify:${domain}] HTTP ${res.status}`);
      return { items: [], failed: true };
    }
    const data = await res.json().catch(() => null);
    if (!Array.isArray(data)) return { items: [], failed: true };
    const out: ExtractedProduct[] = [];
    for (const row of data) {
      if (Array.isArray(row)) out.push(...(row as ExtractedProduct[]));
      else if (row && typeof row === "object") out.push(row as ExtractedProduct);
    }
    return { items: out, failed: false };
  } catch (e) {
    console.warn(`[apify:${domain}] failed`, (e as Error).message);
    return { items: [], failed: true };
  }
}

// ── Firecrawl refine (only for items missing fields) ────────────────────────
async function firecrawlRefine(item: ExtractedProduct): Promise<ExtractedProduct> {
  if (!FIRECRAWL_KEY) return item;
  try {
    const res = await withTimeout(
      fetch("https://api.firecrawl.dev/v2/scrape", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${FIRECRAWL_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: item.url,
          formats: [
            "markdown",
            { type: "json", prompt: "Extract product title, brand, price, currency, and main image URL from this product page." },
          ],
          onlyMainContent: true,
        }),
      }),
      FIRECRAWL_BUDGET_MS,
      "firecrawl",
    );
    if (!res.ok) return item;
    const data = await res.json().catch(() => null) as { json?: Record<string, unknown> } | null;
    const j = (data?.json ?? {}) as Record<string, unknown>;
    return {
      ...item,
      name: item.name || (typeof j.title === "string" ? j.title : undefined),
      brand: item.brand || (typeof j.brand === "string" ? j.brand : null),
      image: item.image || (typeof j.image === "string" ? j.image : (typeof j.imageUrl === "string" ? j.imageUrl : null)),
      price: item.price ?? (typeof j.price === "string" || typeof j.price === "number" ? j.price : null),
      currency: item.currency || (typeof j.currency === "string" ? j.currency : null),
    };
  } catch (e) {
    console.warn("[firecrawl] refine failed", (e as Error).message);
    return item;
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

function urlKey(u: string): string {
  try {
    const url = new URL(u);
    return `${url.host}${url.pathname}`.toLowerCase();
  } catch { return u.toLowerCase(); }
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
  source_domain: string;
}

function normalize(items: ExtractedProduct[], sourceDomain: string): NormalizedProduct[] {
  const out: NormalizedProduct[] = [];
  for (const it of items) {
    const name = String(it.name ?? "").trim();
    const img = safeImage(it.image);
    const link = typeof it.url === "string" ? it.url : null;
    if (!name || !img || !link) continue;
    if (!FASHION_RE.test(name) && !FASHION_KR_RE.test(name)) continue;
    let host = sourceDomain;
    try { host = new URL(link).host.replace(/^www\./, ""); } catch { /* */ }
    const platform = host.split(".")[0] || "web";
    out.push({
      external_id: `apify-${urlKey(link)}`,
      name,
      brand: it.brand ? String(it.brand) : null,
      price: it.price != null ? String(it.price) : null,
      currency: it.currency ? String(it.currency) : "KRW",
      image_url: img,
      source_url: link,
      store_name: it.site ? String(it.site) : host,
      platform,
      source_domain: sourceDomain,
    });
  }
  return out;
}

function dedupeAcrossDomains(rows: NormalizedProduct[]): NormalizedProduct[] {
  const seenU = new Set<string>(), seenT = new Set<string>(), seenI = new Set<string>();
  const kept: NormalizedProduct[] = [];
  for (const p of rows) {
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
    source_type: "apify_korean_commerce",
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

async function logDiagnostic(
  event: string,
  status: "success" | "error" | "partial",
  metadata: Record<string, unknown>,
  durationMs?: number,
) {
  try {
    const sb = createClient(SUPABASE_URL, SERVICE_KEY);
    await sb.from("diagnostics_events").insert({
      event_name: event,
      status,
      duration_ms: durationMs ?? null,
      metadata,
    });
  } catch (e) {
    console.warn("[diagnostics] insert failed", (e as Error).message);
  }
}

// ── Handler ─────────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const t0 = Date.now();
  try {
    const body = await req.json().catch(() => ({}));
    const queries: string[] = Array.isArray(body?.queries)
      ? body.queries.filter((q: unknown): q is string => typeof q === "string" && q.trim().length > 0)
      : (typeof body?.query === "string" && body.query.trim() ? [body.query.trim()] : []);
    const domains: string[] = Array.isArray(body?.domains) && body.domains.length > 0
      ? body.domains.filter((d: unknown): d is string => typeof d === "string")
      : DEFAULT_DOMAINS;
    const limitPerDomain = Number.isFinite(body?.limitPerDomain)
      ? Math.max(5, Math.min(60, Number(body.limitPerDomain)))
      : DEFAULT_LIMIT_PER_DOMAIN;

    if (queries.length === 0) {
      return new Response(JSON.stringify({ error: "query or queries required" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    if (!APIFY_TOKEN) {
      return new Response(JSON.stringify({ error: "APIFY_TOKEN not configured" }), {
        status: 500, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const allResults: Array<Record<string, unknown>> = [];
    let totalInserted = 0;

    for (const q of queries) {
      const variants = expandQuery(q);

      // Per-domain Apify scrapes in parallel.
      const perDomain = await Promise.all(
        domains.map(async (domain) => {
          const t1 = Date.now();
          const { items, failed } = await apifyScrapeDomain(domain, variants, limitPerDomain);
          // Refine items with weak metadata via Firecrawl (cap at 6/domain to stay in budget).
          const weak = items.filter((it) => !it.name || !it.image || !it.price).slice(0, 6);
          const refinedWeak = await Promise.all(weak.map((it) => firecrawlRefine(it)));
          const refinedMap = new Map(refinedWeak.map((it) => [it.url, it]));
          const finalItems = items.map((it) => refinedMap.get(it.url) ?? it);

          const normalized = normalize(finalItems, domain);
          const deduped = dedupeAcrossDomains(normalized);
          const inserted = await upsertCache(deduped, q);
          totalInserted += inserted;

          const result = {
            query: q,
            sourceDomain: domain,
            domain,
            fetched_count: items.length,
            refined_count: refinedWeak.length,
            normalized_count: normalized.length,
            deduped_count: normalized.length - deduped.length,
            inserted_count: inserted,
            failed_count: failed ? 1 : 0,
            duration_ms: Date.now() - t1,
          };
          await logDiagnostic("discover_apify_domain", failed ? "error" : "success", result, result.duration_ms);
          return result;
        }),
      );

      allResults.push({ query: q, variants: variants.length, perDomain });
      console.log("[discover-search-engine]", {
        query: q,
        variants: variants.length,
        perDomain: perDomain.map((r) => ({ d: r.domain, f: r.fetched_count, i: r.inserted_count })),
      });
    }

    const elapsed = Date.now() - t0;
    await logDiagnostic("discover_search_engine_run", "success", {
      queries, totalInserted, results: allResults,
    }, elapsed);

    // Flatten per-domain results so the client shim sees a uniform list.
    const flatResults = allResults.flatMap((r) => (r.perDomain as unknown[]) ?? []);
    return new Response(
      JSON.stringify({ ok: true, totalInserted, results: flatResults, elapsed_ms: elapsed }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[discover-search-engine] fatal", (e as Error).message);
    await logDiagnostic("discover_search_engine_run", "error", { error: (e as Error).message }, Date.now() - t0);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
