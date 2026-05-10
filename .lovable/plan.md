# FIT Realism Patch — Body-Locked, Measurement-First

## Problem
The renderer ignores body↔garment measurement deltas and produces flattering "editorial" outputs even when a size is physically wrong (e.g. 95kg female + women's S hoodie still looks balanced). Sizes also look too similar across S/M/L/XL.

The math layer (`src/lib/sizing/*`, `src/lib/fit/regionFitEngine.ts`, `buildGarmentFitMap.ts`) already computes deltas reasonably. The break is at the **renderer prompt**: `fit-tryon-router` sends a soft styling brief instead of a strict fit directive, and the body proportions are not locked across size switches.

## Approach
Keep the existing sizing math. Add one new layer — a **FitRenderDirective** — that converts deltas into hard visual rules, then rewrite the renderer prompts (Lovable AI + Replicate fallback) to obey it. Lock the body silhouette so only the garment changes between sizes.

## Changes

### 1. New: `src/lib/fit/fitRenderDirective.ts`
Pure function. Input: `ResolvedBody` + `GarmentSizeProfile` + `cutType` + `gender`. Output:
```
{
  fitClassification: "impossible" | "veryTight" | "tight" | "regular" | "relaxed" | "oversized" | "extremelyOversized",
  chestDeltaCm, shoulderDeltaCm, sleeveDeltaCm, lengthDeltaCm, waistDeltaCm,
  tensionLevel: 0..1,        // pulling, stretched fabric
  drapeLevel: 0..1,          // hanging fabric volume
  oversizedLevel: 0..1,
  visualRules: string[]      // hard imperatives for the renderer
}
```
Thresholds match the spec (chest -8/-3/+4/+10/+18/+28, shoulder -4/-1/+2/+6, length -8/-2/+5/+12). Cut-type adjusts intent baseline (oversized expects +18, slim expects +4).

### 2. Default size tables: `src/lib/sizing/genderedDefaults.ts`
Separate men/women/unisex × tops/bottoms × cut (slim/regular/relaxed/oversized/boxy/cropped). Used only when product chart is missing. Replace any unisex S/M/L fallback paths.

### 3. Renderer prompt rewrite: `supabase/functions/fit-tryon-router/index.ts`
- Inject the `FitRenderDirective` into both Lovable AI and Replicate prompt builders.
- New prompt structure (fixed sections):
  1. **BODY (LOCKED)** — exact cm values, mass cue, "do not slim, do not idealize, do not reshape across sizes".
  2. **GARMENT (size X)** — measurements + cut type.
  3. **FIT TRUTH** — classification + every visualRule as an imperative ("hem rides up 4cm", "shoulder seam pulled inward", "sleeves stack at wrist", "fabric tension across bust").
  4. **HARD CONSTRAINTS** — "If size is veryTight or impossible, the garment MUST visibly fail. Do not produce a flattering silhouette. Do not crop tension out of frame."
- Remove "editorial / premium / fashion-forward" language from the base prompt.
- Pass a `bodySignatureSeed` derived from body cm values so the same body renders consistently across S/M/L/XL switches.

### 4. Body lock in client: `src/hooks/useFitTryOn.ts` / FitResults
- Compute directive client-side from `ResolvedBody` + chosen size; pass full directive in the edge call (router no longer guesses).
- When user toggles size, only the garment payload changes; body payload + seed stay identical.

### 5. UI: `src/components/fit/FitResults.tsx`
Keep current minimal premium look. Replace the fit caption with directive-driven copy:
- Label: one of `Too tight` / `Tight` / `Close fit` / `Best balance` / `Relaxed` / `Oversized` / `Too large`
- One-line guidance: derived from classification + recommended alt size.
- Move all deltas/measurements into the existing "Analyze" disclosure (no new UI surface).

### 6. Trust rule enforcement
In `recommend.ts`: if directive says `impossible`/`veryTight`, mark size as `unwearable: true`. UI shows a small "wrong size" tag and never calls it a recommended pick.

## Out of scope
- No changes to body scan, body_profiles schema, or the working IDM-VTON Replicate path itself (only its prompt).
- No changes to OOTD / Shorts / Stories.
- No new dependencies.

## Risk
Renderer behavior depends on the model honoring constraints. Mitigation: hard imperative phrasing + negative constraints + lower temperature (0.4) + retry once with stricter prompt if validator (existing `validateFitImage`) flags the output as too flattering for a `veryTight` directive.

## Files touched
- new: `src/lib/fit/fitRenderDirective.ts`, `src/lib/sizing/genderedDefaults.ts`
- edit: `supabase/functions/fit-tryon-router/index.ts` (prompt builders only)
- edit: `src/hooks/useFitTryOn.ts` (pass directive + seed)
- edit: `src/components/fit/FitResults.tsx` (caption + unwearable tag)
- edit: `src/lib/sizing/recommend.ts` (unwearable flag)
- edit: `src/lib/fit/regionFitEngine.ts` (use new thresholds if currently softer)
