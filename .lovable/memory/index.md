# Memory: index.md
Updated: now

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
- [Search intelligence](mem://features/search-intelligence) — Emotion-based search, DB-first, hybrid fallback, free/premium scoring
- [AI routing](mem://features/ai-routing) — Tier-based: free→Lovable AI, user/premium→Perplexity, with fallback
- [Inventory](mem://features/inventory) — Auto-tagging, validation, continuous DB expansion via product-search
- [Subscription](mem://features/subscription) — free/premium_trial/premium, 90-day trial on onboard
- [FIT system](mem://features/fit-engine) — Hybrid deterministic+AI fit engine, body scan with vision, real product integration
