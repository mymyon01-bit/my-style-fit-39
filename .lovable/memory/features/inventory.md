---
name: Multi-source inventory growth engine
description: Auto-scaling product sourcing with hybrid Apify+Firecrawl pipeline, 4h cron fan-out (5 seeds × 2 sources), per-run telemetry tables, freshness merge, never-empty UX
type: feature
---
## Inventory System (current state)

### Sources & roles
- **Apify** = bulk inventory growth engine. Active on every tick + every live search (lower caps on live).
  Actors: ASOS, Zalando, Coupang (KR), Google Shopping (universal).
- **Firecrawl + Perplexity** (`search-discovery`) = page-level extraction and long-tail domain coverage.
- **Crawlbase Farfetch** = high-trust supplemental.

### Live search path (`product-search` → `multi-source-scraper`)
- Always parallel: DB lookup + Apify (`intensity: "live"`).
- Live caps per actor: ASOS 12, Zalando 12, Coupang 12, GShopping 15.
- 60s in-memory cooldown per `(intensity, query)` pair on live calls.
- Discovery only invoked on miss (<minTarget after merge).

### Cron path (`inventory-builder`, every 4h via pg_cron)
- 70+ seeds across families: bags, streetwear, minimal, oversized, jackets, sneakers, shoes, formal, accessories, jewelry, color, seasonal, korean.
- Each tick: 5 seeds in parallel. Each seed fans out to `search-discovery` + `multi-source-scraper` (`intensity: "cron"`) in parallel.
- Cron caps per actor: ASOS 40, Zalando 40, Coupang 40, GShopping 50.
- Cooldown is bypassed in cron mode (always fresh).
- Per-tick math: 5 seeds × 2 pipelines × ~5 sources = ~50 source-runs/tick × 6 ticks/day = ~300 source-runs/day.

### Telemetry tables (admin-only RLS)
- `source_ingestion_runs`: one row per (source, seed) — fetched/inserted/deduped/failed/status/duration/metadata.
- `ingestion_errors`: failure log with optional run_id link.
- `diagnostics_events.inventory_tick`: per-tick rollup for the existing AdminDiagnostics panel.

### Dedup (unchanged from previous pass)
- URL key = host+pathname (lowercased)
- Normalized title = lowercase + strip non-alphanumeric (incl. Hangul) + 60 char cap
- Image-host key = host+pathname
- Reject on ANY collision

### Diversity caps (in product-search post-dedup)
- max 3 per brand
- max 6 per platform
- 30% per-domain cap

### Freshness
- All Apify upserts set `last_validated`/`created_at` = now and `search_query` = lowercased query.
- DB-first merge in product-search prefers `created_at DESC` then injects fresh externals at top.

### Schedule
pg_cron job `inventory-builder-tick` runs every 4h:
`select cron.schedule('inventory-builder-tick', '0 */4 * * *', ...)`

### UX guarantee (unchanged)
- Empty state forbidden. Discover shows "Looking for fresh picks…" + reset button.
- `<FreshnessPill>` rotates messages while live fetch resolves.
- Sonner toast "N new arrivals just added" on each batch append.
