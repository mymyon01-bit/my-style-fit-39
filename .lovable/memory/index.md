# Project Memory

## Core
WARDROBE = AI fashion platform. Guest-first (no login wall). Light theme default (warm off-white #fbf8f6, near-black #171717 text).
Inter only — no Playfair, no decorative serifs. Premium editorial commerce typography.
Accent: deep burgundy (351° HSL). Lovable Cloud for backend. Google OAuth via lovable.auth.signInWithOAuth.
6-factor recommendation algo in src/lib/recommendation.ts.
i18n: en/ko/it (Korean uses Noto Sans KR override). Never use Firebase — use Lovable Cloud.
FIT visual: NEVER show product image overlaid on silhouette as a "fake try-on" — only real generated image, clean skeleton, or PREVIEW UNAVAILABLE fallback.

## Memories
- [DB schema](mem://features/db-schema) — profiles, style_profiles, body_profiles, interactions, saved_items, ootd_posts, ootd_stars
- [Auth flow](mem://features/auth) — Email + Google OAuth, guest mode with AuthGate, onboarding saves to DB
- [Star system](mem://features/stars) — 3 stars/day limit enforced by DB trigger
- [FIT engine](mem://features/fit-engine) — Hybrid deterministic fit + AI vision body scan + tiered free/premium modes
