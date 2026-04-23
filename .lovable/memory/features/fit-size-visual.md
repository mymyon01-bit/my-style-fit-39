---
name: Per-size visual differentiation
description: Canvas overlay applied on top of AI try-on image guarantees S/M/L/XL look visibly different even when AI ignores size hints. Body gender locked to user profile.
type: feature
---

# FIT visual: per-size differentiation + gender lock

## Why
Nano Banana / IDM-VTON ignore subtle size cues in the prompt — XL frequently looked identical to S. The AI image is now post-processed with a deterministic per-size silhouette warp so adjacent sizes are unambiguously different.

## Pipeline
1. `useSizeRecommendation` produces an `OverallFitLabel` for the active size (verySmall…tooLarge).
2. `FitResults` passes that label as `overallFit` into `FitVisual`.
3. `FitVisual` resolves it via `profileFromOverall()` → `SizeWarpProfile` (scaleX, scaleY, shoulderDropPx, hemDropPx, tension/drape opacity, silhouette label).
4. `FitImageCanvas` loads the AI url, draws head band (top 22%) un-warped, then redraws the body band with the warp + optional tension/drape lines.
5. Falls back to the size letter (XS→tightFit, XL→oversizedFit) when the new sizing engine hasn't produced a label yet.

Files:
- `src/lib/fit/sizeWarpProfile.ts` — pure profile lookup, no React.
- `src/components/fit/FitImageCanvas.tsx` — canvas component, falls back to `<img>` on draw failure.
- `src/components/fit/FitVisual.tsx` — accepts `overallFit?: OverallFitLabel | null`, swaps `<img>` for `<FitImageCanvas>`.
- `src/components/fit/FitResults.tsx` — wires `sizingActiveOutcome.overall` into `<FitVisual>`.

## Body gender lock
`fit-tryon-router/index.ts → genderLockLine` is now stronger: explicit anatomical anchors per gender + explicit "cross-gender wear ALLOWED, gender swap FORBIDDEN" so a male user wearing a women's top still renders as a male body.

## Hard rules
- Head band stays unwarped — face proportions never distort with size.
- Warp magnitudes are bounded (scaleX 0.92–1.18, scaleY 0.97–1.10) — realism preserved.
- If canvas draw fails, the raw AI `<img>` is shown — user always sees something.
- Never used to fake a "perfect fit" — warp matches the calculated overall label.
