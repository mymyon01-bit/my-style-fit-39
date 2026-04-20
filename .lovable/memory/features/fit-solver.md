---
name: FIT Solver Architecture
description: Deterministic FitSolver is source of truth — drives score, region labels, summary, and AI image prompt hints
type: feature
---
## FitSolver — Deterministic Core

**File**: `src/lib/fit/fitSolver.ts` — single source of truth for FIT.

### Pipeline (strict order)
1. user inputs → `buildBodyShapeScales` → `buildBodyProfile` (BodyProfile)
2. product + size + body → `buildGarmentFitMap` (GarmentFitMap with eases)
3. body + fit + category + size → `solveFit` → **SolverResult**
4. `SolverResult.visualPromptHints` → `buildFitGenerationPrompt({ solverHints })`
5. UI consumes SolverResult for score, fitType, summary, breakdown

### SolverResult shape
- `overallScore` (0–100, weighted by region scores)
- `fitType`: trim | regular | relaxed | oversized
- `silhouette`: trim | fitted | regular | relaxed | oversized (raw)
- `recommendation`: best | good | acceptable | not_recommended
- `regions`: chest/waist/shoulder/length/sleeve, each with `{ delta, fit }`
- `summary`: human paragraph (size-explicit)
- `visualPromptHints`: imperative phrases injected into image prompt

### Region label vocab (NOT same as legacy fitEngine)
- chest: tight | snug | balanced | roomy | oversized
- waist: tight | clean | balanced | relaxed | loose
- shoulder: pulled | structured | natural | dropped
- length: short | slightly_short | regular | slightly_long | long
- sleeve: tight | trim | regular | loose

### UI integration
- `FitResults.tsx`: uses `solver.fitType`, `solver.silhouette`, `solver.summary`
- `FitBreakdown.tsx`: 5-cell grid driven by `solver.regions` (hides chest/shoulder/sleeve for bottoms)
- `useAiTryOn.ts`: passes `solver.visualPromptHints` to `buildFitGenerationPrompt` for both main + prewarm paths

### Score weights
- Tops: chest 32% / waist 22% / shoulder 22% / length 14% / sleeve 10%
- Bottoms: waist 35% / hip(≈chest) 30% / length 25% / shoulder placeholder 10%

### Fallback rule
If image generation fails, `SolverResult` still renders fully (score, breakdown, explanation). Image is the visualization layer only.
