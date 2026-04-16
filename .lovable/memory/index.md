# Project Memory

## Core
WARDROBE = AI fashion platform. Guest-first (no login wall). Dark theme default.
Playfair Display headings, Inter body. Accent: muted purple (252° HSL).
Lovable Cloud for backend. Google OAuth via lovable.auth.signInWithOAuth.
6-factor recommendation algo in src/lib/recommendation.ts.
i18n: en/ko/it. Never use Firebase — use Lovable Cloud.

## Memories
- [DB schema](mem://features/db-schema) — profiles, style_profiles, body_profiles, interactions, saved_items, ootd_posts, ootd_stars
- [Auth flow](mem://features/auth) — Email + Google OAuth, guest mode with AuthGate, onboarding saves to DB
- [Star system](mem://features/stars) — 3 stars/day limit enforced by DB trigger
- [Inventory system](mem://features/inventory) — product_cache, Firecrawl scraper, platform badges, weekly refresh
- [AI routing](mem://features/ai-routing) — Dual AI: Lovable AI free, Perplexity premium, auto-fallback
- [Subscription](mem://features/subscription) — 3-month free trial, gates daily/weekly AI styling
- [Search intelligence](mem://features/search-intelligence) — Emotion-based search, free/premium scoring, product detail sheet with Shop Now, DB-first
