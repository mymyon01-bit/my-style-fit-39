---
name: Per-size visual differentiation + baseline guard
description: Canvas warp + faceless-mannequin prompt + gender/weight baseline. XL never looks like S, body never resizes, wrong sizes show physical consequences.
type: feature
---

# FIT visual: differentiation + baseline + faceless render

## Pipeline (locked)
1. `useSizeRecommendation` → `OverallFitLabel` for active size.
2. `FitResults` computes `baselineFitVerdict` (gender + weight → expected size) via `src/lib/fit/sizeBaseline.ts`. The verdict + a one-line `consequence` is forwarded to `useFitTryOn → fit-tryon-router`.
3. Edge prompt (`buildCleanStudioPrompt` in `fit-tryon-router/index.ts`) injects:
   - **Faceless render** (no face, no features, mannequin head OR neck-down crop).
   - **Body gender lock** (from BODY tab only, never the garment).
   - **Strict physical specs** (height/weight/BMI; extends monotonically beyond typical ranges).
   - **Locked body across sizes** — only fabric behavior changes.
   - **Baseline consequence sentence** — e.g. 100kg user wearing S = "fabric pulled taut, visible stress folds, garment looks compressed and undersized".
   - **Bag category branch** — accessory scales relative to body, not size letter.
4. `FitImageCanvas` applies `SizeWarpProfile` from `sizeWarpProfile.ts`. Magnitudes were strengthened so XL ≠ S even when AI ignores hints (scaleX 0.84–1.30, hemDrop -22…+56).

## BODY tab = source of truth
- Weight slider 35–180 kg (no upper clamp on the prompt either).
- "LOAD FROM PROFILE" button on the Weight row re-runs `loadSavedProfile()`.
- "Next: Check" persists `gender_preference` + `body_profiles` before nav.
- `bodyGender` flows from BODY tab → `FitResults` → `FitVisual` silhouette + `bodyProfileSummary.gender` → prompt.

## Hard rules
- Head band stays unwarped in the canvas.
- Body NEVER resizes between sizes — clothing adapts.
- If even the largest baseline size is too small (offset ≥ 2), the prompt forces "way-too-tight" consequence — never "perfect fit" language.
- Bags scale to body, not size letter.
- Faceless / no identity, always.

Files: `src/lib/fit/sizeBaseline.ts` (NEW), `src/lib/fit/sizeWarpProfile.ts`, `src/components/fit/FitImageCanvas.tsx`, `src/components/fit/FitVisual.tsx`, `src/components/fit/FitResults.tsx`, `src/components/fit/FitMeasurements.tsx`, `src/pages/FitPage.tsx`, `src/hooks/useFitTryOn.ts`, `src/hooks/useReplicateTryOn.ts`, `supabase/functions/fit-tryon-router/index.ts`.
