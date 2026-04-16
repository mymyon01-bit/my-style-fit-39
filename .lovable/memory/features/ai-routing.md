---
name: AI routing system
description: Dual AI routing — Lovable AI for free/guest, Perplexity for homepage/logged-in/premium users with auto-fallback
type: feature
---
## AI Tier System

Edge function `wardrobe-ai` routes AI calls based on user context:

| Tier | Provider | Model | Trigger |
|------|----------|-------|---------|
| free | Lovable AI | gemini-2.5-flash | Guest / no auth |
| user | Perplexity | sonar | Logged-in user |
| homepage | Perplexity | sonar | Any request from homepage |
| premium | Perplexity | sonar-pro | Premium subscriber |

### Routing logic
1. `source === "homepage"` → always Perplexity (brand experience)
2. Premium subscription active → Perplexity sonar-pro
3. Logged-in user → Perplexity sonar
4. Guest → Lovable AI

### Fallback
If Perplexity fails → auto-fallback to Lovable AI. Never break the experience.

### Frontend passes `source` param
- HomePage navigates with `?source=homepage`
- DiscoverPage reads `sourceParam` and passes to edge function
