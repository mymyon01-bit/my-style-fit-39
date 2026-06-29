# MYMYON OOTD Community Rebuild — Implementation Plan

> Inspired by Instagram × Pinterest × TikTok × SSENSE, but executed as a
> **Fashion Operating System**, not a social network. Keeps MYMYON's existing
> Circle/Ripple terminology in the backend and adds **Wave 🌊** as the new
> reaction primitive on top.

---

## Naming Decision (locked)

| Concept                  | MYMYON term                  | DB / code           |
| ------------------------ | ---------------------------- | ------------------- |
| People you follow        | **Circle** (private)         | `circles` table     |
| One-way followers        | **Ripple** (public count)    | derived from circles|
| "I love this style" tap  | **Wave 🌊** (replaces Like)  | new `ootd_waves`    |
| Save to a board          | **Save**                     | `saved_posts` + folder |
| Outfit collections / hubs| **Currents** (existing Waves feature stays as `waves` table — group hubs) | `waves`/`wave_*` |

Note: the existing `waves` table is the *group hub* feature (Old Money Wave,
etc.). The new tap-reaction is `ootd_waves` so the two never collide. The
story bar at the top of the feed surfaces `waves` rows (the hubs).

---

## Phase 1 — Feed shell (Following / Explore / Trending + Wave bar + ranked feed)

**Files**
- `src/components/ootd/sections/FeedSection.tsx` — rewrite
- `src/components/ootd/feed/WaveBar.tsx` *(new)* — horizontal rail of Currents (hub waves)
- `src/components/ootd/feed/FeedCard.tsx` *(new)* — single post card
- `src/components/ootd/feed/ShopTheLookSheet.tsx` *(new)* — tagged products drawer
- `src/lib/ootd/feedRanking.ts` *(new)* — score function

**Tabs**
`Following` (= Circle) · `Explore` (default) · `Trending` (24 h hot)

**Card anatomy**
Avatar · username · location · image carousel · brand chips · product tags
overlay · `Fit Match XX%` badge · 🌊 Waves · 💬 Comments · 💾 Save · 🛍 Shop the Look

**Ranking signal weights** (client-side reorder of fetched window):
```
purchase 50 · fit tryon 20 · save 10 · showroom visit 8 ·
comment 5 · wave 2 · like 1
+ recency decay (e^(-hours/72))
+ affinity boost if author ∈ Circle
```

## Phase 2 — Wave reaction primitive

**Migration**
- `ootd_waves(id, post_id, user_id, created_at, unique(post_id,user_id))`
- `ootd_posts.wave_count int default 0`
- trigger bumps `wave_count`
- GRANTs: insert/delete for `authenticated`, select for `anon`
- RLS: anyone can read, only owner can insert/delete own wave

**Client**
- `useWave(postId)` hook (optimistic toggle)
- Replace heart icon in FeedCard / PostDetail with 🌊 swell animation
- Keep legacy `ootd_reactions` rows readable so old `like_count` doesn't break
  (display Waves = `wave_count`, fallback to `like_count` for legacy posts).

## Phase 3 — Save → Collections

- Tap Save → popover with folders from `saved_folders` (already exists) +
  inline "New folder" input.
- Default folders if user has none (seeded via existing `useSavedFolders`).
- Profile → **Saved** tab shows folders as Pinterest-style tiles.

## Phase 4 — Profile visibility rules

- `UserProfilePage` shows: avatar · username · **Ripples (followers count)** ·
  Waves received total · Showroom score · Fit accuracy · Creator rank.
- **Circle list is private** — only the owner can open it. Visitors see only
  the *count* and never the list.
- Tabs: Posts · OOTD · Showroom · Saved · Tagged. `Saved` and `Tagged` only
  visible to owner.

**Backend**
- RLS on `circles`: viewing one's own `follower_id` rows allowed; viewing
  someone else's `follower_id` rows blocked. (Aggregate counts stay reachable
  via a `SECURITY DEFINER` function `get_circle_counts(uid)`.)
- `useCircleCounts` already returns counts via the function — keep it.

## Phase 5 — Showroom score + Fit integration on cards

- New view `showroom_scores` (SECURITY DEFINER fn): waves received ÷ visits.
- `FeedCard` calls `useResolvedGarmentSize` only when a product is tagged;
  shows `Fit Match %` badge using existing fit memory if available, else
  hides the badge (no fake numbers).

## Phase 6 — Discovery weighting

Extend `src/lib/recommendation.ts`:
- pull from `saved_posts`, `ootd_waves`, `interactions` (view duration),
  `fit_memory`, `showroom_reactions`.
- Used by Explore tab + `Based on Your Body DNA` row on Home.

## Phase 7 — Polish

- Wave swell micro-animation (framer-motion scale + ripple ring).
- Empty states for each tab.
- Skeleton loaders sized to final card height to prevent CLS.
- Remove residual references to "Like" in OOTD surface copy.

---

## Out of scope (explicit)
- Push notifications (project rule: in-app only).
- Stories — replaced by Wave/Currents rail; keep the existing `stories` table
  untouched but stop surfacing it on the OOTD feed.
- Renaming `circles`/`waves` tables — too risky, naming stays at UI layer.

---

## Rollout order
1. Phase 2 migration (Wave primitive) — unblocks everything else.
2. Phase 1 feed shell consuming Wave count.
3. Phase 3 Save folders popover.
4. Phase 4 profile privacy + tabs.
5. Phase 5 Fit + Showroom score badges.
6. Phase 6 ranking extension.
7. Phase 7 polish.

Each phase ships independently; no big-bang switch.
