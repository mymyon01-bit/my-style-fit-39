---
name: Per-size visual differentiation + baseline guard + mannequin lock
description: Faceless mannequin visual lock, canvas warp, gender/weight baseline. ALL FIT images render as a consistent faceless display mannequin — never a real human.
type: feature
---

# FIT visual: faceless mannequin + differentiation + baseline

## Visual model type lock (HARD RULE)
Every FIT image MUST render as a **faceless display mannequin** — smooth matte fiberglass/plastic store dummy. No real humans, no faces, no hair, no skin detail, no lifestyle/editorial/influencer photography. Either smooth featureless mannequin head OR neck-down crop. Enforced via `MANNEQUIN_STYLE_LOCK` + `MANNEQUIN_NEGATIVES` constants in `supabase/functions/fit-tryon-router/index.ts`. Model-type consistency overrides photographic realism.

## Pipeline (locked)
1. `useSizeRecommendation` → `OverallFitLabel` for active size.
2. `FitResults` computes `baselineFitVerdict` (gender + weight → expected size) via `src/lib/fit/sizeBaseline.ts`. Verdict + `consequence` forwarded to `useFitTryOn → fit-tryon-router`.
3. Edge prompt (`buildCleanStudioPrompt` in `fit-tryon-router/index.ts`) injects:
   - **Mannequin style lock** (faceless display dummy, no human).
   - **Mannequin gender lock** (from BODY tab only, never the garment).
   - **Mannequin proportions** (height/weight/BMI sculpted into the form; extends monotonically beyond typical ranges).
   - **Locked mannequin across sizes** — only fabric behavior changes.
   - **Baseline consequence sentence** — e.g. 100kg user wearing S = "fabric pulled taut, visible stress folds, garment looks compressed".
   - **Per-size silhouette differentiation** — S tight / M fitted / L regular / XL+ oversized; differences visible at chest, shoulders, waist, sleeve width, length.
   - **Bag category branch** — accessory scales relative to mannequin, not size letter.
4. `FitImageCanvas` applies `SizeWarpProfile` from `sizeWarpProfile.ts` (scaleX 0.84–1.30, hemDrop -22…+56) so XL ≠ S even if AI ignores hints.
5. Client-side quality gate (`validateFitImage.ts`) auto-retries once with `safeMode=true` if output is malformed/blank/low-res.

## BODY tab = source of truth
- Weight slider 35–180 kg (no upper clamp on the prompt either).
- "LOAD FROM PROFILE" button on Weight row re-runs `loadSavedProfile()`.
- "Next: Check" persists `gender_preference` + `body_profiles` before nav.
- `bodyGender` flows from BODY tab → `FitResults` → `FitVisual` silhouette + `bodyProfileSummary.gender` → mannequin gender lock.

## Hard rules
- Faceless mannequin ALWAYS — never a real person, never a half-human/half-mannequin hybrid.
- Mannequin body NEVER resizes between sizes — clothing adapts.
- Same mannequin base across all sizes; only garment + fabric behavior differ.
- If even the largest baseline size is too small (offset ≥ 2), prompt forces "way-too-tight" — never "perfect fit" language.
- Bags scale to mannequin, not size letter.

Files: `src/lib/fit/sizeBaseline.ts`, `src/lib/fit/sizeWarpProfile.ts`, `src/lib/fit/validateFitImage.ts`, `src/components/fit/FitImageCanvas.tsx`, `src/components/fit/FitVisual.tsx`, `src/components/fit/FitResults.tsx`, `src/components/fit/FitMeasurements.tsx`, `src/pages/FitPage.tsx`, `src/hooks/useFitTryOn.ts`, `src/hooks/useReplicateTryOn.ts`, `supabase/functions/fit-tryon-router/index.ts`.
