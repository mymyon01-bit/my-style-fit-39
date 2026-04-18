---
name: Multi-source Apify-first pipeline
description: Apify always-parallel (ASOS+Zalando+Coupang+Google Shopping) on every search, 60s per-query cooldown, fresh-first merge, 30% per-domain cap, 10-20 new-batch injection
type: feature
---
## Apify-First Pipeline (current state)

### Sources (always parallel, never fallback-only)
multi-source-scraper runs 5 actors in parallel on every call:
- **Apify ASOS** (`jupri~asos-scraper`) — global
- **Apify Zalando** (`tugkan~zalando-scraper`) — EU
- **Apify Coupang** (`epctex~coupang-scraper` or `APIFY_COUPANG_ACTOR` env) — KR
- **Apify Google Shopping** (`emastra~google-shopping-scraper` or `APIFY_GSHOPPING_ACTOR` env) — universal merchant coverage
- **Crawlbase Farfetch** — high-trust supplemental

Each source has 14s budget, allSettled (partial failure tolerated).

### Cooldown
60-second per-query in-memory cooldown in multi-source-scraper. Same query within window returns cached result set (avoids Apify cost spikes on user retries).

### product-search db-first branch (always-on path)
1. PARALLEL: `loadFromDB` + `fetchFromMultiSource` run together (`Promise.all`).
2. Fresh-first merge:
   - First 10–20 items = Apify externals (new-batch injection guarantee).
   - Then DB pool sorted by `created_at DESC`.
   - Then remaining externals + discovery items.
3. commerce-scraper only fires if Apify under-delivers (<8 items) — supplemental, not primary.
4. search-discovery (Firecrawl/Perplexity) only on miss (<minTarget after merge).

### Diversity & caps
- max 3 per brand
- max 6 per platform
- max 4 per identical style combo
- **30% per-domain cap** — no single host (asos.com, zalando.de, etc.) may exceed 30% of the post-dedup pool. Domain derived from `source_url` host, falls back to `platform`.

### Dedupe
- URL key = host+pathname (lowercased)
- normalized title = lowercase + strip non-alphanumeric (incl. Hangul) + 60 char cap
- image-host key = host+pathname
- Reject on ANY collision

### Caching
- All Apify results upserted to `product_cache` with `search_query` = lowercased query, `last_validated`/`created_at` = now, source/platform tags preserved.
- ON CONFLICT `(platform, external_id)` updates trend_score / last_validated.

### UI freshness (unchanged from prior pass)
- `<FreshnessPill>` rotates "Fetching new items…" / "Adding fresh picks…" / "Curating live inventory…"
- Sonner toast "N new arrivals just added" on each batch append.
