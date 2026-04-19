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

// ── SOURCE LOCK ────────────────────────────────────────────────────────────
// Comma-separated list of allowed source labels. Defaults to KR-only.
// To re-enable a source, set ENABLED_SOURCES env var, e.g.
//   ENABLED_SOURCES="apify_musinsa,apify_29cm,apify_wconcept,apify_ssg"
// Anything not in this set is short-circuited to [] and never costs an actor call.
const DEFAULT_ENABLED = "apify_musinsa,apify_29cm,apify_wconcept,apify_ssg";
const ENABLED_SOURCES = new Set(
  (Deno.env.get("ENABLED_SOURCES") || DEFAULT_ENABLED)
    .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
);
function sourceEnabled(label: string): boolean {
  return ENABLED_SOURCES.has(label.toLowerCase());
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
    // Source-lock: short-circuit any source not in ENABLED_SOURCES so we
    // don't waste actor budget or Crawlbase credits on disabled platforms.
    const skip = async () => [] as RawProduct[];
    const settled = await Promise.allSettled([
      sourceEnabled("apify_asos") ? fetchApifyAsos(query, cap.asos) : skip(),
      sourceEnabled("apify_zalando") ? fetchApifyZalando(query, cap.zalando) : skip(),
      sourceEnabled("apify_coupang") ? fetchApifyCoupang(query, cap.coupang) : skip(),
      sourceEnabled("apify_gshopping") ? fetchApifyGoogleShopping(query, cap.gshopping) : skip(),
      sourceEnabled("crawlbase_farfetch") ? fetchCrawlbaseFarfetch(query) : skip(),
    ]);

    const labels = ["apify_asos", "apify_zalando", "apify_coupang", "apify_gshopping", "crawlbase_farfetch"];
    const perSource: Record<string, number> = {};
    const merged: RawProduct[] = [];
    settled.forEach((r, i) => {
      const items = r.status === "fulfilled" ? r.value : [];
      perSource[labels[i]] = items.length;
      merged.push(...items);
    });

    const deduped = dedupe(merged);
    const shuffled = shuffle(deduped);
    const inserted = await upsertCache(shuffled, query);

    const result = {
      query,
      intensity,
      sources: perSource,
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
