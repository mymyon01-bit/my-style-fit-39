// Inventory Builder
// Round-robins through a fixed list of seed shopping queries and invokes the
// existing search-discovery pipeline for ONE seed per tick. Designed to be
// triggered by pg_cron every 6 hours so the DB grows continuously across the
// full taxonomy without burning all credits at once.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Fixed taxonomy seeds — broad shopping queries that should always grow supply.
const SEEDS: string[] = [
  "black outfit",
  "minimal style",
  "oversized fit",
  "summer outfit",
  "jackets",
  "sneakers",
  "bags",
  "streetwear",
];

function log(stage: string, payload: Record<string, unknown>) {
  console.log(`[INVENTORY] ${stage} ${JSON.stringify(payload)}`);
}

async function getCursor(supabase: any): Promise<{ id: string; cursor_index: number } | null> {
  const { data, error } = await supabase
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
  supabase: any,
  rowId: string,
  nextIndex: number,
  seed: string,
  inserted: number,
): Promise<void> {
  await supabase
    .from("inventory_seed_cursor")
    .update({
      cursor_index: nextIndex,
      last_seed: seed,
      last_run_at: new Date().toISOString(),
      last_inserted: inserted,
    })
    .eq("id", rowId);
}

async function callDiscovery(seed: string): Promise<{ inserted: number; candidatesFound: number; ok: boolean }> {
  // Invoke the existing search-discovery edge function over HTTP (it runs the
  // full pipeline: Perplexity expand → URL discover → extract → validate → insert).
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/search-discovery`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({ query: seed, maxQueries: 10, maxCandidates: 30 }),
    });
    const json = await res.json().catch(() => ({}));
    return {
      ok: !!json?.ok,
      inserted: Number(json?.inserted || 0),
      candidatesFound: Number(json?.candidatesFound || 0),
    };
  } catch (e) {
    log("discovery_call_error", { msg: (e as Error).message, seed });
    return { ok: false, inserted: 0, candidatesFound: 0 };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const t0 = Date.now();

  try {
    // Optional manual override: { "seed": "raincoat" } to ingest a specific seed
    // without advancing the cursor. Useful for admin top-ups.
    let manualSeed: string | null = null;
    if (req.method === "POST") {
      try {
        const body = await req.json();
        if (typeof body?.seed === "string" && body.seed.trim()) {
          manualSeed = body.seed.trim().slice(0, 80);
        }
      } catch {
        // no body / not JSON — fine
      }
    }

    if (manualSeed) {
      log("manual_run", { seed: manualSeed });
      const result = await callDiscovery(manualSeed);
      log("manual_done", { ...result, ms: Date.now() - t0 });
      return new Response(
        JSON.stringify({ ok: true, mode: "manual", seed: manualSeed, ...result, ms: Date.now() - t0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const cursor = await getCursor(supabase);
    if (!cursor) {
      return new Response(
        JSON.stringify({ ok: false, error: "Cursor row missing — run migration." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const idx = ((cursor.cursor_index % SEEDS.length) + SEEDS.length) % SEEDS.length;
    const seed = SEEDS[idx];
    const nextIndex = (idx + 1) % SEEDS.length;

    log("tick_start", { idx, seed, nextIndex });
    const result = await callDiscovery(seed);
    log("tick_done", { seed, ...result, ms: Date.now() - t0 });

    await advanceCursor(supabase, cursor.id, nextIndex, seed, result.inserted);

    return new Response(
      JSON.stringify({
        ok: true,
        mode: "cron",
        seed,
        cursorIndex: idx,
        nextIndex,
        ...result,
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
