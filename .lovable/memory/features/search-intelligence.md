---
name: Intelligent search & scoring system
description: Emotion-based search intent, free/premium dual scoring, product detail sheet with Shop Now, DB-first architecture
type: feature
---
## Search Intelligence

### Emotion-based intent interpretation
- `wardrobe-ai` search-intent action now detects mood/emotion from input
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

### Premium scoring (on-demand, AI-enhanced)
Only triggered when user explicitly requests premium features.

### Product detail sheet
- `ProductDetailSheet` component (bottom sheet)
- Shows: large image, brand, name, price, store, style tags, reason
- Primary CTA: "SHOP NOW" → opens external link in new tab
- Secondary: save (heart), share
- Opens on card click; action buttons use stopPropagation

### DB-first architecture
- All normal traffic served from `product_cache`
- External expansion only when DB insufficient (<8 results)
- Client-side result caching (5min TTL)
- Background fetch fills cache for future requests
