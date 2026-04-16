# Memory: index.md
Updated: now

# Project Memory

## Core
WARDROBE = AI fashion platform. Guest-first (no login wall). Dark theme default.
Playfair Display headings, Inter body. Accent: muted purple (252° HSL).
Lovable Cloud for backend. Google OAuth via lovable.auth.signInWithOAuth.
6-factor recommendation algo in src/lib/recommendation.ts.
i18n: en/ko/it. Never use Firebase — use Lovable Cloud.
Admin: manual DB role via user_roles table. Admin panel at /admin.
Dual AI: Lovable AI (free/guest), Perplexity (homepage/logged-in/premium). Fallback to Lovable AI.

## Memories
- [DB schema](mem://features/db-schema) — profiles, style_profiles, body_profiles, interactions, saved_items, ootd_posts, ootd_stars, user_roles, product_categories, products, saved_folders
- [Auth flow](mem://features/auth) — Email + Google OAuth, guest mode with AuthGate, onboarding saves to DB
- [Star system](mem://features/stars) — 3 stars/day limit enforced by DB trigger
- [Category tree](mem://features/categories) — Hierarchical product_categories with parent-child, seeded with fashion defaults
- [Admin panel](mem://features/admin) — Role-based admin at /admin with sidebar, overview/users/products/categories/ootd/content/settings pages
- [AI routing](mem://features/ai-routing) — Dual AI system: free→Lovable AI, homepage/user→Perplexity sonar, premium→Perplexity sonar-pro. Auto-fallback.
