---
name: Self-growing inventory system
description: product_cache with trend scoring, scheduled validation, and DB-first Discover
type: feature
---
## Inventory System

### product_cache table
Extended columns: `trend_score` (numeric), `is_active` (boolean), `last_validated` (timestamptz)

### Data flow
1. AI search results → validated → cached in product_cache
2. Discover loads from product_cache first (DB-first), AI only on active search
3. getCachedProducts orders by trend_score DESC, filters is_active=true, image_valid=true

### Scheduled maintenance
Edge function: `inventory-maintenance`
Cron: weekly (Sunday 3 AM UTC) via pg_cron
Actions:
- Re-validate images (HEAD request) for products not validated in 7+ days
- Deactivate broken products (is_active=false)
- Update trend_score = views*1 + likes*3 + saves*5 with age decay

### Trend score formula
`rawScore = view_count*1 + like_count*3 + saves*5`
`trendScore = rawScore * (1 - agePenalty)` where agePenalty applies after 30 days
