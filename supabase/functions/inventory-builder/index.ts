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

// Expanded taxonomy — 70+ seeds covering bags, streetwear, minimal, oversized,
// jackets, sneakers, formal, accessories, jewelry, color/season variants, plus
// Korean queries. Round-robin guarantees full coverage across cron cycles.
const SEEDS: { q: string; family: string }[] = [
  // bags
  { q: "bags", family: "bags" },
  { q: "crossbody bag", family: "bags" },
  { q: "tote bag", family: "bags" },
  { q: "shoulder bag", family: "bags" },
  { q: "backpack", family: "bags" },
  { q: "designer bag", family: "bags" },
  { q: "mini bag", family: "bags" },
  { q: "leather bag", family: "bags" },
  // streetwear
  { q: "streetwear", family: "streetwear" },
  { q: "urban outfit", family: "streetwear" },
  { q: "graphic tee", family: "streetwear" },
  { q: "cargo pants", family: "streetwear" },
  { q: "hoodie streetwear", family: "streetwear" },
  { q: "techwear", family: "streetwear" },
  // minimal
  { q: "minimal style", family: "minimal" },
  { q: "minimalist outfit", family: "minimal" },
  { q: "neutral tones", family: "minimal" },
  { q: "monochrome outfit", family: "minimal" },
  { q: "clean look", family: "minimal" },
  // oversized
  { q: "oversized fit", family: "oversized" },
  { q: "oversized hoodie", family: "oversized" },
  { q: "oversized blazer", family: "oversized" },
  { q: "baggy jeans", family: "oversized" },
  { q: "oversized tee", family: "oversized" },
  // jackets / outerwear
  { q: "jackets", family: "jackets" },
  { q: "leather jacket", family: "jackets" },
  { q: "denim jacket", family: "jackets" },
  { q: "bomber jacket", family: "jackets" },
  { q: "trench coat", family: "jackets" },
  { q: "puffer jacket", family: "jackets" },
  { q: "wool coat", family: "jackets" },
  { q: "rain jacket", family: "jackets" },
  // sneakers / shoes
  { q: "sneakers", family: "sneakers" },
  { q: "white sneakers", family: "sneakers" },
  { q: "running shoes", family: "sneakers" },
  { q: "chunky sneakers", family: "sneakers" },
  { q: "loafers", family: "shoes" },
  { q: "boots", family: "shoes" },
  { q: "red shoes", family: "shoes" },
  // formal
  { q: "formal look", family: "formal" },
  { q: "suit", family: "formal" },
  { q: "blazer", family: "formal" },
  { q: "dress shirt", family: "formal" },
  { q: "office wear", family: "formal" },
  // accessories / jewelry
  { q: "sunglasses", family: "accessories" },
  { q: "belts", family: "accessories" },
  { q: "hats", family: "accessories" },
  { q: "scarves", family: "accessories" },
  { q: "wallets", family: "accessories" },
  { q: "card holder", family: "accessories" },
  { q: "silver necklace", family: "jewelry" },
  { q: "gold ring", family: "jewelry" },
  { q: "minimal earrings", family: "jewelry" },
  { q: "chain necklace", family: "jewelry" },
  // color variations
  { q: "black outfit", family: "color" },
  { q: "white outfit", family: "color" },
  { q: "beige outfit", family: "color" },
  { q: "olive outfit", family: "color" },
  // seasonal
  { q: "summer outfit", family: "seasonal" },
  { q: "winter outfit", family: "seasonal" },
  { q: "fall outfit", family: "seasonal" },
  { q: "spring outfit", family: "seasonal" },
  { q: "rainy outerwear", family: "seasonal" },
  // korean
  { q: "korean fashion bag", family: "korean" },
  { q: "korean street style", family: "korean" },
  { q: "korean sneakers", family: "korean" },
  { q: "한국 가방", family: "korean" },
  { q: "코트", family: "korean" },
  { q: "스니커즈", family: "korean" },
];

const SEEDS_PER_TICK = 5;

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

// Run BOTH discovery + Apify-bulk for one seed. Returns combined stats.
async function processSeed(
  sb: SupabaseClient,
  seed: { q: string; family: string },
  trigger: string,
): Promise<{ seed: string; family: string; discovery: number; apify: number; total: number }> {
  // Run both in parallel — they hit different sources.
  const [discoveryRun, apifyRun] = await Promise.all([
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
        metadata: { ok: r.ok },
      });
      return inserted;
    })(),
    (async () => {
      const t0 = Date.now();
      const runId = await startRun(sb, "apify", "multi-source-scraper", seed, trigger);
      const r = await invokeFunction("multi-source-scraper", {
        query: seed.q,
        intensity: "cron",
      });
      const duration_ms = Date.now() - t0;
      const inserted = Number(r.data?.inserted) || 0;
      const fetched = Number(r.data?.merged) || 0;
      const deduped = Math.max(0, fetched - Number(r.data?.deduped || 0));
      if (!r.ok) await logError(sb, runId, "apify", seed, JSON.stringify(r.data).slice(0, 400));
      await finishRun(sb, runId, {
        fetched_count: fetched,
        inserted_count: inserted,
        deduped_count: deduped,
        status: r.ok ? "success" : "failed",
        duration_ms,
        metadata: { sources: r.data?.sources ?? {} },
      });
      return inserted;
    })(),
  ]);

  return {
    seed: seed.q,
    family: seed.family,
    discovery: discoveryRun,
    apify: apifyRun,
    total: discoveryRun + apifyRun,
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

    const startIdx = ((cursor.cursor_index % SEEDS.length) + SEEDS.length) % SEEDS.length;
    const seedsThisTick: { q: string; family: string }[] = [];
    for (let i = 0; i < SEEDS_PER_TICK; i++) {
      seedsThisTick.push(SEEDS[(startIdx + i) % SEEDS.length]);
    }
    const nextIndex = (startIdx + SEEDS_PER_TICK) % SEEDS.length;

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
