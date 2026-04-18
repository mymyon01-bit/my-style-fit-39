# Memory: index.md
Updated: today

# Project Memory

## Core
WARDROBE = AI fashion platform. Guest-first (no login wall). Dark theme default.
Playfair Display headings, Inter body. Accent: burgundy #7A1F2B (HSL 351 60% 30%) for CTAs/badges only.
Lovable Cloud for backend. Google OAuth via lovable.auth.signInWithOAuth.
6-factor recommendation algo in src/lib/recommendation.ts.
i18n: en/ko/it. Never use Firebase — use Lovable Cloud.
Korean market is launch market — Naver/Musinsa/Coupang/Interpark are first-class sources.

## Memories
- [DB schema](mem://features/db-schema) — profiles, style_profiles, body_profiles, interactions, saved_items, ootd_posts, ootd_stars
- [Auth flow](mem://features/auth) — Email + Google OAuth, guest mode with AuthGate, onboarding saves to DB
- [Star system](mem://features/stars) — 3 stars/day limit enforced by DB trigger
- [Korean market](mem://features/korean-market) — Tier-1 Musinsa/Naver, Tier-2 Coupang/Interpark, Tier-3 western
- [Multi-source pipeline](mem://features/multi-source-pipeline) — Firecrawl+Apify+Crawlbase parallel, 10min cache, hybrid 24h seen filter
