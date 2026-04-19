// discover-search-engine (ASYNC)
// ------------------------------
// APIFY-FIRST Korean commerce discovery — async kick-off.
//
//   query → expandQuery → for each domain:
//     POST /v2/acts/.../runs?token=...&webhooks=<base64(apify-webhook)>
//   persist runId in source_ingestion_runs(status='running')
//   return immediately with runIds
//
// Apify finishes → calls our `apify-webhook` function → that function
// fetches dataset items, refines via Firecrawl, normalizes, dedupes,
// and upserts to product_cache.
//
// This guarantees we never hit the 60s edge-function timeout.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APIFY_TOKEN = Deno.env.get("APIFY_TOKEN");
const APIFY_WEB_SCRAPER =
  Deno.env.get("APIFY_WEB_SCRAPER_ACTOR") || "apify~web-scraper";
// Puppeteer scraper renders JS — required for SPA-heavy Korean commerce
// (musinsa, 29cm, wconcept, ssg). Falls back to web-scraper for static sites.
const APIFY_PUPPETEER_SCRAPER =
  Deno.env.get("APIFY_PUPPETEER_SCRAPER_ACTOR") || "apify~puppeteer-scraper";

const VARIANTS_PER_RUN = 6;
const DEFAULT_LIMIT_PER_DOMAIN = 30;

// ── SOURCE LOCK ────────────────────────────────────────────────────────────
// Lock discovery to the four KR commerce sites by default.
// Override via ENABLED_DOMAINS env var, e.g.
//   ENABLED_DOMAINS="musinsa.com,29cm.co.kr,wconcept.co.kr,ssg.com,yoox.com"
const KR_PRIMARY = ["musinsa.com", "29cm.co.kr", "wconcept.co.kr", "ssg.com"];
const ENABLED_DOMAINS = new Set(
  (Deno.env.get("ENABLED_DOMAINS") || KR_PRIMARY.join(","))
    .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
);
function domainEnabled(d: string): boolean {
  return ENABLED_DOMAINS.has(d.toLowerCase());
}
const DEFAULT_DOMAINS = Array.from(ENABLED_DOMAINS);

// Domains that need real Chromium rendering (SPA hydration + anti-bot).
const SPA_DOMAINS = new Set(["musinsa.com", "29cm.co.kr", "wconcept.co.kr", "ssg.com"]);
function actorForDomain(domain: string): string {
  return SPA_DOMAINS.has(domain) ? APIFY_PUPPETEER_SCRAPER : APIFY_WEB_SCRAPER;
}

// Webhook URL Apify will call when each run finishes.
const WEBHOOK_URL = `${SUPABASE_URL}/functions/v1/apify-webhook`;

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
    if (!seen.has(k)) { seen.add(k); out.push(v); }
  }
  return out.slice(0, VARIANTS_PER_RUN);
}

// ── Per-domain start URLs ───────────────────────────────────────────────────
function buildStartUrls(domain: string, variants: string[], limit: number): string[] {
  const urls: string[] = [];
  for (const v of variants) {
    const q = encodeURIComponent(v);
    switch (domain) {
      case "musinsa.com":
        urls.push(`https://www.musinsa.com/search/musinsa/integration?q=${q}`); break;
      case "29cm.co.kr":
        urls.push(`https://search.29cm.co.kr/search/index?keyword=${q}`); break;
      case "wconcept.co.kr":
        urls.push(`https://www.wconcept.co.kr/Search?kwd=${q}`); break;
      case "ssg.com":
        urls.push(`https://www.ssg.com/search.ssg?target=all&query=${q}`); break;
      case "yoox.com":
        urls.push(`https://www.yoox.com/us/shoponline?textsearch=${q}`); break;
      case "asos.com":
        urls.push(`https://www.asos.com/search/?q=${q}`); break;
      case "oakandfort.com":
        urls.push(`https://oakandfort.com/search?q=${q}`); break;
      default:
        urls.push(`https://${domain}/search?q=${q}`);
    }
  }
  return urls.slice(0, Math.max(2, Math.ceil(limit / 5)));
}

function pageFunctionForDomain(domain: string, limit: number): string {
  const hostSuffixes: Record<string, string[]> = {
    "musinsa.com": ["musinsa.com"],
    "29cm.co.kr": ["29cm.co.kr"],
    "wconcept.co.kr": ["wconcept.co.kr"],
    "ssg.com": ["ssg.com"],
    "yoox.com": ["yoox.com"],
    "asos.com": ["asos.com"],
    "oakandfort.com": ["oakandfort.com"],
  };
  const linkPatterns: Record<string, string> = {
    "musinsa.com": "/products/\\\\d+|/app/goods/|/goods/\\\\d+",
    "29cm.co.kr": "/catalog/\\\\d+|/product/\\\\d+",
    "wconcept.co.kr": "/Product/|/product/",
    "ssg.com": "/item/itemView.ssg|/item/",
    "yoox.com": "/item|/p/",
    "asos.com": "/prd/",
    "oakandfort.com": "/products/",
  };
  const linkRe = linkPatterns[domain] || "/product|/item|/goods|/p/";
  const allowedHosts = hostSuffixes[domain] || [domain];
  return `
async function pageFunction(context) {
  const { request, enqueueRequest, log } = context;
  const $ = context.jQuery;
  if (typeof $ !== 'function') {
    return [{ url: request.url, _err: 'jquery_not_injected' }];
  }
  if (typeof context.waitFor === 'function') {
    try { await context.waitFor(3500); } catch (e) {}
  }
  const url = request.url;
  const host = (() => { try { return new URL(url).host.replace(/^www\\./, ''); } catch { return ''; } })();
  const out = [];

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

  const linkRe = new RegExp(${JSON.stringify(linkRe)});
  const allowedHosts = ${JSON.stringify(allowedHosts)};
  const seen = new Set();
  let enqueued = 0;
  $('a[href]').each((_, el) => {
    if (enqueued >= ${limit}) return false;
    let href = $(el).attr('href');
    if (!href) return;
    try {
      const abs = new URL(href, url).toString();
      const u = new URL(abs);
      const cleanHost = u.host.replace(/^www\\./, '');
      const hostOk = allowedHosts.some(function(s){ return cleanHost === s || cleanHost.endsWith('.' + s); });
      if (!hostOk) return;
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

// ── Puppeteer page function (for SPA-heavy KR domains) ─────────────────────
// Renders JS, then walks every product-URL anchor up to its enclosing tile.
// More robust than CSS selectors — KR sites use hashed Next.js class names.
function puppeteerPageFunctionForDomain(domain: string, limit: number): string {
  const linkPatterns: Record<string, string> = {
    "musinsa.com": "/products/\\\\d+|/goods/\\\\d+",
    "29cm.co.kr": "/product/\\\\d+",
    "wconcept.co.kr": "/Product/",
    "ssg.com": "/item/itemView.ssg",
  };
  const linkRe = linkPatterns[domain] || "/product|/item|/goods";
  return `
async function pageFunction(context) {
  const { page, request, log } = context;
  const linkReSrc = ${JSON.stringify(linkRe)};

  // 1. Wait for at least one product anchor to materialize.
  try {
    await page.waitForFunction(
      (src) => {
        const re = new RegExp(src);
        return Array.from(document.querySelectorAll('a[href]'))
          .some((a) => re.test(a.getAttribute('href') || ''));
      },
      { timeout: 18000 },
      linkReSrc,
    );
  } catch (e) { log.info('waitForFunction timed out — extracting anyway'); }

  // 2. Trigger lazy-load.
  try {
    await page.evaluate(async () => {
      await new Promise((resolve) => {
        let total = 0;
        const step = 800;
        const timer = setInterval(() => {
          window.scrollBy(0, step);
          total += step;
          if (total >= 6000) { clearInterval(timer); resolve(); }
        }, 250);
      });
    });
    await new Promise((r) => setTimeout(r, 1200));
  } catch (e) {}

  // 3. Walk every matching anchor up to its tile.
  const items = await page.evaluate((linkReSrc, domain, limit) => {
    const re = new RegExp(linkReSrc);
    const out = [];
    const seen = new Set();
    const anchors = Array.from(document.querySelectorAll('a[href]'));
    for (const a of anchors) {
      if (out.length >= limit) break;
      const href = a.getAttribute('href'); if (!href) continue;
      let abs;
      try { abs = new URL(href, location.href).toString(); } catch { continue; }
      let pathname;
      try { pathname = new URL(abs).pathname; } catch { continue; }
      if (!re.test(pathname)) continue;
      const key = abs.split('?')[0].split('#')[0];
      if (seen.has(key)) continue; seen.add(key);

      // Walk up looking for an ancestor that contains an <img>.
      let tile = a;
      for (let i = 0; i < 6; i++) {
        if (tile.querySelector && tile.querySelector('img')) break;
        tile = tile.parentElement || tile;
      }
      if (!tile || !tile.querySelector) continue;
      const img = tile.querySelector('img');
      let image = null;
      if (img) {
        image = img.getAttribute('src') || img.getAttribute('data-src') ||
                img.getAttribute('data-original') || img.getAttribute('data-lazy-src') ||
                img.getAttribute('srcset');
        if (image && image.indexOf(' ') > 0) image = image.split(' ')[0];
        if (image && image.startsWith('//')) image = 'https:' + image;
      }
      if (!image) continue;

      let name = (img && img.getAttribute('alt')) || a.textContent || '';
      name = (name || '').trim();
      if (!name) {
        const t = tile.textContent || '';
        name = t.trim().split('\\n').map(s => s.trim()).filter(Boolean)[0] || '';
      }
      if (name.length > 140) name = name.slice(0, 140);

      let brand = null;
      const brandEl = tile.querySelector('[class*="brand" i],[class*="Brand"]');
      if (brandEl) brand = (brandEl.textContent || '').trim().slice(0, 60) || null;

      let price = null;
      const tileText = tile.textContent || '';
      const m = tileText.match(/[0-9]{1,3}(,[0-9]{3})+\\s*원|[0-9]{4,}\\s*원/);
      if (m) price = m[0].replace(/[^0-9]/g, '');

      out.push({
        url: key,
        host: location.host.replace(/^www\\./, ''),
        sourceDomain: domain,
        name, brand, image, price, currency: 'KRW',
        site: domain, source: 'tile',
      });
    }
    return out;
  }, linkReSrc, ${JSON.stringify(domain)}, ${limit});

  return items;
}
`;
}

// ── Diagnostics ─────────────────────────────────────────────────────────────
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
    console.warn("[diagnostics] insert failed", (e as Error).message);
  }
}

// ── Async Apify run kick-off ────────────────────────────────────────────────
interface KickoffResult {
  domain: string;
  query: string;
  runId: string | null;
  defaultDatasetId: string | null;
  sourceRunRowId: string | null;
  status: "started" | "failed";
  error?: string;
}

async function kickoffApifyRun(
  domain: string,
  query: string,
  variants: string[],
  limit: number,
): Promise<KickoffResult> {
  const sb = createClient(SUPABASE_URL, SERVICE_KEY);

  // 1. Pre-create the source_ingestion_runs row so the webhook can find it via runId.
  const { data: runRow, error: runErr } = await sb
    .from("source_ingestion_runs")
    .insert({
      source: "apify",
      source_actor: actorForDomain(domain),
      seed_query: query,
      query_family: domain,
      trigger: "live",
      status: "running",
      metadata: { domain, variants, limit, started_via: "discover-search-engine" },
    })
    .select("id")
    .single();
  if (runErr || !runRow) {
    return { domain, query, runId: null, defaultDatasetId: null, sourceRunRowId: null, status: "failed", error: runErr?.message ?? "row_insert_failed" };
  }
  const sourceRunRowId = runRow.id as string;

  if (!APIFY_TOKEN) {
    await sb.from("source_ingestion_runs").update({
      status: "failed", completed_at: new Date().toISOString(),
      metadata: { domain, error: "APIFY_TOKEN missing" },
    }).eq("id", sourceRunRowId);
    return { domain, query, runId: null, defaultDatasetId: null, sourceRunRowId, status: "failed", error: "APIFY_TOKEN missing" };
  }

  const startUrls = buildStartUrls(domain, variants, limit).map((u) => ({ url: u }));
  if (startUrls.length === 0) {
    await sb.from("source_ingestion_runs").update({
      status: "failed", completed_at: new Date().toISOString(),
      metadata: { domain, error: "no_start_urls" },
    }).eq("id", sourceRunRowId);
    return { domain, query, runId: null, defaultDatasetId: null, sourceRunRowId, status: "failed", error: "no_start_urls" };
  }

  // 2. Build the webhook spec Apify will invoke on ACTOR.RUN.SUCCEEDED / FAILED / TIMED_OUT.
  // IMPORTANT: Apify's payloadTemplate uses {{var}} syntax that injects raw JSON values
  // (not strings). So placeholders MUST NOT be wrapped in quotes — Apify adds them
  // automatically for string-typed resources. Static fields stay as normal JSON.
  const userDataLiteral = JSON.stringify({ sourceRunRowId, query, domain });
  const payloadTemplate =
    `{` +
      `"runId":{{resource.id}},` +
      `"datasetId":{{resource.defaultDatasetId}},` +
      `"status":{{resource.status}},` +
      `"eventType":{{eventType}},` +
      `"userData":${userDataLiteral}` +
    `}`;
  const webhooks = [{
    eventTypes: ["ACTOR.RUN.SUCCEEDED", "ACTOR.RUN.FAILED", "ACTOR.RUN.TIMED_OUT", "ACTOR.RUN.ABORTED"],
    requestUrl: WEBHOOK_URL,
    payloadTemplate,
  }];
  // btoa() can't handle non-Latin1 (e.g. Korean in query). Encode UTF-8 → base64 safely.
  const webhooksJson = JSON.stringify(webhooks);
  const webhooksBytes = new TextEncoder().encode(webhooksJson);
  let bin = "";
  for (let i = 0; i < webhooksBytes.length; i++) bin += String.fromCharCode(webhooksBytes[i]);
  const webhooksB64 = btoa(bin);

  // 3. Kick the run — non-blocking POST (no run-sync).
  // Apify free tier: 8GB total memory budget. Puppeteer defaults to 4GB/run,
  // so we explicitly pin to 1024MB and limit start URLs for SPA domains.
  const useSpa = SPA_DOMAINS.has(domain);
  const actor = actorForDomain(domain);
  const memoryMb = useSpa ? 1024 : 512;
  const url = `https://api.apify.com/v2/acts/${actor}/runs?token=${APIFY_TOKEN}&memory=${memoryMb}&webhooks=${encodeURIComponent(webhooksB64)}`;
  const spaStartUrls = startUrls.slice(0, 1); // one variant per KR domain — keep memory low
  const body = useSpa
    ? {
        startUrls: spaStartUrls,
        pageFunction: puppeteerPageFunctionForDomain(domain, limit),
        maxRequestsPerCrawl: spaStartUrls.length,
        maxConcurrency: 1,
        proxyConfiguration: { useApifyProxy: true, apifyProxyGroups: ["RESIDENTIAL"], apifyProxyCountry: "KR" },
        launchContext: { useChrome: true, stealth: true },
        ignoreSslErrors: true,
        pageLoadTimeoutSecs: 45,
      }
    : {
        startUrls,
        pageFunction: pageFunctionForDomain(domain, limit),
        maxRequestsPerCrawl: limit + startUrls.length,
        maxConcurrency: 8,
        proxyConfiguration: { useApifyProxy: true },
        injectJQuery: true,
        ignoreSslErrors: true,
      };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      await sb.from("source_ingestion_runs").update({
        status: "failed", completed_at: new Date().toISOString(),
        metadata: { domain, http_status: res.status, error: text.slice(0, 500) },
      }).eq("id", sourceRunRowId);
      return { domain, query, runId: null, defaultDatasetId: null, sourceRunRowId, status: "failed", error: `apify_http_${res.status}` };
    }
    const data = await res.json().catch(() => null) as { data?: { id?: string; defaultDatasetId?: string } } | null;
    const runId = data?.data?.id ?? null;
    const defaultDatasetId = data?.data?.defaultDatasetId ?? null;
    await sb.from("source_ingestion_runs").update({
      metadata: {
        domain, variants, limit, runId, defaultDatasetId,
        started_via: "discover-search-engine",
      },
    }).eq("id", sourceRunRowId);
    return { domain, query, runId, defaultDatasetId, sourceRunRowId, status: "started" };
  } catch (e) {
    const msg = (e as Error).message;
    await sb.from("source_ingestion_runs").update({
      status: "failed", completed_at: new Date().toISOString(),
      metadata: { domain, error: msg },
    }).eq("id", sourceRunRowId);
    return { domain, query, runId: null, defaultDatasetId: null, sourceRunRowId, status: "failed", error: msg };
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
    // Source-lock: requested domains are intersected with ENABLED_DOMAINS.
    // Anything outside the lock list is dropped silently.
    const requested: string[] = Array.isArray(body?.domains) && body.domains.length > 0
      ? body.domains.filter((d: unknown): d is string => typeof d === "string")
      : DEFAULT_DOMAINS;
    const domains = requested.filter(domainEnabled);
    if (domains.length === 0) {
      return new Response(JSON.stringify({
        ok: true, async: true, locked: true,
        message: "No requested domain matches ENABLED_DOMAINS — nothing to do.",
        enabledDomains: Array.from(ENABLED_DOMAINS),
        startedCount: 0, totalCount: 0, results: [], elapsed_ms: 0,
      }), { headers: { ...cors, "Content-Type": "application/json" } });
    }
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

    const allKickoffs: KickoffResult[] = [];
    for (const q of queries) {
      const variants = expandQuery(q);
      const results = await Promise.all(
        domains.map((domain) => kickoffApifyRun(domain, q, variants, limitPerDomain)),
      );
      allKickoffs.push(...results);
    }

    const elapsed = Date.now() - t0;
    const startedCount = allKickoffs.filter((r) => r.status === "started").length;
    await logDiagnostic("discover_search_engine_kickoff", "success", {
      queries, domainsCount: domains.length,
      kickoffs: allKickoffs.map((r) => ({
        domain: r.domain, query: r.query, runId: r.runId, status: r.status, error: r.error,
      })),
      startedCount, totalCount: allKickoffs.length,
    }, elapsed);

    // Backwards-compatible response shape: client orchestrator reads `results[].inserted_count`.
    // Inserts now happen async via the webhook, so inserted_count starts at 0.
    const results = allKickoffs.map((r) => ({
      query: r.query,
      domain: r.domain,
      sourceDomain: r.domain,
      runId: r.runId,
      datasetId: r.defaultDatasetId,
      sourceRunRowId: r.sourceRunRowId,
      kickoff_status: r.status,
      fetched_count: 0,
      refined_count: 0,
      normalized_count: 0,
      deduped_count: 0,
      inserted_count: 0,
      failed_count: r.status === "failed" ? 1 : 0,
    }));

    return new Response(
      JSON.stringify({
        ok: true,
        async: true,
        message: "Apify runs started; results will be ingested via apify-webhook callback.",
        startedCount, totalCount: allKickoffs.length,
        totalInserted: 0, // legacy field — async now
        results,
        elapsed_ms: elapsed,
      }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[discover-search-engine] fatal", (e as Error).message);
    await logDiagnostic("discover_search_engine_kickoff", "error", { error: (e as Error).message }, Date.now() - t0);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
