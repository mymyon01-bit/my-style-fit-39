# Memory: index.md
Updated: today

# Project Memory

## Core
WARDROBE = AI fashion platform. Guest-first (no login wall). Light theme (bg #fbf8f6, fg #171717).
Inter-only font stack. No Playfair Display anywhere.
Lovable Cloud for backend. Google OAuth via lovable.auth.signInWithOAuth.
6-factor recommendation algo in src/lib/recommendation.ts.
i18n: en/ko/it. Never use Firebase — use Lovable Cloud.
FIT: FitSolver (src/lib/fit/fitSolver.ts) is the deterministic source of truth — image is visualization only.

## Memories
- [DB schema](mem://features/db-schema) — profiles, style_profiles, body_profiles, interactions, saved_items, ootd_posts, ootd_stars
- [Auth flow](mem://features/auth) — Email + Google OAuth, guest mode with AuthGate, onboarding saves to DB
- [Star system](mem://features/stars) — 3 stars/day limit enforced by DB trigger
- [FIT engine](mem://features/fit-engine) — Hybrid deterministic + AI vision body scan, free/premium tiers
- [FIT solver](mem://features/fit-solver) — Deterministic core; SolverResult drives UI + AI prompt hints
- [product-search fast path](mem://features/product-search-fastpath) — DB + 3.5s gShop on hot path; multi-source/commerce-scraper via waitUntil
