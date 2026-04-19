// Inventory Builder — scheduled supply expansion engine.
//
// Each tick processes SEEDS_PER_TICK seeds in parallel. For each seed it runs
// BOTH search-discovery (Firecrawl/Perplexity, long-tail domains) AND
// multi-source-scraper in cron-intensity mode (Apify bulk). Per-run telemetry
// is written to source_ingestion_runs + diagnostics_events so AdminDiagnostics
// can prove inventory is actually growing.
//
// Triggered by pg_cron every 4 hours.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Expanded taxonomy — 100+ seeds across category, brand, style/occasion,
// Korean, and seasonal/weather families. The cron picks ONE seed from each
// family per tick (see SEED_GROUPS below) so DB growth is always diversified
// and the spec/brand/KR queries get cold-cache coverage.
const SEEDS: { q: string; family: string }[] = [
  // ===== category =====
  { q: "bags", family: "category" },
  { q: "crossbody bag", family: "category" },
  { q: "tote bag", family: "category" },
  { q: "shoulder bag", family: "category" },
  { q: "backpack", family: "category" },
  { q: "mini bag", family: "category" },
  { q: "leather bag", family: "category" },
  { q: "jackets", family: "category" },
  { q: "leather jacket", family: "category" },
  { q: "denim jacket", family: "category" },
  { q: "bomber jacket", family: "category" },
  { q: "trench coat", family: "category" },
  { q: "puffer jacket", family: "category" },
  { q: "wool coat", family: "category" },
  { q: "coats", family: "category" },
  { q: "sneakers", family: "category" },
  { q: "white sneakers", family: "category" },
  { q: "running shoes", family: "category" },
  { q: "loafers", family: "category" },
  { q: "boots", family: "category" },
  { q: "knitwear", family: "category" },
  { q: "trousers", family: "category" },
  { q: "shirts", family: "category" },
  { q: "graphic tee", family: "category" },
  { q: "cargo pants", family: "category" },
  // ===== brand =====
  { q: "Gucci loafers", family: "brand" },
  { q: "Gucci bag", family: "brand" },
  { q: "Nike sneakers", family: "brand" },
  { q: "Adidas sneakers", family: "brand" },
  { q: "New Balance sneakers", family: "brand" },
  { q: "Zara jacket", family: "brand" },
  { q: "COS knit", family: "brand" },
  { q: "Uniqlo coat", family: "brand" },
  { q: "Prada bag", family: "brand" },
  { q: "Loewe bag", family: "brand" },
  { q: "Bottega bag", family: "brand" },
  { q: "Acne Studios jacket", family: "brand" },
  // ===== style / occasion =====
  { q: "formal look", family: "style" },
  { q: "business casual", family: "style" },
  { q: "date night outfit", family: "style" },
  { q: "minimal outfit", family: "style" },
  { q: "streetwear outfit", family: "style" },
  { q: "oversized jacket", family: "style" },
  { q: "wedding guest look", family: "style" },
  { q: "office wear", family: "style" },
  { q: "techwear", family: "style" },
  { q: "old money outfit", family: "style" },
  { q: "y2k outfit", family: "style" },
  { q: "monochrome outfit", family: "style" },
  // ===== korean =====
  { q: "가방", family: "korean" },
  { q: "자켓", family: "korean" },
  { q: "스니커즈", family: "korean" },
  { q: "코트", family: "korean" },
  { q: "코트 코디", family: "korean" },
  { q: "미니멀 룩", family: "korean" },
  { q: "데이트룩", family: "korean" },
  { q: "출근룩", family: "korean" },
  { q: "여름 코디", family: "korean" },
  { q: "겨울 코디", family: "korean" },
  { q: "korean street style", family: "korean" },
  { q: "korean fashion bag", family: "korean" },
  // ===== seasonal / weather =====
  { q: "summer outfit", family: "seasonal" },
  { q: "winter outfit", family: "seasonal" },
  { q: "fall outfit", family: "seasonal" },
  { q: "spring outfit", family: "seasonal" },
  { q: "rainy outerwear", family: "seasonal" },
  { q: "snow outfit", family: "seasonal" },
  { q: "beach outfit", family: "seasonal" },
  { q: "holiday outfit", family: "seasonal" },
];

// Diversified rotation — every cron tick pulls one seed from each family.
const SEED_FAMILIES = ["brand", "style", "korean", "category", "seasonal"] as const;
const SEEDS_PER_TICK = SEED_FAMILIES.length;

function pickDiversifiedSeeds(cursorIdx: number): { q: string; family: string }[] {
  const out: { q: string; family: string }[] = [];
  for (let i = 0; i < SEED_FAMILIES.length; i++) {
    const fam = SEED_FAMILIES[i];
    const pool = SEEDS.filter((s) => s.family === fam);
    if (pool.length === 0) continue;
    out.push(pool[(cursorIdx + i) % pool.length]);
  }
  return out;
}

function log(stage: string, payload: Record<string, unknown>) {
  console.log(`[INVENTORY] ${stage} ${JSON.stringify(payload)}`);
}

async function getCursor(sb: SupabaseClient): Promise<{ id: string; cursor_index: number } | null> {
  const { data, error } = await sb
    .from("inventory_seed_cursor")
    .select("id, cursor_index")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error || !data) {
    log("cursor_missing", { error: error?.message });
    return null;
  }
  return data as { id: string; cursor_index: number };
}

async function advanceCursor(
  sb: SupabaseClient,
  rowId: string,
  nextIndex: number,
  seed: string,
  inserted: number,
): Promise<void> {
  await sb.from("inventory_seed_cursor")
    .update({
      cursor_index: nextIndex,
      last_seed: seed,
      last_run_at: new Date().toISOString(),
      last_inserted: inserted,
    })
    .eq("id", rowId);
}

// Open a telemetry run row and return its id. Failures here are non-fatal.
async function startRun(
  sb: SupabaseClient,
  source: string,
  source_actor: string,
  seed: { q: string; family: string },
  trigger: string,
): Promise<string | null> {
  try {
    const { data, error } = await sb.from("source_ingestion_runs")
      .insert({
        source,
        source_actor,
        query_family: seed.family,
        seed_query: seed.q,
        trigger,
        status: "running",
      })
      .select("id")
      .single();
    if (error || !data) return null;
    return (data as { id: string }).id;
  } catch {
    return null;
  }
}

async function finishRun(
  sb: SupabaseClient,
  runId: string | null,
  patch: {
    fetched_count?: number;
    inserted_count?: number;
    deduped_count?: number;
    failed_count?: number;
    status: "success" | "partial" | "failed";
    duration_ms: number;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  if (!runId) return;
  try {
    await sb.from("source_ingestion_runs")
      .update({ ...patch, completed_at: new Date().toISOString() })
      .eq("id", runId);
  } catch {
    // swallow
  }
}

async function logError(
  sb: SupabaseClient,
  runId: string | null,
  source: string,
  seed: { q: string; family: string },
  errorMessage: string,
): Promise<void> {
  try {
    await sb.from("ingestion_errors").insert({
      run_id: runId,
      source,
      query_family: seed.family,
      seed_query: seed.q,
      error_type: "edge_invocation",
      error_message: errorMessage.slice(0, 500),
    });
  } catch {
    // swallow
  }
}

// Invoke an edge function and return the JSON body.
async function invokeFunction(
  fnName: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/${fnName}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    return { ok: res.ok && !!json?.ok, data: json };
  } catch (e) {
    return { ok: false, data: { error: (e as Error).message } };
  }
}

// Apify gate — flip to true (and re-enable kickoff path in
// discover-search-engine + apify-webhook) to restore Apify ingestion.
const APIFY_ENABLED = (Deno.env.get("APIFY_ENABLED") || "false").toLowerCase() === "true";

// Run discovery + ScrapingBee-bulk for one seed. Apify path is skipped while
// APIFY_ENABLED=false. multi-source-scraper still runs but ONLY its
// ScrapingBee KR branches return rows (apify_* sources are gated by env).
async function processSeed(
  sb: SupabaseClient,
  seed: { q: string; family: string },
  trigger: string,
): Promise<{ seed: string; family: string; discovery: number; scrapingbee: number; apify_skipped: boolean; total: number }> {
  const [discoveryRun, scrapingbeeRun] = await Promise.all([
    (async () => {
      const t0 = Date.now();
      const runId = await startRun(sb, "discovery", "search-discovery", seed, trigger);
      const r = await invokeFunction("search-discovery", {
        query: seed.q,
        maxQueries: 14,
        maxCandidates: 60,
      });
      const duration_ms = Date.now() - t0;
      const inserted = Number(r.data?.inserted) || 0;
      const fetched = Number(r.data?.candidatesFound) || 0;
      if (!r.ok) await logError(sb, runId, "discovery", seed, JSON.stringify(r.data).slice(0, 400));
      await finishRun(sb, runId, {
        fetched_count: fetched,
        inserted_count: inserted,
        status: r.ok ? "success" : "failed",
        duration_ms,
        metadata: { ok: r.ok, provider_used: "discovery", apify_skipped: !APIFY_ENABLED },
      });
      return inserted;
    })(),
    (async () => {
      const t0 = Date.now();
      const runId = await startRun(sb, "scrapingbee", "multi-source-scraper", seed, trigger);
      const r = await invokeFunction("multi-source-scraper", {
        query: seed.q,
        intensity: "cron",
      });
      const duration_ms = Date.now() - t0;
      const inserted = Number(r.data?.inserted) || 0;
      const fetched = Number(r.data?.merged) || 0;
      const deduped = Math.max(0, fetched - Number(r.data?.deduped || 0));
      if (!r.ok) await logError(sb, runId, "scrapingbee", seed, JSON.stringify(r.data).slice(0, 400));
      await finishRun(sb, runId, {
        fetched_count: fetched,
        inserted_count: inserted,
        deduped_count: deduped,
        status: r.ok ? "success" : "failed",
        duration_ms,
        metadata: { sources: r.data?.sources ?? {}, provider_used: "scrapingbee", apify_skipped: !APIFY_ENABLED },
      });
      return inserted;
    })(),
  ]);

  return {
    seed: seed.q,
    family: seed.family,
    discovery: discoveryRun,
    scrapingbee: scrapingbeeRun,
    apify_skipped: !APIFY_ENABLED,
    total: discoveryRun + scrapingbeeRun,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);
  const t0 = Date.now();

  try {
    let manualSeed: string | null = null;
    if (req.method === "POST") {
      try {
        const body = await req.json();
        if (typeof body?.seed === "string" && body.seed.trim()) {
          manualSeed = body.seed.trim().slice(0, 80);
        }
      } catch {
        // no body
      }
    }

    if (manualSeed) {
      const seed = { q: manualSeed, family: "manual" };
      const result = await processSeed(sb, seed, "manual");
      log("manual_done", { ...result, ms: Date.now() - t0 });
      return new Response(
        JSON.stringify({ ok: true, mode: "manual", ...result, ms: Date.now() - t0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const cursor = await getCursor(sb);
    if (!cursor) {
      return new Response(
        JSON.stringify({ ok: false, error: "Cursor row missing — run migration." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Diversified rotation: one seed per family per tick.
    const startIdx = ((cursor.cursor_index % SEEDS.length) + SEEDS.length) % SEEDS.length;
    const seedsThisTick = pickDiversifiedSeeds(startIdx);
    const nextIndex = (startIdx + 1) % SEEDS.length;

    log("tick_start", { startIdx, seeds: seedsThisTick.map((s) => s.q), nextIndex });

    // Fan-out 5 seeds in parallel; each seed itself fans out to discovery + Apify.
    const settled = await Promise.allSettled(
      seedsThisTick.map((s) => processSeed(sb, s, "cron")),
    );
    const perSeed = settled.map((s, i) =>
      s.status === "fulfilled"
        ? s.value
        : { seed: seedsThisTick[i].q, family: seedsThisTick[i].family, discovery: 0, apify: 0, total: 0 },
    );
    const totalInserted = perSeed.reduce((n, r) => n + r.total, 0);

    log("tick_done", { perSeed, totalInserted, ms: Date.now() - t0 });

    // Roll up to diagnostics_events for the existing admin panel.
    try {
      await sb.from("diagnostics_events").insert({
        event_name: "inventory_tick",
        status: totalInserted > 0 ? "success" : "partial",
        duration_ms: Date.now() - t0,
        metadata: {
          seeds: seedsThisTick.map((s) => s.q),
          per_seed: perSeed,
          total_inserted: totalInserted,
        },
      });
    } catch {
      // swallow
    }

    await advanceCursor(
      sb,
      cursor.id,
      nextIndex,
      seedsThisTick.map((s) => s.q).join(","),
      totalInserted,
    );

    return new Response(
      JSON.stringify({
        ok: true,
        mode: "cron",
        seeds: seedsThisTick.map((s) => s.q),
        cursorIndex: startIdx,
        nextIndex,
        perSeed,
        totalInserted,
        ms: Date.now() - t0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[INVENTORY] fatal", e);
    return new Response(
      JSON.stringify({ ok: false, error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
