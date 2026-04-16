---
name: Multi-source inventory system
description: product_cache with Firecrawl commerce scraper (Naver, SSENSE, Farfetch, ASOS, SSG), trend scoring, DB-first Discover, platform badges, weekly Sunday refresh cron
type: feature
---
## Inventory System

### Data Sources
1. **Firecrawl Commerce Scraper (no-key mode):** Scrapes public search pages from Naver Shopping, SSENSE, Farfetch, ASOS, SSG using Firecrawl JSON extraction
2. **No mock/dummy APIs:** DummyJSON and FakeStoreAPI removed — all results must be real products
3. **Future (key-based):** Naver Shopping API, Amazon PA API, Coupang Partners API — architecture ready but inactive

### product_cache table
Extended columns: `trend_score`, `is_active`, `last_validated`, `platform` (naver|ssense|farfetch|asos|ssg|ai_search)
Unique constraint: `(platform, external_id)` for dedup

### Data flow
1. Discover loads from product_cache first (DB-first)
2. If cache insufficient → fetch via `product-search` → `commerce-scraper`
3. Search queries also trigger `commerce-scraper` directly for real-time scraping
4. Last resort → AI generation via `wardrobe-ai`
5. All valid products cached to product_cache automatically

### Edge functions
- `product-search`: Routes to commerce-scraper only (no mock APIs), normalizes, caches, returns
- `commerce-scraper`: Firecrawl-powered scraper for Naver/SSENSE/Farfetch/ASOS/SSG public search pages
- `wardrobe-ai`: AI recommendations with DB-first cache check
- `inventory-maintenance`: Weekly cron (Sunday 3AM UTC) for image validation + trend scoring

### Platform badges
RecommendationCard shows colored platform badges (top-left): Naver=green, SSENSE=zinc, Farfetch=stone, ASOS=blue, SSG=rose, AI=purple

### Validation rules
Products only valid with: working image + title + outbound link + price
Broken images → discard, never render text-only cards

### Diversity constraints
- Max 3 per brand in top results
- Max 5 per platform in top results

### Weekly refresh
pg_cron job `weekly-inventory-maintenance` runs every Sunday at 3AM UTC
- Validates images on products not checked in 7+ days
- Recalculates trend scores based on views, likes, saves
- Deactivates products with broken images

### Future switch
When API keys are issued, swap source connector layer only — schema + ranking engine stay unchanged
