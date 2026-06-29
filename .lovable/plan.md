# MYMYON Rebrand & UI Transformation — Build Plan

This guideline covers 10 large areas. To ship it cleanly without breaking the live app, I'll do it in phases. Each phase is shippable on its own — you can review after each one before I move on.

## Phase 1 — Brand Identity Foundation (1 turn)
- **Color tokens** in `src/index.css`:
  - Midnight Navy `#0F1A2D`, Warm Ivory `#F4EFE8`, Champagne Beige `#DCC7B6`, Soft Gold `#E6808B` (accent), Graphite Black `#1A1A1A`.
  - Apply to light + dark theme semantic tokens (background, foreground, primary, accent, card, border).
- **Typography**: Playfair Display (headings), SF Pro Display / Inter fallback (UI body). Wired into Tailwind + global CSS.
- **Signature logo**: keep existing gold cursive "my" mark; verify usage in `Brandmark.tsx` and splash.
- Tags row (Luxury · Timeless · Editorial · Intelligent · Personal) added as a subtle brand microcopy strip on Home.

## Phase 2 — Navigation Restructure (1 turn)
- Bottom nav becomes: **Home · Fit DNA · Discover · OOTD · Profile** (already partly done — finalize icons + labels + routes).
- `Discover` = product exploration / shopping (new route, reuses existing product browse).
- `Fit DNA` = body analysis + fit prediction hub.
- `Profile` = personal closet + analytics.

## Phase 3 — Home Page Transformation (1 turn)
- New components:
  - **Hero Fashion Banner** ("Your Style. Perfected.") — editorial full-bleed.
  - **Curated For You** rail.
  - **Based On Your Body DNA** rail (uses existing recommendation engine).
  - **Trending Brands** logo row.
  - **AI Picks** card.
  - **Seasonal Editorial Collections** large card.
- Removes the generic "new arrivals / best sellers" feel.

## Phase 4 — Fit DNA Page (1 turn)
- Body DNA panel: Shoulder / Bust / Waist / Hip / Height / Weight + body-shape classifier.
- AI score ring trio: **Fit Accuracy 92% · Comfort 88% · Silhouette 90%**.
- New capability chips: Virtual fitting, Cross-brand normalization, Outfit compatibility scoring, Fabric tension prediction, Size confidence.

## Phase 5 — Product Detail Page Upgrade (1 turn)
- Adds **Product Intelligence Layer**: Fit Match %, Recommended Size, Fabric Behavior, AI Styling Suggestions, Similar Alternatives.
- Action row: Try On · Add to Closet · Outfit Builder · Save to Wave.

## Phase 6 — OOTD Community Evolution (1–2 turns)
- A. **Feed** — keep vertical infinite feed.
- B. **My Page** — outfit archive, saved looks, closet management, personal statistics, style evolution timeline.
- C. **Wave** — TikTok-style trend discovery tab (viral looks, challenges, creator growth).
- D. **Showroom** — themed/seasonal/creator lookbooks ("Paris Minimalism", "Office Essentials", etc.).

## Phase 7 — Personal Closet System (1 turn)
- MY CLOSET: save owned items, build outfits, track wears, AI styling suggestions, "what should I wear today", weather styling, travel packing, missing item recommendations.

## Phase 8 — Visual Design Polish (continuous)
- Larger imagery, more whitespace, stronger type hierarchy, cleaner nav. Editorial dark surfaces with ivory cards. Inspirations: NET-A-PORTER, COS, THE ROW, TOTEME, SSENSE, ZARA STUDIO.

## Phase 9 — Final Positioning Copy
- Replace marketing copy app-wide: "MYMYON — AI-powered personal fashion ecosystem. Personal Styling · Body Intelligence · Smart Shopping · Digital Closet · Fashion Community · Creator Economy."

---

## Suggested Order
I propose shipping in this order: **1 → 2 → 3 → 4 → 5 → 6 → 7**, with Phase 8 polish folded into each. Each phase is ~1 turn and independently reviewable.

## Confirmation
- Start with **Phase 1 (Brand tokens + typography)** now?
- Or jump to a specific phase you care about most (e.g., Phase 3 Home, or Phase 6 OOTD Wave + Showroom)?
