---
name: FIT pipeline working model (baseline)
description: Locked baseline for the FIT try-on pipeline. Roll back here when user says "go back to working model".
type: feature
---

# FIT Pipeline — WORKING MODEL (locked baseline)

When the user says "recall working model" / "roll back to working FIT" / "go back to working model", restore the FIT pipeline to this exact configuration.

## Core architecture (DO NOT CHANGE)
- Edge function: `supabase/functions/fit-generate-v2/index.ts`
  - 4-step pipeline: `calculateFit` → `interpretFit` → `buildPrompt` → `generateImage`
  - Delegates final image to `fit-tryon-router` (Replicate IDM-VTON). Never uses Gemini for FIT images.
  - Never returns 504 — always returns JSON payload with status "success" | "partial" | "error".
  - Cache table: `fit_generations_v2` (cache_key, body_signature, product_key, size_label).
- Router: `supabase/functions/fit-tryon-router/index.ts` — Replicate IDM-VTON only.
- Frontend trigger: `src/components/fit/FitTryOnTrigger.tsx` (pre-warms canvas pipeline).
- Visual fallback: `src/components/fit/VisualFitCard.tsx` (mannequin SVG + garment overlay) and `FitVisual` (canvas composite).
- Hooks: `useCanvasTryOn`, `useFitTryOn`, `useReplicateTryOn`.

## Required behavior
- Body proportions MUST stay identical across size variations — only the garment changes.
- Fit translates to fabric behavior (tension/folds/drape/hem), never body resizing.
- Cache by (user body signature, product key, size).
- Pre-warm canvas composite before user opens RESULTS tab.

## Prompt evolution
The `buildPrompt` function in `fit-generate-v2/index.ts` is the only piece that evolves with user feedback (mannequin vs realistic, etc). The pipeline shape above is the locked baseline.
