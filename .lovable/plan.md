
# MYMYON FIT V3 — Realistic Fit System Rebuild

The spec is large enough that shipping it in one go would break the live FIT flow for several days. I'll cut it into 3 reviewable phases. Each phase is independently usable — you can stop after any phase.

A lot of V3 already exists in the codebase (gendered charts, per-region cm deltas, fit classifier, recommendation reasoning, Analyze-style detail panel). The real gaps are: (1) the renderer still subtly reshapes the body between sizes, (2) the Final FIT page is too dense, (3) no quality gate before display, (4) no result cache keyed on body+product+size.

---

## Phase 1 — Body Lock + Render Directive (ship first)

Goal: stop the renderer from beautifying or reshaping the body. Same body across S/M/L/XL, only garment changes.

1. **Build a single `FitRenderDirective`** in `supabase/functions/fit-tryon-router/index.ts` that bundles every locked field (body profile, garment cm, deltas, actual vs intended fit, per-region behavior). Used by both the Lovable-AI Gemini path and the Replicate fallback so they speak the same language.
2. **Replace ad-hoc prompt fragments** with one front-loaded BODY-LOCK block at the very top of the prompt:
   - body silhouette, mass, posture, waist/hip/shoulder/arm volume are LOCKED across all sizes
   - explicit anti-beautification negatives (no slimming, no hourglass reshape, no fashion-model proportions, no waist narrowing, no leg lengthening)
   - plus-size realism clause for BMI ≥ 28 (visibly heavier, fuller midsection, thicker limbs — never converted to influencer body)
   - "garment adapts to body, body NEVER adapts to garment"
3. **Per-size variation rule**: only fabric behavior differs between sizes — pose, camera, lighting, mannequin proportions stay byte-identical. Add to the front of the prompt, not the tail.
4. **Compression / oversized visualization rules**: tight → stretched fabric, tension lines, lifted hem, side pulling. Loose → hanging volume, dropped shoulder, sleeve stacking. Already partially present — consolidate and front-load.
5. **Strict realism mode**: shift renderer priority from "aesthetic fashion image" to "accurate body-relative fit visualization" via an explicit single-line directive that overrides all other style cues.

Files: `supabase/functions/fit-tryon-router/index.ts` only.

---

## Phase 2 — Final FIT Page Simplification + Analyze Panel

Goal: clean premium fit page; technical detail moves into Analyze.

1. **Final fit page** (`src/components/fit/FitResults.tsx`):
   - Large fit render
   - Product name
   - Selected size + size selector
   - One fit label (Too tight / Close fit / Best balance / Relaxed / Oversized)
   - One short guidance sentence
   - "Analyze" button
   - Remove visible debug pills, region chips, raw cm tables from the main view
2. **Analyze panel** (existing `TryOnPreviewModal` or new `FitAnalyzePanel`): body cm, garment cm, every delta, fabric/cut, confidence, why this size was classified this way, recommended size reasoning. All existing data — just relocated.
3. **Copy** matches the spec examples ("Too tight on your body. Try L for a more natural fit." etc.) — wire to existing classification.
4. Keep existing i18n keys; add new keys for the simplified labels (en/ko/it/de/es/fr/ja/zh).

Files: `src/components/fit/FitResults.tsx`, new `src/components/fit/FitAnalyzePanel.tsx`, `src/locales/*/translation.json`.

---

## Phase 3 — Quality Gate, Cache, Progressive Loading

1. **Result cache**: store generated render in `fit_tryons` keyed by `(user_id, body_profile_hash, product_key, selected_size)`. Cache hit → instant show, no Replicate/Gemini call. Already partially present — tighten the lookup and add a `body_profile_hash` column.
2. **Adjacent size preload**: when user lands on size M, kick off background generation for S and L so switching feels instant.
3. **Quality gate** (server-side, before persisting to storage): reject render if Gemini fails to return an image, output is < 50KB, or aspect ratio is wrong. On reject → retry once with stricter directive, then fall back to the visual mannequin SVG with a "preview unavailable" note instead of a broken image.
4. **Progressive UI**: skeleton → low-res blurred preview (the cached previous size) → high-res swap when render resolves. Already partially present from earlier loading-animation work — extend it.

Files: `supabase/functions/fit-tryon-router/index.ts`, new migration adding `body_profile_hash` to `fit_tryons`, `src/hooks/useFitTryOn.ts`, `src/components/fit/FitResults.tsx`.

---

## What I will NOT change

- Existing sizing engine (`src/lib/sizing/*`) — already implements deltas, gender-aware charts, classification, recommendation. Spec Steps 2–7 are already there. I'll add small gaps (cut-type defaults for cropped/boxy/longline) only if Phase 2 surfaces a missing case.
- IDM-VTON path — kept as opt-in mode; default stays studio render.
- Auth, DB schema (except the cache-key column in Phase 3), other features.

## Recommendation

Start with **Phase 1** today. It's the only phase that fixes the "body keeps morphing" complaint, and it's a single-file change that ships in one round. Once you confirm the renders behave, I'll roll Phase 2 (UI), then Phase 3 (perf).

Approve this and I'll ship Phase 1 immediately.
