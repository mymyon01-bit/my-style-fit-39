# Memory: index.md

# Project Memory

## Core
WARDROBE = AI fashion platform. Guest-first (no login wall). Dark theme default.
Playfair Display headings, Inter body. Accent: muted purple (252° HSL).
Lovable Cloud for backend. Google OAuth via lovable.auth.signInWithOAuth.
6-factor recommendation algo in src/lib/recommendation.ts.
i18n: en/ko/it. Never use Firebase — use Lovable Cloud.
Search: explicit category keyword in query = HARD category lock (no wrong types).

## Memories
- [DB schema](mem://features/db-schema) — profiles, style_profiles, body_profiles, interactions, saved_items, ootd_posts, ootd_stars
- [Auth flow](mem://features/auth) — Email + Google OAuth, guest mode with AuthGate, onboarding saves to DB
- [Star system](mem://features/stars) — 3 stars/day limit enforced by DB trigger
- [Category lock](mem://features/category-lock) — Hard category enforcement in search-discovery + product-search
- [Search intelligence](mem://features/search-intelligence) — Emotion-based intent, dual scoring, hybrid fallback
- [Inventory](mem://features/inventory) — Multi-source scraper + Firecrawl fallback + cron seed builder
