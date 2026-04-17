---
name: Category lock for product searches
description: Hard category-lock pipeline preventing wrong product types in results (e.g. "street bags" no longer returns dresses)
type: feature
---
## Category Lock

When a query contains an explicit category keyword (bag, jacket, shoes, …),
the system enforces a HARD lock — wrong category products are filtered out
even if results drop below normal threshold. Only scenario queries
("summer vacation", "date night", …) keep mixed-category behavior.

### Implementation
- `supabase/functions/search-discovery/index.ts`
  - `detectPrimaryCategory()` — deterministic regex first
  - `perplexityExpand(q, primaryCategory)` — category directive in prompt
  - `categoryGuard()` — drops drifted expansions
  - URL filter on candidates + categorize-then-filter on extracted
- `supabase/functions/product-search/index.ts`
  - `categoryMatches()` — tightened: "clothing"/"other" only matches when name confirms
  - HARD LOCK applied when `inferCategoryFromText(query)` is truthy
  - SOFT filter remains for category-only (UI dropdown) requests

### Logging
- `[SEARCH_INTENT] HARD LOCK category="bags" filtered N → M (query="street bags")`
- `[DISCOVERY] intent_detected`, `expand_done` (with guardRejects),
  `url_category_filter`, `extract_category_filter`
