---
name: product-search fast path
description: User-facing product-search returns DB pool + ≤3.5s Google Shopping; multi-source-scraper and commerce-scraper run via EdgeRuntime.waitUntil to enrich cache in background. Synchronous fetchFromDiscovery removed from the hot path.
type: feature
---
## product-search edge function — latency contract

Target: P95 < 4.5s end-to-end on warm cache, < 6s cold.

### Hot path (awaited)
1. `loadFromDB` (sub-second) — primary result source.
2. `fetchFromGoogleShopping(query, 60, hl, 3_500)` raced against a 3.5s timer.

That's it. Everything else has been moved off the synchronous path.

### Background (EdgeRuntime.waitUntil)
- `fetchFromMultiSource(query, 12_000)` — ScrapingBee KR + ASOS/Zalando/SSENSE.
- `fetchFromCommerceScraper(query, ≤24)` — only if DB pool < 8 items.
- Both upsert into `product_cache` so the NEXT request sees the fresh items.

### Removed from hot path
- `fetchFromDiscovery` (Firecrawl/Perplexity, 6-8s) — too slow, low yield.
- The 3-tier broadening cascade — now a single DB-broaden fallback.
- Long parallel `Promise.all` waits on multi-source (was 9s).

### Both branches updated
- `freshSearch` branch (frontend `freshSearch: true`)
- DB-first branch (default `expandExternal: true`)

Both follow the same DB-first + race-one-external + waitUntil-the-rest shape.
