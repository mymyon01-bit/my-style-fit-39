// apify-webhook
// -------------
// Receives Apify ACTOR.RUN.* callbacks for runs kicked off by
// `discover-search-engine`. Responsibilities:
//
//   1. Verify minimum payload shape.
//   2. Look up the matching source_ingestion_runs row.
//   3. Fetch dataset items from Apify (paged) using APIFY_TOKEN.
//   4. (Optional) refine weak items via Firecrawl.
//   5. Normalize → dedupe → upsert product_cache.
//   6. Update source_ingestion_runs with final counts + status.
//   7. Log diagnostics_events.
//
// PUBLIC: must run with verify_jwt = false (Apify can't sign Supabase JWTs).
// Idempotent: re-delivery is fine — upserts are keyed on (platform, external_id).

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

const FIRECRAWL_BUDGET_MS = 8_000;
const MAX_FIRECRAWL_REFINES = 4;

// ── Types ──────────────────────────────────────────────────────────────────
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

// ── Utils ───────────────────────────────────────────────────────────────────
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`${label}_timeout`)), ms)),
  ]);
}

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
  try { const url = new URL(u); return `${url.host}${url.pathname}`.toLowerCase(); }
  catch { return u.toLowerCase(); }
}
function normalizedTitleKey(t: string): string {
  return t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "").slice(0, 60);
}
function imageHostKey(u: string): string {
  try { const url = new URL(u); return `${url.host}${url.pathname}`.toLowerCase(); }
  catch { return u.toLowerCase(); }
}

const FASHION_RE = /\b(jacket|coat|blazer|shirt|hoodie|sweater|cardigan|vest|tee|t-shirt|polo|pants|trousers|jeans|shorts|skirt|dress|sneakers?|boots?|shoes?|loafers?|sandals?|bag|tote|backpack|hat|cap|beanie|belt|scarf|bomber|parka|pullover|sweatshirt|chinos?|joggers?|blouse|knit|denim|leather|jumpsuit|trench|gilet|leggings?|tank|outfit|outerwear|footwear|swimwear|swimsuit|bikini)\b/i;
const FASHION_KR_RE = /(자켓|재킷|코트|블레이저|셔츠|후디|스웨터|니트|가디건|티셔츠|폴로|바지|팬츠|청바지|진|반바지|스커트|치마|드레스|원피스|운동화|스니커즈|신발|부츠|로퍼|샌들|가방|백|토트|백팩|모자|벨트|봄버|파카|풀오버|맨투맨|블라우스|점퍼|패딩|아우터|수영복|비키니)/;

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

function dedupe(rows: NormalizedProduct[]): NormalizedProduct[] {
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

// ── Firecrawl refine (best-effort, capped) ──────────────────────────────────
async function firecrawlRefine(item: ExtractedProduct): Promise<ExtractedProduct> {
  if (!FIRECRAWL_KEY) return item;
  try {
    const res = await withTimeout(
      fetch("https://api.firecrawl.dev/v2/scrape", {
        method: "POST",
        headers: { Authorization: `Bearer ${FIRECRAWL_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          url: item.url,
          formats: [
            "markdown",
            { type: "json", prompt: "Extract product title, brand, price, currency, and main image URL from this product page." },
          ],
          onlyMainContent: true,
        }),
      }),
      FIRECRAWL_BUDGET_MS, "firecrawl",
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
    console.warn("[apify-webhook] firecrawl refine failed", (e as Error).message);
    return item;
  }
}

// ── Fetch Apify dataset (paged) ────────────────────────────────────────────
async function fetchDataset(datasetId: string): Promise<ExtractedProduct[]> {
  if (!APIFY_TOKEN) return [];
  const url = `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}&clean=true&format=json&limit=1000`;
  const res = await fetch(url);
  if (!res.ok) {
    console.warn(`[apify-webhook] dataset fetch HTTP ${res.status}`);
    return [];
  }
  const data = await res.json().catch(() => null);
  if (!Array.isArray(data)) return [];
  const out: ExtractedProduct[] = [];
  for (const row of data) {
    if (Array.isArray(row)) out.push(...(row as ExtractedProduct[]));
    else if (row && typeof row === "object") out.push(row as ExtractedProduct);
  }
  return out;
}

// ── Upsert ──────────────────────────────────────────────────────────────────
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
    console.warn("[apify-webhook] upsert error", error.message);
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
      event_name: event, status, duration_ms: durationMs ?? null, metadata,
    });
  } catch (e) {
    console.warn("[apify-webhook] diagnostics insert failed", (e as Error).message);
  }
}

// ── Handler ─────────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const t0 = Date.now();
  let payload: any = null;
  try { payload = await req.json(); }
  catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const runId: string | null = payload?.runId ?? null;
  const datasetId: string | null = payload?.datasetId ?? null;
  const apifyStatus: string | null = payload?.status ?? null;
  const eventType: string | null = payload?.eventType ?? null;
  const userData = payload?.userData ?? {};
  const sourceRunRowId: string | null = userData?.sourceRunRowId ?? null;
  const query: string = String(userData?.query ?? "").trim();
  const domain: string = String(userData?.domain ?? "").trim();

  console.log("[apify-webhook] received", { runId, datasetId, apifyStatus, eventType, sourceRunRowId, domain });

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);

  // Failure / abort path — just mark the run row.
  if (apifyStatus && apifyStatus !== "SUCCEEDED") {
    if (sourceRunRowId) {
      await sb.from("source_ingestion_runs").update({
        status: "failed",
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - t0,
        metadata: { domain, query, runId, datasetId, apifyStatus, eventType },
      }).eq("id", sourceRunRowId);
    }
    await logDiagnostic("apify_webhook_failed", "error", { runId, apifyStatus, eventType, domain, query }, Date.now() - t0);
    return new Response(JSON.stringify({ ok: true, ignored: true, reason: apifyStatus }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  if (!datasetId) {
    return new Response(JSON.stringify({ error: "missing_datasetId" }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // Success path — fetch + ingest.
  try {
    const items = await fetchDataset(datasetId);
    const fetched = items.length;

    // Refine a small number of weak items (no name / image / price).
    const weak = items.filter((it) => !it.name || !it.image || !it.price).slice(0, MAX_FIRECRAWL_REFINES);
    const refinedWeak = await Promise.all(weak.map((it) => firecrawlRefine(it)));
    const refinedMap = new Map(refinedWeak.map((it) => [it.url, it]));
    const finalItems = items.map((it) => refinedMap.get(it.url) ?? it);

    const normalized = normalize(finalItems, domain || "unknown");
    const deduped = dedupe(normalized);
    const inserted = await upsertCache(deduped, query || domain || "discover");

    if (sourceRunRowId) {
      await sb.from("source_ingestion_runs").update({
        status: inserted > 0 ? "success" : "partial",
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - t0,
        fetched_count: fetched,
        inserted_count: inserted,
        deduped_count: normalized.length - deduped.length,
        failed_count: 0,
        metadata: {
          domain, query, runId, datasetId, apifyStatus, eventType,
          refined_count: refinedWeak.length,
          normalized_count: normalized.length,
        },
      }).eq("id", sourceRunRowId);
    }

    await logDiagnostic("apify_webhook_ingest", inserted > 0 ? "success" : "partial", {
      runId, datasetId, domain, query, fetched, normalized: normalized.length, deduped: deduped.length, inserted,
    }, Date.now() - t0);

    return new Response(JSON.stringify({
      ok: true, runId, datasetId, fetched, normalized: normalized.length, inserted,
    }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    const msg = (e as Error).message;
    console.error("[apify-webhook] fatal", msg);
    if (sourceRunRowId) {
      await sb.from("source_ingestion_runs").update({
        status: "failed", completed_at: new Date().toISOString(),
        duration_ms: Date.now() - t0,
        metadata: { domain, query, runId, datasetId, error: msg },
      }).eq("id", sourceRunRowId);
    }
    await logDiagnostic("apify_webhook_ingest", "error", { runId, datasetId, domain, query, error: msg }, Date.now() - t0);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
