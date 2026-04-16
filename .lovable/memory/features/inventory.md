---
name: Multi-source inventory system
description: product_cache with open APIs (DummyJSON, FakeStoreAPI), trend scoring, DB-first Discover, platform column
type: feature
---
## Inventory System

### Data Sources (Open APIs — no keys required)
1. **DummyJSON** (`dummyjson.com/products`) — fashion categories, search, images
2. **FakeStoreAPI** (`fakestoreapi.com/products`) — clothing, jewelry

### product_cache table
Extended columns: `trend_score`, `is_active`, `last_validated`, `platform` (dummyjson|fakestore|ai_search)
Unique constraint: `(platform, external_id)` for dedup

### Data flow
1. Discover loads from product_cache first (DB-first)
2. If cache empty → fetch from open APIs via `product-search` edge function
3. Last resort → AI generation via `wardrobe-ai`
4. All valid products cached to product_cache automatically

### Edge functions
- `product-search`: Fetches from DummyJSON + FakeStoreAPI, normalizes, caches, returns
- `wardrobe-ai`: AI recommendations with DB-first cache check
- `inventory-maintenance`: Weekly cron for image validation + trend scoring

### ProductCard behavior
- Products with `source_url` open external link in new tab
- Products without `source_url` navigate to internal fit page

### Extensibility
Architecture ready for adding more sources (Naver, Amazon, Coupang) via API keys later
