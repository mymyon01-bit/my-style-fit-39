// apify-webhook — DISABLED (Apify stabilization pass, 2026-04-19)
// ----------------------------------------------------------------
// Apify is no longer kicked off (see discover-search-engine), but Apify can
// still send delayed webhook callbacks for any zombie runs created before
// this pass. We:
//
//   1. Acknowledge the callback so Apify stops retrying
//   2. Mark the matching source_ingestion_runs row as 'failed' with
//      reason='apify_disabled_stabilization_pass'
//   3. Log a diagnostics_events row so operators see the skip count
//
// We do NOT fetch the dataset, do NOT call Firecrawl, do NOT upsert.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const t0 = Date.now();
  let payload: any = null;
  try {
    payload = await req.json();
  } catch {
    // ignore — still ack
  }

  const userData = payload?.userData ?? {};
  const sourceRunRowId: string | null = userData?.sourceRunRowId ?? null;
  const runId: string | null = payload?.runId ?? null;
  const apifyStatus: string | null = payload?.status ?? null;
  const eventType: string | null = payload?.eventType ?? null;
  const domain: string = String(userData?.domain ?? "").trim();
  const query: string = String(userData?.query ?? "").trim();

  console.log(
    "[apify-webhook] apify_skipped=true (stabilization pass)",
    { runId, apifyStatus, eventType, sourceRunRowId, domain },
  );

  try {
    const sb = createClient(SUPABASE_URL, SERVICE_KEY);
    if (sourceRunRowId) {
      await sb.from("source_ingestion_runs").update({
        status: "failed",
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - t0,
        metadata: {
          domain, query, runId, apifyStatus, eventType,
          reason: "apify_disabled_stabilization_pass",
        },
      }).eq("id", sourceRunRowId);
    }
    await sb.from("diagnostics_events").insert({
      event_name: "apify_webhook_skipped",
      status: "partial",
      duration_ms: Date.now() - t0,
      metadata: {
        runId, apifyStatus, eventType, domain, query,
        provider_used: "none",
        apify_skipped: true,
      },
    });
  } catch (e) {
    console.warn("[apify-webhook] cleanup failed", (e as Error).message);
  }

  return new Response(
    JSON.stringify({ ok: true, apify_skipped: true, ignored: true }),
    { headers: { ...cors, "Content-Type": "application/json" } },
  );
});
