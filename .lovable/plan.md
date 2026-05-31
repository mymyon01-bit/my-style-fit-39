# MYMYON FIT — Global Body-Locked Engine Rebuild

## Goal
Replace the current label-influenced / "safe-larger" sizing with a strict measurement-driven engine where: **locked body − garment dims → delta → ease target → score → classification → render directive**. Size labels (S/M/L/XL) are names only.

## Architecture (new files under `src/lib/sizing/v3/`)

```text
src/lib/sizing/v3/
  bodyProfile.ts        # LockedBodyProfile builder (immutable)
  garmentProfile.ts     # GarmentProfile per size, fallback tables
  easeTargets.ts        # category × cut × stretch → target ease ranges
  deltas.ts             # per-region delta calculators (top/dress/pant)
  fitScore.ts           # penalty model + classification
  recommend.ts          # picks best-balance size, never "biggest safe"
  renderDirective.ts    # FitRenderDirective from score
  index.ts              # public API: computeFit(body, product) → V3FitResult
```

Existing `src/lib/sizing/*` (bodyResolver, garmentChart, fitCalculator, recommend, brandCalibration, feedback) becomes the **data layer** — v3 consumes its outputs but applies new ease/score/classification logic. We do **not** touch the visual try-on pipeline contracts; we change what they receive.

## Step-by-step

### 1. LockedBodyProfile (`bodyProfile.ts`)
- Input: existing `ResolvedBody` from `bodyResolver.ts`.
- Adds: `armLengthCm`, `torsoLengthCm`, `bodyShape`, `genderProfile` (estimated from H/W/gender if missing — reuse `anthropometry.ts`).
- Output frozen object (`Object.freeze`). Same instance reused across all sizes for a product.
- No mutation, no per-size variant.

### 2. GarmentProfile (`garmentProfile.ts`)
- Pulls per-size measurements from `garmentChart.ts` (already loads from `garment_measurements` + brand calibration).
- Adds normalized fields per category:
  - tops: chest/shoulder/sleeve/length/hem
  - dresses: bust/waist/hip/length/strap
  - pants: waist/hip/thigh/rise/inseam/legOpening
- Fallback: gender-aware MEN/WOMEN tables in `categoryRules.ts` keyed by `(gender, category, cut)` — never one universal table.
- Carries `cutType`, `stretchLevel`, `fabricWeight` (default per category if not set).

### 3. Ease targets (`easeTargets.ts`)
Pure data module. `getEaseTarget(category, cut, stretch, region) → {min, max}` with the spec's ranges (slim top +2/+6, regular +6/+12, relaxed +12/+20, oversized hoodie +18/+30, bodycon −2/+3, slip dress bust +3/+8 etc., pants waist 0/+4, hip +4/+10, thigh +3/+8). Stretch + fabric weight modifiers shift the window.

### 4. Deltas (`deltas.ts`)
`computeDeltas(body, garmentSize, category) → Record<Region, number>`. Pure subtraction, no clamping.

### 5. FitScore + classification (`fitScore.ts`)
For each region: `regionPenalty = distanceOutsideTarget² × regionWeight`. Asymmetric — too-tight on chest weighted heavier than too-loose; too-loose on shoulder weighted heavily; length given moderate weight.
`fitScore = Σ regionPenalty`. Lower = better.
Classification from worst region delta vs target:
- delta < target.min − 4 → **Too Small**
- delta < target.min       → **Tight**
- delta in [min, min+(max−min)/3] → **Close Fit**
- delta in middle third → **Best Balance**
- delta in upper third → **Relaxed**
- delta > max          → **Oversized**
- delta > max + 8      → **Too Large** / **Not Recommended**

### 6. Recommend (`recommend.ts`)
- Score every size.
- `primary = argmin(fitScore)` — strictly closest to ease target. Never "largest safe size".
- `alternate = next-best of opposite direction` for user choice.
- If even best is `Too Small` / `Too Large` → set `rangeStatus` and surface honest "no good size" warning.
- Apply user `fitPreference` only as a **tiebreaker** (shifts target window ±2cm), never overrides classification truth.

### 7. RenderDirective (`renderDirective.ts`)
Builds `FitRenderDirective` from `{lockedBody, selectedSize, classification, regionDeltas}` with discrete levels: `tightnessLevel`, `loosenessLevel`, `shoulderDropLevel`, `fabricTensionLevel`, `drapeLevel`, `sleeveStackLevel`, `hemLiftLevel`, `lengthExcessLevel`, `compressionZones[]`, `looseZones[]`. This object is what `fit-tryon-router` already consumes (Phase 1 V3 preamble) — we now feed it from real numbers instead of hand-tuned strings.

### 8. Wire-up
- `src/hooks/useSizeRecommendation.ts` → call `computeFit` from `v3/index.ts` instead of legacy `recommend`.
- `src/components/fit/FitResults.tsx` → already simplified (Phase 2). Map v3 classification → existing `heroFitType` label + 1-sentence guidance. Detail panel reads v3 region deltas.
- `supabase/functions/fit-tryon-router/index.ts` → accept `renderDirective` payload from client; prompt builder uses directive levels (tightness/looseness/shoulder-drop) verbatim instead of recomputing from BMI strings.

### 9. Quality gate (server)
In `fit-tryon-router`, after Gemini returns: if classification=`Too Small` but image looks balanced (no fabric tension keywords echoed back) → retry once with stricter directive. Reject if size mismatch can't be reconciled, fall back to schematic fit visualization.

### 10. Tests (`src/lib/sizing/v3/__tests__/scenarios.test.ts`)
The 6 acceptance scenarios from the spec (A–F): female 167/47, female 167/95, male 178/72, male 170/100, slim-female-mens-oversized-hoodie, large-female-womens-S-dress. Each asserts the classification per size matches the spec.

## What is NOT changed
- DB schema (garment_measurements, fit_feedback, brand_fit_profiles untouched).
- Auth, IDM-VTON path, image upload.
- `FitResults.tsx` layout (Phase 2 already done) — only the data source changes.
- V3 BODY-LOCK preamble in edge function (Phase 1) stays; directive now feeds real numbers into it.

## Order of execution
1. Build v3 modules + scenario tests (TDD on the 6 cases).
2. Swap `useSizeRecommendation` to v3 behind a feature check (instant rollout, legacy kept for one revision).
3. Update `FitResults` mapping + detail panel to v3 fields.
4. Update `fit-tryon-router` to consume `renderDirective` levels.
5. Add server-side classification/image consistency gate.

## Risks
- Ease target tuning will need 1–2 iterations against real products; ranges in spec are starting values.
- Brand calibration (`brandCalibration.ts`) currently shifts garment cm — keep it; v3 reads post-calibration numbers.
- Falling back to category defaults when product has no measurements still happens — v3 marks confidence `low` exactly as today.
