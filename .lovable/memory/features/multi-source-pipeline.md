---
name: Multi-source product pipeline
description: Firecrawl + Apify (ASOS/Zalando) + Crawlbase (Farfetch) parallel fetch, 10-min TTL cache, 70/30 fresh mix, hybrid seen filter (session + 24h DB)
type: feature
---
## Multi-source ingestion

### Sources (parallel, 15s budget each, allSettled)
1. **Firecrawl** → existing `search-discovery` edge fn
2. **Apify** → ASOS (`jupri~asos-scraper`), Zalando (`tugkan~zalando-scraper`) via `run-sync-get-dataset-items`
3. **Crawlbase** → Farfetch via Crawling API + autoparse

Edge fn: `supabase/functions/multi-source-scraper/index.ts`. Required secrets: `APIFY_TOKEN`, `CRAWLBASE_TOKEN` (Firecrawl already configured).

`ingestQuery()` fans out to BOTH `search-discovery` and `multi-source-scraper` in parallel.

### Dedupe + shuffle
- URL + image-fingerprint dedupe before upsert
- Fisher–Yates shuffle so cache isn't seeded in source order
- Upsert into `product_cache` on `(platform, external_id)`

### Cache layer (`src/lib/search/discovery-cache.ts`)
- 10-minute in-memory TTL keyed by normalized query
- Cold/expired → full fresh fetch
- Warm → 70% cached + 30% fresh interleaved, with parallel background refresh
- `invalidateCache(query)` for pull-to-refresh

### Seen filter (hybrid)
- Session: existing localStorage seen-set (600 keys, rolling)
- DB: `user_seen_products` table, 24h window, RLS per user
- `loadDbSeenKeys()` → demote (not remove) repeats in `search-runner`
- `recordDbSeen()` non-blocking write of top 30 results per session
- `purge_old_seen_products()` SQL helper drops rows >24h

### Guarantee
User never sees the same products twice within 24h on the same account, and cached batches never persist beyond 10 minutes.
