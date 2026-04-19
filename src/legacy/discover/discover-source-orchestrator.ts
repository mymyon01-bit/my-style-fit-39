/**
 * Discover source orchestrator
 * ----------------------------
 * Client-side coordinator that decides WHICH sources to call, in what
 * concurrency, and with which budget — for a given Discover request.
 *
 * Source roles (mirrors product spec):
 *   • Apify          → bulk inventory growth. Heavy in cron, capped+light in live.
 *   • Firecrawl      → page extraction & unknown-domain fallback (used by edge).
 *   • Domain-scoped  → site:asos.com / site:farfetch.com / site:naver.com … via
 *                      search-discovery's Perplexity expand + Firecrawl scrape.
 *
 * Two execution profiles:
 *
 *   profile = "live"  (user typed a query)
 *     - DB-first render is owned by useDiscoverSearch — orchestrator never blocks it.
 *     - Fires lighter calls in parallel, each with a hard timeout.
 *     - Korean sources go in a fast-skip lane (≤ 6s budget).
 *     - Apify capped (single fast actor, low maxItems).
 *
 *   profile = "cron" (background growth)
 *     - Apify-heavy (multiple actors) with rotating seeds & per-source quotas.
 *     - Domain-scoped expansion across the western+korean rotation.
 *     - No UI deadline — caller sets the overall budget.
 *
 * The orchestrator does NOT render anything. It returns a structured run
 * report plus the live products it managed to surface (already normalized).
 *
 * Domain extraction memory:
 *   On unknown source domains it asks search-discovery (which already reads
 *   extraction_domain_cache server-side) — orchestrator just biases its pick.
 */

import { supabase } from "@/integrations/supabase/client";
import {
  isKoreanSource,
  sourceFromUrl,
  type SourceKey,
} from "@/lib/search/sources";
import {
  normalizeDiscoverProducts,
  type NormalizeContext,
} from "@/lib/discover/discover-product-normalizer";
import type { DiscoverProduct } from "@/lib/discover/discover-types";
import { logDiscoverEvent } from "@/lib/discover/discover-diagnostics";

// ---------- types ----------------------------------------------------------

export type SourceRole = "apify" | "firecrawl" | "domain_scoped";

export type DiscoverProfile = "live" | "cron";

export interface SourceCallReport {
  role: SourceRole;
  edgeFunction: string;
  /** SourceKey domain when role=domain_scoped, else null. */
  scopedSource: SourceKey | null;
  status: "fulfilled" | "skipped" | "timeout" | "error";
  durationMs: number;
  productCount: number;
  errorMessage?: string;
}

export interface OrchestratorRunReport {
  profile: DiscoverProfile;
  query: string;
  totalDurationMs: number;
  calls: SourceCallReport[];
  productsBySource: Record<string, number>;
  uniqueProducts: number;
}

export interface OrchestrateLiveOptions {
  /** AbortSignal — orchestrator stops scheduling new calls once aborted. */
  signal?: AbortSignal;
  /** Total wall-clock budget across all calls (ms). Default 12_000. */
  totalBudgetMs?: number;
  /** Per-call timeout (ms). Default 6_000 for live. */
  perCallTimeoutMs?: number;
  /** Korean fast-skip budget (ms). Default 6_000. */
  koreanBudgetMs?: number;
  /** Cap of items the orchestrator returns to the caller. */
  maxProducts?: number;
  /** Override which domain-scoped sources to try. */
  domainSources?: SourceKey[];
  /** Skip Apify in the live profile entirely (e.g. for cheap re-fetches). */
  skipApify?: boolean;
  /** Forwarded to the normalizer so products carry the right query family. */
  queryFamily?: string;
}

export interface OrchestrateLiveResult {
  products: DiscoverProduct[];
  report: OrchestratorRunReport;
}

// ---------- defaults -------------------------------------------------------

/** Default rotation for live searches. Korean first (KR launch priority),
 *  then a small western set to keep latency low. Cron uses a wider list. */
const LIVE_DOMAIN_ROTATION: SourceKey[] = [
  "naver",
  "coupang",
  "musinsa",
  "asos",
  "farfetch",
  "zalando",
];

const CRON_DOMAIN_ROTATION: SourceKey[] = [
  "naver", "coupang", "musinsa", "kream", "29cm", "wconcept",
  "asos", "farfetch", "yoox", "zalando", "ssense",
];

// Default per-source caps in the visible window (mirrors enforceSourceQuota's
// 30% cap). The orchestrator itself doesn't enforce these — it just hints
// max counts to Apify so we don't over-fetch from one domain.
const APIFY_LIVE_MAX_ITEMS = 16;
const APIFY_CRON_MAX_ITEMS = 80;

// ---------- helpers --------------------------------------------------------

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout:${label}:${ms}ms`)), ms);
    p.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

function isAborted(signal?: AbortSignal): boolean {
  return !!signal && signal.aborted;
}

/** Best-effort hostname from a product_cache row OR an already-normalized product. */
function hostnameOf(p: { source_url?: string | null; productUrl?: string }): string | null {
  const url = p.productUrl || p.source_url || "";
  if (!url) return null;
  try { return new URL(url).hostname.toLowerCase(); } catch { return null; }
}

/** Map raw rows from edge functions → DiscoverProduct array. */
function normalizeBatch(
  raws: unknown[] | null | undefined,
  ctx: NormalizeContext,
): DiscoverProduct[] {
  if (!Array.isArray(raws) || raws.length === 0) return [];
  return normalizeDiscoverProducts(raws, ctx);
}

// ---------- source callers -------------------------------------------------

interface SourceCallContext {
  query: string;
  profile: DiscoverProfile;
  perCallTimeoutMs: number;
  signal?: AbortSignal;
  normalizeCtx: NormalizeContext;
}

/** Fire Apify-driven multi-source-scraper. */
async function callApify(ctx: SourceCallContext, maxItems: number): Promise<{
  products: DiscoverProduct[]; report: SourceCallReport;
}> {
  const t0 = performance.now();
  const report: SourceCallReport = {
    role: "apify",
    edgeFunction: "multi-source-scraper",
    scopedSource: null,
    status: "fulfilled",
    durationMs: 0,
    productCount: 0,
  };

  if (isAborted(ctx.signal)) {
    return { products: [], report: { ...report, status: "skipped", durationMs: 0 } };
  }

  try {
    const res = await withTimeout(
      supabase.functions.invoke("multi-source-scraper", {
        body: { query: ctx.query, maxItems, profile: ctx.profile },
      }),
      ctx.perCallTimeoutMs,
      "apify",
    );
    if (res.error) throw new Error(res.error.message || "apify error");
    const rows = (res.data && (res.data.products || res.data.items)) || [];
    const products = normalizeBatch(rows, ctx.normalizeCtx);
    return {
      products,
      report: { ...report, durationMs: Math.round(performance.now() - t0), productCount: products.length },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      products: [],
      report: {
        ...report,
        status: msg.startsWith("timeout:") ? "timeout" : "error",
        durationMs: Math.round(performance.now() - t0),
        errorMessage: msg,
      },
    };
  }
}

/** Fire domain-scoped discovery via search-discovery (Perplexity expand +
 *  Firecrawl scrape). The edge function already consults extraction_domain_cache
 *  so an unknown host falls back to Firecrawl automatically. */
async function callDomainScoped(
  ctx: SourceCallContext,
  source: SourceKey,
  hardBudgetMs: number,
): Promise<{ products: DiscoverProduct[]; report: SourceCallReport }> {
  const t0 = performance.now();
  const report: SourceCallReport = {
    role: "domain_scoped",
    edgeFunction: "search-discovery",
    scopedSource: source,
    status: "fulfilled",
    durationMs: 0,
    productCount: 0,
  };

  if (isAborted(ctx.signal)) {
    return { products: [], report: { ...report, status: "skipped", durationMs: 0 } };
  }

  try {
    const res = await withTimeout(
      supabase.functions.invoke("search-discovery", {
        body: {
          query: ctx.query,
          siteScope: source,
          maxQueries: ctx.profile === "live" ? 4 : 10,
          maxCandidates: ctx.profile === "live" ? 12 : 40,
        },
      }),
      hardBudgetMs,
      `domain:${source}`,
    );
    if (res.error) throw new Error(res.error.message || "discovery error");
    const rows = (res.data && (res.data.products || res.data.items)) || [];
    const products = normalizeBatch(rows, ctx.normalizeCtx);
    return {
      products,
      report: { ...report, durationMs: Math.round(performance.now() - t0), productCount: products.length },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      products: [],
      report: {
        ...report,
        status: msg.startsWith("timeout:") ? "timeout" : "error",
        durationMs: Math.round(performance.now() - t0),
        errorMessage: msg,
      },
    };
  }
}

// ---------- public API -----------------------------------------------------

/**
 * Run the LIVE profile: fast, capped, non-blocking.
 *
 * Strategy:
 *   1. Light Apify call (single combined invocation, low maxItems) — unless skipped.
 *   2. Domain-scoped discovery for the configured rotation — Korean lane gets
 *      a tighter budget and is allowed to skip on timeout without affecting
 *      the western lane.
 *   3. All calls race against `totalBudgetMs`. Whatever resolves before the
 *      deadline is normalized, deduped by URL, and returned.
 *
 * Caller (useDiscoverSearch / live injector) appends these to the visible
 * grid via discover-fresh-injector — orchestrator never touches the DOM.
 */
export async function orchestrateLive(
  query: string,
  opts: OrchestrateLiveOptions = {},
): Promise<OrchestrateLiveResult> {
  const t0 = performance.now();
  const totalBudgetMs = opts.totalBudgetMs ?? 12_000;
  const perCallTimeoutMs = opts.perCallTimeoutMs ?? 6_000;
  const koreanBudgetMs = opts.koreanBudgetMs ?? 6_000;
  const maxProducts = opts.maxProducts ?? 60;
  const domainSources = opts.domainSources ?? LIVE_DOMAIN_ROTATION;

  const normalizeCtx: NormalizeContext = {
    originalQuery: query,
    queryFamily: opts.queryFamily ?? query,
  };

  const callCtx: SourceCallContext = {
    query,
    profile: "live",
    perCallTimeoutMs,
    signal: opts.signal,
    normalizeCtx,
  };

  // Compose the parallel batch.
  const tasks: Array<Promise<{ products: DiscoverProduct[]; report: SourceCallReport }>> = [];
  if (!opts.skipApify) tasks.push(callApify(callCtx, APIFY_LIVE_MAX_ITEMS));
  for (const src of domainSources) {
    const budget = isKoreanSource(src) ? koreanBudgetMs : perCallTimeoutMs;
    tasks.push(callDomainScoped(callCtx, src, budget));
  }

  // Race the entire batch against the global budget.
  let settled: Array<{ products: DiscoverProduct[]; report: SourceCallReport }> = [];
  try {
    settled = await withTimeout(Promise.allSettled(tasks).then((arr) =>
      arr.map((r) => r.status === "fulfilled" ? r.value : {
        products: [] as DiscoverProduct[],
        report: {
          role: "domain_scoped" as SourceRole,
          edgeFunction: "search-discovery",
          scopedSource: null,
          status: "error" as const,
          durationMs: 0,
          productCount: 0,
          errorMessage: r.reason instanceof Error ? r.reason.message : String(r.reason),
        },
      }),
    ), totalBudgetMs, "orchestrate-live");
  } catch (err) {
    // global timeout — collect whatever has finished by polling Promise.race
    // with already-settled signals isn't possible here, so we simply accept
    // partial results: the per-call timeouts mean nothing is leaking.
    console.warn("[discover-orchestrator] live global timeout", err);
  }

  // Dedupe by productUrl (orchestrator-level safety; the discover-dedupe
  // module will run a stricter fingerprint pass downstream).
  const seenUrls = new Set<string>();
  const products: DiscoverProduct[] = [];
  const productsBySource: Record<string, number> = {};

  for (const { products: batch, report } of settled) {
    for (const p of batch) {
      const key = p.productUrl;
      if (!key || seenUrls.has(key)) continue;
      seenUrls.add(key);
      products.push(p);
      const src = p.source || sourceFromUrl(p.productUrl);
      productsBySource[src] = (productsBySource[src] ?? 0) + 1;
      if (products.length >= maxProducts) break;
    }
    if (products.length >= maxProducts) break;
  }

  const report: OrchestratorRunReport = {
    profile: "live",
    query,
    totalDurationMs: Math.round(performance.now() - t0),
    calls: settled.map((s) => s.report),
    productsBySource,
    uniqueProducts: products.length,
  };

  // Diagnostics — fire-and-forget.
  logDiscoverEvent("discover_orchestrator_live", {
    query,
    status: products.length > 0 ? "success" : "partial",
    durationMs: report.totalDurationMs,
    metadata: {
      profile: "live",
      unique_products: products.length,
      products_by_source: productsBySource,
      calls: report.calls.map((c) => ({
        role: c.role,
        scoped: c.scopedSource,
        status: c.status,
        ms: c.durationMs,
        n: c.productCount,
      })),
    },
  });

  return { products, report };
}

// ---------- cron profile (delegated, optional) -----------------------------

export interface OrchestrateCronOptions {
  /** Heavier total budget — defaults 90s. */
  totalBudgetMs?: number;
  /** Per-call timeout — defaults 30s. */
  perCallTimeoutMs?: number;
  /** Override rotation; defaults to CRON_DOMAIN_ROTATION. */
  domainSources?: SourceKey[];
  /** Apify maxItems per actor. */
  apifyMaxItems?: number;
}

/**
 * Run the CRON profile: Apify-heavy, broad domain rotation.
 *
 * This is intended to be called from a scheduled context (background hook,
 * admin tool, or future edge cron). It fires Apify with a high cap and runs
 * domain-scoped discovery across the full rotation. It returns a structured
 * report so the caller can persist run statistics.
 */
export async function orchestrateCron(
  query: string,
  opts: OrchestrateCronOptions = {},
): Promise<OrchestratorRunReport> {
  const t0 = performance.now();
  const totalBudgetMs = opts.totalBudgetMs ?? 90_000;
  const perCallTimeoutMs = opts.perCallTimeoutMs ?? 30_000;
  const domainSources = opts.domainSources ?? CRON_DOMAIN_ROTATION;
  const apifyMaxItems = opts.apifyMaxItems ?? APIFY_CRON_MAX_ITEMS;

  const normalizeCtx: NormalizeContext = { originalQuery: query, queryFamily: query };
  const callCtx: SourceCallContext = {
    query, profile: "cron", perCallTimeoutMs, normalizeCtx,
  };

  const tasks: Array<Promise<{ products: DiscoverProduct[]; report: SourceCallReport }>> = [
    callApify(callCtx, apifyMaxItems),
    ...domainSources.map((src) => callDomainScoped(callCtx, src, perCallTimeoutMs)),
  ];

  const settled = await withTimeout(
    Promise.allSettled(tasks).then((arr) =>
      arr.map((r) => r.status === "fulfilled" ? r.value : {
        products: [] as DiscoverProduct[],
        report: {
          role: "apify" as SourceRole,
          edgeFunction: "multi-source-scraper",
          scopedSource: null,
          status: "error" as const,
          durationMs: 0,
          productCount: 0,
          errorMessage: r.reason instanceof Error ? r.reason.message : String(r.reason),
        },
      }),
    ),
    totalBudgetMs,
    "orchestrate-cron",
  ).catch((err) => {
    console.warn("[discover-orchestrator] cron global timeout", err);
    return [] as Array<{ products: DiscoverProduct[]; report: SourceCallReport }>;
  });

  const productsBySource: Record<string, number> = {};
  let unique = 0;
  const seenUrls = new Set<string>();
  for (const { products } of settled) {
    for (const p of products) {
      if (seenUrls.has(p.productUrl)) continue;
      seenUrls.add(p.productUrl);
      unique++;
      const src = p.source || sourceFromUrl(p.productUrl);
      productsBySource[src] = (productsBySource[src] ?? 0) + 1;
    }
  }

  const report: OrchestratorRunReport = {
    profile: "cron",
    query,
    totalDurationMs: Math.round(performance.now() - t0),
    calls: settled.map((s) => s.report),
    productsBySource,
    uniqueProducts: unique,
  };

  logDiscoverEvent("discover_orchestrator_cron", {
    query,
    status: unique > 0 ? "success" : "partial",
    durationMs: report.totalDurationMs,
    metadata: {
      profile: "cron",
      unique_products: unique,
      products_by_source: productsBySource,
    },
  });

  return report;
}

// ---------- exports for tests ---------------------------------------------

export const __internal = { hostnameOf, withTimeout, LIVE_DOMAIN_ROTATION, CRON_DOMAIN_ROTATION };
