---
name: Measurement-driven sizing engine
description: New src/lib/sizing/ pipeline — body+garment+category logic; replaces image-only fit guessing. Locked FIT visual pipeline untouched.
type: feature
---

# Sizing Engine (measurement-driven)

Lives entirely under `src/lib/sizing/` + `useSizeRecommendation` hook + `SizeRecommendationPanel` UI. Parallel to (does NOT replace) the locked FIT visual try-on pipeline.

**Gender flow**: `useSizeRecommendation` always feeds a gender into `resolveBody`. Priority is `args.body.gender` > `profiles.gender_preference` (auto-fetched) > `"neutral"`. The product gender is inferred via `inferProductGender({explicit, category, name, brand, breadcrumb})` in `categoryRules.ts` — explicit > breadcrumb/text signals > null. `recommend.ts` adds `bodyGender`, `productGender`, and `genderMismatchWarning` to every `SizeRecommendation`. `SizeRecommendationPanel` shows a `WOMEN`/`MEN` chip in the header and an amber warning banner when product targets a different gender.

## Pipeline
1. `bodyResolver.ts` — merges user-provided body data with `anthropometry.ts` estimates (height/weight/gender → shoulder/chest/waist/hip/inseam). Every value tagged `exact | inferred | default`.
2. `garmentChart.ts` — loads ALL sizes for a product from `garment_measurements` (DB). If empty AND we have URL, fires on-demand `garment-size-fetch` scraper, races 3s, then falls back to category defaults from `categoryRules.ts`.
3. `categoryRules.ts` — per-category (tshirt/shirt/hoodie/knit/jacket/coat/pants/denim/shorts/dress/skirt/cropped) ease tables for each preference (fitted/regular/relaxed/oversized) + region weights + length mode (strict/lenient/ignore).
4. `fitCalculator.ts` — for every size in the chart, computes per-region status (tooTight…oversized), overall label (verySmall…tooLarge), score, and one-line summary.
5. `recommend.ts` — picks primary + alternate based on preference; computes confidence (high/medium/low) from chart completeness × body completeness.

## Preference resolution
- Global default: `style_profiles.preferred_fit` (already exists).
- Per-product override via the toggle in `SizeRecommendationPanel`.

## UI integration
- `SizeRecommendationPanel` shows confidence badge, recommended/alternate, per-size collapsible table with region chips and cm deltas, "why" sentence, and fit-preference toggle.
- `InferredMeasurementsBanner` shows when any body field was inferred.
- Category-default warning appears when chart fell back to defaults.
- Wired into `FitResults.tsx` (rendered above legacy SIZE COMPARISON). Selecting a size in the panel updates the active size for the visual try-on too.

## Visual try-on rewire
- `FitResults` reads `sizing.recommendation.sizes[activeSize]` and passes its per-region statuses (mapped via `STATUS_TO_FIT_DESCRIPTOR`) into `useFitTryOn`'s `regions` payload + `fitDescriptor` (overall label).
- Result: `fit-tryon-router` (Replicate IDM-VTON) generates an image that visualizes the CALCULATED fit (S=tight / M=fitted / L=regular / XL=oversized) instead of guessing.
- Falls back to legacy `fitEngine` regions when the new chart hasn't resolved yet — never blocks rendering.

## Hard rules (do not violate)
- Never label a size as "perfect" / "recommended" if measurements don't support it.
- Always surface inferred-vs-exact provenance to the user.
- Never blank the UI when chart or measurements are missing — degrade with low confidence.
- **Body-type honesty**: `bodyResolver` accepts `shapeScales` (shoulder/chest/waist/hip/leg multipliers from `buildBodyShapeScales`) and `anthropometry.estimateAnthropometry` applies them on top of BMI baselines, so slim/regular/solid/heavy users with the same H/W never collapse into identical estimated bodies. `useSizeRecommendation` accepts `body.shapeScales`; `FitResults` passes `buildBodyShapeScales(bodyShape)` in.
- **Adjacent-size monotonicity**: `calculateAllSizes` runs `smoothAdjacentSizes` (forward + backward pass on the OVERALL_TIER ladder) so adjacent sizes can never jump more than 1–2 tiers (e.g. no S=verySmall → M=regularFit). Smooths noisy mixed exact/categoryDefault data.
- **Out-of-range honesty**: if even the largest size in the chart is too tight (or smallest too loose) for the user, `SizeRecommendation.rangeStatus` becomes `"tooSmall"`/`"tooLarge"`, confidence is forced to `low`, primary is pinned to the boundary size, and `rangeWarning` displays a red "this product won't fit" banner. Driven by `detectRangeStatus` in `recommend.ts`. Heavy regions (shoulder/chest, weight ≥ 0.25) marked `tooTight` alone are enough to label a size `verySmall` (see `pickOverall` in `fitCalculator.ts`).
