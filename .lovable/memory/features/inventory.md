---
name: Multi-source inventory system
description: product_cache with open APIs (DummyJSON, FakeStoreAPI) + Firecrawl commerce scraper (Naver, SSENSE, Farfetch, ASOS, SSG), trend scoring, DB-first Discover, platform column
type: feature
---
## Inventory System

### Data Sources
1. **Open APIs (no keys):** DummyJSON, FakeStoreAPI
2. **Firecrawl Commerce Scraper (no-key mode):** Scrapes public search pages from Naver Shopping, SSENSE, Farfetch, ASOS, SSG using Firecrawl JSON extraction
3. **Future (key-based):** Naver Shopping API, Amazon PA API, Coupang Partners API — architecture ready but inactive

### product_cache table
Extended columns: `trend_score`, `is_active`, `last_validated`, `platform` (dummyjson|fakestore|naver|ssense|farfetch|asos|ssg|ai_search)
Unique constraint: `(platform, external_id)` for dedup

### Data flow
1. Discover loads from product_cache first (DB-first)
2. If cache insufficient → fetch from open APIs + commerce scraper via `product-search`
3. Search queries also trigger `commerce-scraper` directly for real-time scraping
4. Last resort → AI generation via `wardrobe-ai`
5. All valid products cached to product_cache automatically

### Edge functions
- `product-search`: Fetches from DummyJSON + FakeStoreAPI + commerce-scraper, normalizes, caches, returns
- `commerce-scraper`: Firecrawl-powered scraper for Naver/SSENSE/Farfetch/ASOS/SSG public search pages
- `wardrobe-ai`: AI recommendations with DB-first cache check
- `inventory-maintenance`: Weekly cron for image validation + trend scoring

### Validation rules
Products only valid with: working image + title + outbound link + price
Broken images → discard, never render text-only cards

### Diversity constraints
- Max 3 per brand in top results
- Max 5 per platform in top results
- Platform penalty for over-representation

### ProductCard behavior
- Products with `source_url` open external link in new tab
- Products without `source_url` navigate to internal fit page

### Future switch
When API keys are issued, swap source connector layer only — schema + ranking engine stay unchanged
