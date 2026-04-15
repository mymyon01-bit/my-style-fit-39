# Project Memory

## Core
WARDROBE = AI fashion platform. Guest-first (no login wall). Dark theme default.
Playfair Display headings, Inter body. Accent: Deep Burgundy #5A1E2A (349° HSL). BG light: #F7F7F8, dark: #0B0B0D.
Lovable Cloud for backend. Google OAuth via lovable.auth.signInWithOAuth.
6-factor recommendation algo in src/lib/recommendation.ts.
i18n: en/ko/it. Never use Firebase — use Lovable Cloud.
No purple accents — burgundy only.

## Memories
- [DB schema](mem://features/db-schema) — profiles, style_profiles, body_profiles, interactions, saved_items, ootd_posts, ootd_stars
- [Auth flow](mem://features/auth) — Email + Google OAuth, guest mode with AuthGate, onboarding saves to DB
- [Star system](mem://features/stars) — 3 stars/day limit enforced by DB trigger
- [Subscription](mem://features/subscription) — 3-month trial auto-activates, gates daily/weekly AI styling, daily-stylist edge function
- [Design tokens](mem://design/color-tokens) — Light #F7F7F8 / Dark #0B0B0D, accent burgundy #5A1E2A, editorial layout
