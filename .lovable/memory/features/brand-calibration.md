---
name: Brand sizing calibration layer
description: Real-world brand-specific size adjustments (Zara runs small, Nike runs large) layered on top of the base sizing engine. Correction only, never replacement.
type: feature
---

# Brand calibration

Lives in `src/lib/sizing/brandCalibration.ts`. Pure correction layer applied AFTER the base chart is built (in `loadGarmentChart`) and AFTER fit calculation (size-bias shift in `recommend.ts`).

## Profile shape
Per `BrandFitProfile`: `chestAdjustment`, `waistAdjustment`, `shoulderAdjustment`, `hipAdjustment` (cm, ±3 max), `fitBias` (`runs_small | true_to_size | runs_large`), and optional `categoryOverrides` keyed by `SizingCategory` (e.g. Nike hoodies +3cm chest, Zara jackets −2cm shoulder).

## Pipeline
1. `loadGarmentChart` builds the base chart, then calls `applyBrandCalibration(chart, brand)` which mutates each size's chest/waist/shoulder/hip if known. Unknown brand → no-op.
2. `buildRecommendation` reads `chart.brandCalibration.fitBias`. If chart confidence is low/medium AND primary's overall is borderline (`fitted | regularFit | relaxedFit`), shifts the primary by ±1 neighbour (runs_small → up, runs_large → down). Old primary becomes alternate. Never shifts into `verySmall`/`tooLarge`.
3. Confidence bumps `low → medium` (never `medium → high`) when calibration is active.
4. `SizeRecommendation.brandCalibration` carries `{ brand, fitBias, adjustments, sizeShifted }` to the UI.

## Hard failsafes
- Adjustments clamped to ±3 cm per region.
- Bias-shift skipped when chart confidence is `high` (strong base data wins).
- Bias-shift skipped for `verySmall` / `tightFit` / `oversizedFit` / `tooLarge` primaries — those verdicts are too clear to override.
- Shift never jumps more than one neighbour.
- Out-of-range (`tooSmall`/`tooLarge`) recommendations skip the shift entirely.

## UI
`SizeRecommendationPanel` shows an accent banner: "Calibrated for {brand} — runs small/large/true to size (suggested ±1 size shift applied)" when `recommendation.brandCalibration` is set.

## Future
Per-brand learned offsets from user feedback ("felt tight", "too big") would be stored in DB and merged on top of the static profile table. Out of scope for the initial implementation.
