# V4.4 — OOTD → Showroom Ecosystem Rebuild

Reposition OOTD from social feed to **curated personal showroom + fit reference library**. No rebuild — layered on top of existing OOTD/Showroom infrastructure.

## Scope (web + mobile web + iOS + Android, all share the same React code)

### 1. Language repositioning (global string sweep)
- `Post` → `Add to Showroom`
- `Upload` → `Curate Look`
- `Trending creators` / `Top influencer` → `Featured Showrooms`
- `Most liked` → `Most curated`
- `Followers` → `Showroom followers`
- Files: `OOTDPage.tsx`, `OOTDUploadSheet.tsx`, `OOTDCard.tsx`, `OOTDPostDetail.tsx`, `ShareToOOTDDialog.tsx`, `OOTDDiaryButton.tsx`, nav labels.

### 2. OOTD feed → Curated Style Stream
- Replace the current flat feed in `OOTDPage.tsx` with **category rails** grouped by silhouette / aesthetic:
  - Relaxed Minimal · Oversized Street · Smart Casual · Korean Casual · Tailored Monochrome · Vintage Archive · Technical Outerwear
- Pull from existing `ootd_posts.style_tags` / `topics` / `occasion_tags` — no schema change.
- Add a top "People Like Me" rail (uses `body_profiles` similarity + `fit_memory` overlap).
- Keep the existing chronological feed available behind a "Latest" tab so existing posts still surface.

### 3. Reduce vanity metrics
- Hide explicit follower counts on cards/profile in favor of a single small "Showroom" chip.
- Soften like/star counters: only show when ≥ threshold; no "trending" badges.
- Remove "Top Creators" sort.

### 4. Editorial detail page (`OOTDPostDetail.tsx`)
- Larger hero image, generous padding, magazine typography.
- New sections: **Silhouette breakdown**, **Fit notes**, **Tagged products**, **Similar fits from people like you**, **Save options** (Board / Silhouette / Styling reference).
- Strip noisy reaction widgets; keep one primary star + one save action.

### 5. Style Collections (lightweight)
- New tab inside profile/showroom: organize saved OOTDs into named collections (Summer Fits, Airport Looks, etc.).
- Reuse existing `style_boards` table — no new schema. Boards already support saved items; allow saving an `ootd_post` id as a board item with `kind='ootd'`.

### 6. Showroom following framing
- In `UserProfilePage` / showroom card, label the follow CTA as **Follow Showroom** with a one-line aesthetic descriptor (e.g. "Oversized minimal references").

### 7. "People Like Me" recommendation hook
- New `src/hooks/usePeopleLikeMe.ts`: queries `ootd_posts` joined with `body_profiles` filtered by ±5cm height / ±3cm shoulder of current user; falls back to `fit_memory.preferred_fit` overlap for guests/no-body users.

### 8. Visual polish
- Editorial spacing tokens; switch OOTD surfaces to monochrome cards with thin hairlines.
- Replace heart-bursts and bright reaction chips with subtle outline icons.

## Out of scope
- No DB migrations.
- No removal of existing posts, comments, stars, reactions tables.
- No notification/messaging changes.
- No new auth/permissions.

## Files touched (estimate)
- Edited: `src/pages/OOTDPage.tsx`, `src/pages/ShowroomBrowsePage.tsx`, `src/pages/UserProfilePage.tsx`, `src/components/OOTDCard.tsx`, `src/components/OOTDPostDetail.tsx`, `src/components/OOTDUploadSheet.tsx`, `src/components/ShareToOOTDDialog.tsx`, `src/components/showroom/ShowroomCard.tsx`, `src/components/showroom/HotShowroomSection.tsx`, `src/components/OOTDDiaryButton.tsx`.
- New: `src/hooks/usePeopleLikeMe.ts`, `src/components/ootd/CuratedStyleStream.tsx`, `src/components/ootd/SilhouetteBreakdown.tsx`, `src/components/ootd/StyleCollectionsTab.tsx`.

## Approach order
1. Language sweep across OOTD/Showroom strings.
2. Build `CuratedStyleStream` + integrate into `OOTDPage` (keep Latest fallback).
3. `usePeopleLikeMe` hook + rail.
4. Editorial detail page refactor.
5. Style Collections tab using `style_boards`.
6. Visual polish pass.
