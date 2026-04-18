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
// Covers all major requested families: bags, streetwear, minimal, oversized,
// jackets, sneakers, formal, accessories, wallets, jewelry — plus color/price
// variations for diversity.
const SEEDS: string[] = [
  // bags
  "bags", "crossbody bag", "tote bag", "shoulder bag", "backpack", "designer bag", "mini bag",
  // streetwear
  "streetwear", "urban outfit", "street style", "graphic tee", "cargo pants", "hoodie streetwear",
  // minimal
  "minimal style", "minimalist outfit", "neutral tones", "clean look", "monochrome outfit",
  // oversized
  "oversized fit", "oversized hoodie", "oversized blazer", "baggy jeans",
  // jackets / outerwear
  "jackets", "leather jacket", "denim jacket", "bomber jacket", "trench coat", "puffer jacket", "wool coat",
  // sneakers / shoes
  "sneakers", "white sneakers", "running shoes", "chunky sneakers", "loafers", "boots",
  // formal
  "formal look", "suit", "blazer", "dress shirt", "office wear",
  // accessories
  "accessories", "sunglasses", "belts", "hats", "scarves",
  // wallets
  "wallets", "card holder", "leather wallet",
  // jewelry
  "jewelry", "silver necklace", "gold ring", "minimal earrings", "chain necklace",
  // color variations
  "black outfit", "white outfit", "beige outfit",
  // seasonal
  "summer outfit", "winter outfit",
];

// Per-tick fan-out: process N seeds in parallel each invocation so the DB
// grows ~3x faster without raising cron frequency.
const SEEDS_PER_TICK = 3;

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
      body: JSON.stringify({ query: seed, maxQueries: 14, maxCandidates: 60 }),
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

    // Fan out across SEEDS_PER_TICK seeds in parallel — DB grows ~3× per tick.
    const startIdx = ((cursor.cursor_index % SEEDS.length) + SEEDS.length) % SEEDS.length;
    const seedsThisTick: string[] = [];
    for (let i = 0; i < SEEDS_PER_TICK; i++) {
      seedsThisTick.push(SEEDS[(startIdx + i) % SEEDS.length]);
    }
    const nextIndex = (startIdx + SEEDS_PER_TICK) % SEEDS.length;

    log("tick_start", { startIdx, seeds: seedsThisTick, nextIndex });
    const settled = await Promise.allSettled(seedsThisTick.map(callDiscovery));
    const perSeed = settled.map((s, i) => ({
      seed: seedsThisTick[i],
      ...(s.status === "fulfilled" ? s.value : { ok: false, inserted: 0, candidatesFound: 0 }),
    }));
    const totalInserted = perSeed.reduce((n, r) => n + r.inserted, 0);
    log("tick_done", { perSeed, totalInserted, ms: Date.now() - t0 });

    await advanceCursor(supabase, cursor.id, nextIndex, seedsThisTick.join(","), totalInserted);

    return new Response(
      JSON.stringify({
        ok: true,
        mode: "cron",
        seeds: seedsThisTick,
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
