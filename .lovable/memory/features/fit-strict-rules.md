---
name: FIT strict rules — no scores, body & gender lock
description: User-enforced rule set for FIT — no numeric scoring shown, body+gender always from user profile (never product), all sizes shown with distinct fit outcomes.
type: feature
---

# FIT Strict Rules (deterministic, rule-based)

Hard rules layered on top of the existing measurement-driven sizing engine and
the locked Replicate IDM-VTON visual pipeline. Do NOT relax these.

## 1. Body & gender lock
- Body gender is read from `profiles.gender_preference` ONLY (loaded in `FitPage` as `bodyGender` state and passed into `FitResults` → `useFitTryOn` → `fit-tryon-router`).
- Never derive subject gender from the product. A male user picking a women's item gets a male body wearing women's clothing, and vice versa.
- The router prompt (`buildCleanStudioPrompt` in `supabase/functions/fit-tryon-router/index.ts`) has an explicit "BODY GENDER LOCK" line stating the gender is non-negotiable and must NOT change to match the garment.

## 2. No numeric scores in the UI
- Removed score numbers from: `FitResults` hero block, size-pill switcher, `SizeComparisonCard` row header, `SizeRecommendationPanel` `SizeRow` header.
- Hero block now shows: RECOMMENDED size + alternate size + overall fit label (e.g. "Best fit / Good fit / Wearable / Poor fit"). No "67/100" anywhere user-visible.
- Internal score remains in `SizeOutcome.score` and `FitResult.fitScore` for sorting/picking — never rendered.

## 3. Recommendation rule
- Primary + alternate come from `buildRecommendation` (measurement-driven). Never default to S.
- All available sizes are shown with distinct per-region fit outcomes (`SizeRecommendationPanel` per-size table + `SizeComparisonCard` list).

## 4. Fallback notice
- When `recommendation.usedCategoryDefaults` is true, the panel shows: "No detailed size chart for this product — using category averages."

## 5. Visual fit enforcement
- Router prompt forces fabric behavior to reflect calculated fit (tight = tension lines, oversized = dropped shoulders + extended hem) and explicitly forbids resizing the body to fit the garment.

## Files touched by this rule set
- `src/pages/FitPage.tsx` — loads `gender_preference`, passes as `bodyGender`.
- `src/components/fit/FitResults.tsx` — removed all displayed scores; hero shows size + fit label only.
- `src/components/fit/SizeRecommendationPanel.tsx` — removed score display from `SizeRow`.
- `supabase/functions/fit-tryon-router/index.ts` — added "BODY GENDER LOCK" line in `buildCleanStudioPrompt`.
