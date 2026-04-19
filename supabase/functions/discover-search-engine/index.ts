// discover-search-engine — DISABLED (Apify stabilization pass, 2026-04-19)
// ------------------------------------------------------------------------
// This function previously kicked off Apify Web Scraper / Puppeteer Scraper
// runs against KR commerce domains (musinsa, 29cm, wconcept, ssg). Apify
// budget is exhausted and success rate is too low to keep in the active
// path. The function is intentionally short-circuited so that:
//
//   - no Apify run is ever created
//   - no source_ingestion_runs row is opened
//   - the client orchestrator gets a fast "ok, async, no-op" response
//   - log line is emitted so operators can see Apify is skipped
//
// Discover ingestion is now carried by:
//   - search-discovery        (Perplexity + Firecrawl + Naver API)
//   - multi-source-scraper    (ScrapingBee KR extraction)
//
// Re-enable by setting APIFY_ENABLED=true env var, but the rest of this
// pipeline (puppeteer actor, webhook normalization) is also disabled in
// `apify-webhook` so flipping this flag alone won't restart ingestion.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const APIFY_ENABLED = (Deno.env.get("APIFY_ENABLED") || "false").toLowerCase() === "true";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  console.log("[discover-search-engine] apify_skipped=true reason=stabilization_pass");

  return new Response(
    JSON.stringify({
      ok: true,
      async: true,
      apify_skipped: true,
      apify_enabled: APIFY_ENABLED,
      message:
        "Apify ingestion is disabled. Discover is served by search-discovery + multi-source-scraper (ScrapingBee).",
      startedCount: 0,
      totalCount: 0,
      totalInserted: 0,
      results: [],
      elapsed_ms: 0,
    }),
    { headers: { ...cors, "Content-Type": "application/json" } },
  );
});
