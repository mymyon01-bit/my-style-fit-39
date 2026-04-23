---
name: Measurement-driven sizing engine
description: src/lib/sizing/ pipeline — body+garment+brand calibration+feedback learning. Locked FIT visual pipeline untouched.
type: feature
---

# Sizing Engine (measurement-driven)

Lives entirely under `src/lib/sizing/` + `useSizeRecommendation` hook + `SizeRecommendationPanel` UI. Parallel to (does NOT replace) the locked FIT visual try-on pipeline.

## Pipeline (mandatory order, per final spec)
1. **bodyResolver.ts** — merges user body data with `anthropometry.ts` estimates. Two-axis BMI model: height drives length, weight drives volume. Each value tagged `exact | inferred | default`.
2. **garmentChart.ts** — loads ALL sizes from `garment_measurements`; on-demand scrape if empty; falls back to gender-aware MEN/WOMEN XS–XL standard tables in `categoryRules.ts`.
3. **brandCalibration.ts** — loads `brand_fit_profiles` row + aggregates `fit_feedback` for that brand×category. Per-region cm offset capped ±5cm, requires ≥5 feedback rows before learning fires. Applied to every size in `buildChart`.
4. **fitCalculator.ts** — per-size, per-region status with `applyExtremeRules` guard (garment <body−10cm → verySmall; >body+ease+22 → tooLarge). `smoothAdjacentSizes` enforces monotonic progression.
5. **recommend.ts** — primary + alternate based on preference; `detectRangeStatus` pins to boundary + forces low confidence when nothing fits.
6. **feedback.ts** — `submitFitFeedback` writes user vote (too_small/perfect/too_large + region areas) into `fit_feedback` for the next learning pass.

## Visual pipeline (LOCKED)
- `fit-generate-v2` builds a faceless-mannequin prompt with BMI-driven body description; passes calculated regions to IDM-VTON via `fit-tryon-router`.
- Body identity locked across sizes; only garment changes.

## UI
- `SizeRecommendationPanel` shows confidence/gender chips, recommended/alternate, per-size table, fit-preference toggle, range/calibration warnings, and `FitFeedbackWidget` (3 thumbs + region tags).
- `InferredMeasurementsBanner` surfaces estimated fields.

## Hard rules
- Never label a size "perfect" if measurements don't support it.
- Always surface inferred-vs-exact provenance.
- Brand calibration: shifts garment numbers ONLY, never body. Max ±5cm/region.
- Learning: min 5 feedback rows per brand+category; each net vote ≈ 0.4cm.
- Adjacent-size monotonicity enforced (no S=verySmall → M=regularFit jumps).
- Out-of-range: `rangeStatus` + red banner when even largest/smallest size won't fit.
