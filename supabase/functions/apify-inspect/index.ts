// One-shot Apify run inspector. DELETE after audit.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const APIFY_TOKEN = Deno.env.get("APIFY_TOKEN");
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const { runId } = await req.json().catch(() => ({}));
  if (!runId) return new Response(JSON.stringify({ error: "runId required" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
  const r = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`);
  const j = await r.json();
  return new Response(JSON.stringify(j, null, 2), { headers: { ...cors, "Content-Type": "application/json" } });
});
