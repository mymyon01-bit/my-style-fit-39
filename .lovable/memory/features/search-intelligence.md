---
name: Intelligent search & scoring system
description: Emotion-based search intent, free/premium dual scoring, product detail sheet with Shop Now, DB-first with hybrid fallback, preference banner
type: feature
---
## Search Intelligence

### Preference banner
- `PreferenceBanner` component shows when no style profile exists
- Dismissible but returns until quiz completed
- Links to StyleQuiz — quiz results immediately used for scoring

### Emotion-based intent interpretation
- `wardrobe-ai` search-intent detects mood/emotion from input
- Maps feelings → style direction → product queries
- Includes unconscious matching via behavior patterns (likes, saves, views)
- Returns `emotional_tone`, `color_direction`, `fit_direction` alongside queries

### Free-mode scoring (client-side, no AI)
Lightweight scoring applied to all DB results:
- 0.30 Style Match (emotion→style mapping)
- 0.20 Category match
- 0.20 Color alignment
- 0.15 Preference (user style profile)
- 0.10 Behavior (like/dislike feedback)
- 0.05 Diversity jitter

### Hybrid fallback
- `hybridSearchWithFallback` wraps search with 5s timeout
- On timeout → `tagBasedFallback` queries product_cache directly by tags
- Never shows empty/broken state on slow network

### Auto-tagging
- `autoTagProduct` in product-search edge function
- Infers style_tags, color_tags, fit from product name + brand
- Applied to all external products before caching

### Product detail sheet
- `ProductDetailSheet` component (bottom sheet)
- Shows: large image, brand, name, price, store, style tags, reason
- Primary CTA: "SHOP NOW" → opens external link in new tab

### DB-first architecture
- Initial load uses style profile for personalized queries
- Client-side result caching (5min TTL)
- Background fetch fills cache for future requests
