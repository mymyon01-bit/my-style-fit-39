---
name: Category lock for product searches
description: Three-layer hard category-lock (client session + edge expand + edge filter) preventing wrong product types in results
type: feature
---
## Category Lock — 3 layers

When a query contains an explicit category keyword (bag, jacket, shoes, wallet, jewelry…),
ALL three layers enforce a HARD lock — wrong-category products never reach the UI.
Scenario queries ("summer vacation", "date night", "rainy day", …) keep mixed-category behavior.

### Layer 1 — Client session (src/lib/search/)
- `category-lock.ts` — single source of truth: `detectPrimaryCategory`, `inferCategoryFromTitle`, `productMatchesCategory`, `categoryFirstSort`
- `search-session.ts` — session carries `categoryLock` and `rejectedByCategory` counters
- `appendToSession()` HARD-DROPS products whose title/category don't match the lock
- `search-runner.ts` — final pass `categoryFirstSort()` ensures matched items lead

### Layer 2 — search-discovery edge function
- `detectPrimaryCategory()` — same regex shape as client
- `perplexityExpand(q, primaryCategory)` — category directive in prompt
- `categoryGuard()` — drops drifted expansions
- URL filter on candidates + categorize-then-filter on extracted

### Layer 3 — product-search edge function
- `inferCategoryFromText()` for query → derives intent
- HARD LOCK applied when query word triggers it (drops non-matching products in both fresh and DB-first branches)
- DB-first branch: if HARD lock would empty results, broaden by category once

### Patterns (all 3 layers must stay in sync)
- bags: bags|tote|backpack|crossbody|clutch|purse|satchel|duffle|messenger|handbag|shoulder bag|hobo|bucket bag|**wallet**
- shoes: sneakers|shoes|boots|loafers|sandals|trainers|mules|heels|pumps|flats|oxfords|derby|brogues|espadrilles|slippers
- outerwear: jacket|coat|blazer|parka|bomber|trench|overcoat|windbreaker|anorak|gilet|puffer|cardigan
- tops: shirt|tee|t-shirt|hoodie|sweater|polo|blouse|tank|knit|sweatshirt|pullover|henley|tunic|camisole|top
- bottoms: pants|trousers|jeans|shorts|skirt|chinos|joggers|leggings|slacks|culottes
- dresses: dress|jumpsuit|romper|gown
- accessories: hat|cap|beanie|scarf|belt|watch|sunglasses|gloves|tie|necklace|bracelet|earring|ring|**jewelry**|fedora|beret|headband|bandana

### Logging
- `[search-runner] start` `{ categoryLock }`
- `[search-runner] done` `{ categoryLock, rejectedByCategory, final }`
- `[SEARCH_INTENT] HARD LOCK category="bags" filtered N → M`
- `[DISCOVERY] intent_detected`, `expand_done` (with guardRejects), `url_category_filter`, `extract_category_filter`
