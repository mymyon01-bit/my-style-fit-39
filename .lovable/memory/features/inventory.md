---
name: Multi-source inventory system
description: product_cache with Firecrawl scraper (5 platforms parallel + web-search fallback), partial-failure tolerance, relaxed validation, never-empty result guarantee
type: feature
---
## Inventory System

### Data Sources (all enabled)
1. **ASOS, SSENSE, Farfetch, Naver, SSG** scraped in parallel via Firecrawl `/scrape` (15s/platform timeout, single attempt, allSettled — partial failure OK).
2. **Firecrawl `/search` fallback** triggers when scraper returns < 6 items. Pulls real product URLs from Google-style web search.
3. Sources are NEVER permanently disabled — failures are skipped per-request only.

### product_cache table
Extended columns: `trend_score`, `is_active`, `last_validated`, `platform` (asos|ssense|farfetch|naver|ssg|web|ai_search)
Unique constraint: `(platform, external_id)` for dedup

### Data flow (fresh search)
1. External scraper (parallel, 5 platforms, ~15s wall-clock) + DB query run together
2. Results merged, external first
3. **Guarantee**: if total < 6, broaden by dropping text query, then pull trending — UI never sees empty state
4. Cached to product_cache async

### Validation rules (RELAXED)
- Accept if: title + price + safe https image URL + product link
- HEAD probe failure → ACCEPT (probe is best-effort only)
- Trusted CDNs (ssensemedia, asos-media, ssgcdn, farfetch-contents, scene7) skip probe entirely
- Reject only: broken/missing image, no link, non-fashion title

### Diversity / dedup
- Max 3 per brand, max 5 per platform, max 3 per identical style combo
- Dedup by title-key, image URL (no query), source URL

### Per-source logging
Every search logs: `commerce-scraper per-platform: {asos: N, ssense: N, ...}` and per-platform `[platformId] DONE in Xms — extracted, candidates, validated`.

### UX rule
Empty state is forbidden. Discover shows "Looking for fresh picks…" + reset button instead of "No verified products found".

### Future switch
When real APIs are issued (Naver Shopping API, etc.), swap source connector layer only — schema + ranking engine stay unchanged
