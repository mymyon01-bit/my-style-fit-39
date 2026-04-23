---
name: Style recommendations open to all
description: daily-stylist edge function gates removed; guests/trial/premium all get AI recs. Free tier uses Lovable AI (gemini-2.5-flash), premium uses Perplexity sonar. Component StyleRecsForYou consumes search query+tags+products as context. Mounted on HomePage (panel) and DiscoverPage top (inline).
type: feature
---
- Edge fn `daily-stylist`: optional auth, accepts `searchQuery`/`searchTags`/`searchProducts`. Premium → Perplexity, else → Lovable AI Gateway. Caches only when logged-in.
- `verify_jwt = false` set in supabase/config.toml so guests can call.
- `StyleRecsForYou` component (variant "panel" | "inline") shown on HomePage below hero AND in Discover above DbTopGrid.
- DailyPicks/PremiumBanner gating untouched but no longer the only entry point.
