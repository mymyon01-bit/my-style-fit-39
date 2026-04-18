---
name: Korean-first multi-source pipeline
description: Discovery-only KR (Naver/Musinsa/Coupang/Interpark via Firecrawl), KR query expansion, 4-cycle multi-pass with 18-new-candidate quota, 6h pg_cron enrichment, freshness pill + new-arrivals toast
type: feature
---
## Korean Pipeline (current state)

### Sources
- **Tier 1**: Naver Shopping + Musinsa — discovery-only via search-discovery (Firecrawl). No official Naver API yet.
- **Tier 2**: Coupang + Interpark — discovery + page parsing, capped (Interpark ≤12% of window).
- **Tier 3**: Western (Farfetch, ASOS, Zalando, YOOX) via Apify/Crawlbase/Firecrawl.

### Multi-pass discovery (search-runner.ts)
4-cycle plan, up to 20 query family variants. `MIN_NEW_CANDIDATES = 18` — runner won't short-circuit until at least 18 new (non-cluster-seed) products accumulate. Stops only on 2 consecutive empty cycles or 25s wall-clock.

### Korean query expansion (query-expansion-service.ts)
When `isKoreanMarketQuery(q)` is true, fallback variants are interleaved with KR suffixes (추천, 코디, 스타일, 쇼핑, 신상, 베스트, 데일리룩), seasonal codi, shopping-intent (buy/shop/best), and explicit `무신사 / 네이버쇼핑` prefixes.

### Background enrichment
`pg_cron` job `inventory-builder-6h` fires `inventory-builder` edge fn every 6h with rotating KR-aware seeds. Seeds processed 3 per tick.

### UI freshness
- `<FreshnessPill>` above the live grid rotates: "Fetching new items…" / "Adding fresh picks…" / "Curating live inventory…".
- Sonner toast `"N new arrivals just added"` fires on each batch append in load-more.

### Caching
- `discovery-cache.ts` 10-min in-memory TTL, 70/30 cached/fresh on warm hit.
- `query_clusters` DB-side persistence for instant Stage 1 seed.
- 24h `user_seen_products` filter demotes (not removes) repeats per logged-in user.
