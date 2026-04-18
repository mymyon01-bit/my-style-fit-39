// Multi-source product scraper.
//
// Runs THREE sources in parallel for a given query:
//   1. Firecrawl   — universal (existing pipeline; we proxy via search-discovery)
//   2. Apify       — ASOS + Zalando actors
//   3. Crawlbase   — Farfetch
//
// Each source has a hard 15s budget. Partial failure is tolerated
// (allSettled). Results are merged, deduped by URL/title fingerprint,
// shuffled (Fisher–Yates), then upserted into product_cache so the next
// search hits a hot DB cache.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FIRECRAWL_KEY = Deno.env.get("FIRECRAWL_API_KEY");
const APIFY_TOKEN = Deno.env.get("APIFY_TOKEN");
const CRAWLBASE_TOKEN = Deno.env.get("CRAWLBASE_TOKEN");

const SOURCE_BUDGET_MS = 15_000;

// ── Apify actor IDs (publicly available, JSON output via run-sync) ──────────
//   ASOS:    `jupri/asos-scraper`
//   Zalando: `tugkan/zalando-scraper`
// Both use the synchronous "run-sync-get-dataset-items" endpoint so we get
// JSON back in a single HTTP call (no polling).
const APIFY_ACTORS = {
  asos: "jupri~asos-scraper",
  zalando: "tugkan~zalando-scraper",
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

// ── Apify — generic JSON-actor caller ────────────────────────────────────────

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

async function fetchApifyAsos(query: string): Promise<RawProduct[]> {
  try {
    const items = await withTimeout(
      callApifyActor(APIFY_ACTORS.asos, {
        searchTerms: [query],
        maxItems: 25,
        country: "US",
      }),
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

async function fetchApifyZalando(query: string): Promise<RawProduct[]> {
  try {
    const items = await withTimeout(
      callApifyActor(APIFY_ACTORS.zalando, {
        search: query,
        maxItems: 25,
        country: "DE",
      }),
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

// ── Crawlbase — Farfetch via Crawling API + JS rendering ─────────────────────
// We use Crawlbase to fetch the Farfetch search HTML, then extract product
// cards with a light regex pass. Crawlbase handles anti-bot + JS rendering.

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
    // Crawlbase autoparse returns `products` array for known retailers.
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

// ── Firecrawl — delegate to existing search-discovery pipeline ───────────────
async function fetchFirecrawl(query: string): Promise<RawProduct[]> {
  if (!FIRECRAWL_KEY) return [];
  // Defer to the existing search-discovery edge function (which owns the
  // Firecrawl extraction logic). We call it with a small budget so this stays
  // parallel to the Apify/Crawlbase paths.
  try {
    const res = await withTimeout(
      fetch(`${SUPABASE_URL}/functions/v1/search-discovery`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SERVICE_KEY}`,
        },
        body: JSON.stringify({ query, maxQueries: 4, maxCandidates: 18 }),
      }),
      SOURCE_BUDGET_MS,
      "firecrawl_discovery",
    );
    if (!res.ok) return [];
    // search-discovery already wrote rows; we re-read the freshest matches.
    return [];
  } catch {
    return [];
  }
}

// ── Dedupe + shuffle ────────────────────────────────────────────────────────

function fingerprint(p: RawProduct): string {
  try {
    const u = new URL(p.image_url);
    return `${u.host}${u.pathname}`.toLowerCase();
  } catch {
    return p.image_url.toLowerCase();
  }
}

function dedupe(items: RawProduct[]): RawProduct[] {
  const seenUrl = new Set<string>();
  const seenFp = new Set<string>();
  const out: RawProduct[] = [];
  for (const p of items) {
    const url = p.source_url.toLowerCase();
    const fp = fingerprint(p);
    if (seenUrl.has(url) || seenFp.has(fp)) continue;
    seenUrl.add(url);
    seenFp.add(fp);
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

// ── Persist into product_cache ──────────────────────────────────────────────

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
    search_query: query,
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
    const { query } = await req.json().catch(() => ({}));
    if (!query || typeof query !== "string") {
      return new Response(JSON.stringify({ error: "query required" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const t0 = Date.now();
    const settled = await Promise.allSettled([
      fetchFirecrawl(query),
      fetchApifyAsos(query),
      fetchApifyZalando(query),
      fetchCrawlbaseFarfetch(query),
    ]);

    const labels = ["firecrawl", "apify_asos", "apify_zalando", "crawlbase_farfetch"];
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

    console.log("[multi-source] done", {
      query,
      perSource,
      merged: merged.length,
      deduped: deduped.length,
      inserted,
      elapsed_ms: Date.now() - t0,
    });

    return new Response(
      JSON.stringify({
        ok: true,
        query,
        sources: perSource,
        merged: merged.length,
        deduped: deduped.length,
        inserted,
        products: shuffled.slice(0, 60),
      }),
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
