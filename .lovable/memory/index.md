# Memory: index.md
Updated: today

# Project Memory

## Core
WARDROBE = AI fashion platform. Guest-first (no login wall). Dark theme default.
Playfair Display headings, Inter body. Accent: muted purple (252° HSL).
Lovable Cloud for backend. Google OAuth via lovable.auth.signInWithOAuth.
6-factor recommendation algo in src/lib/recommendation.ts.
i18n: en/ko/it. Never use Firebase — use Lovable Cloud.
FIT VISUAL pipeline is the locked working model — see fit-working-model.md. Roll back here when user says "go back to working model".
Sizing recommendations are measurement-driven (src/lib/sizing/) — do NOT bypass with image-only guesses.

## Memories
- [DB schema](mem://features/db-schema) — profiles, style_profiles, body_profiles, interactions, saved_items, ootd_posts, ootd_stars
- [Auth flow](mem://features/auth) — Email + Google OAuth, guest mode with AuthGate, onboarding saves to DB
- [Star system](mem://features/stars) — 3 stars/day limit enforced by DB trigger
- [FIT working model](mem://features/fit-working-model) — Locked baseline for FIT visual try-on (fit-generate-v2 + Replicate IDM-VTON + canvas hooks)
- [Sizing engine](mem://features/sizing-engine) — Measurement-driven size recommendation pipeline (body + garment chart + category rules)
