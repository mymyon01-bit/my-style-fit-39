
# MYMYON FIT V3 — Global Upgrade Plan

This is an **overwrite/upgrade**, not a rebuild. The locked working pipeline (`fit-generate-v2` → `fit-tryon-router` → Replicate IDM-VTON, canvas hooks, `fit_generations_v2` cache) stays intact. Auth, scraping, discovery, DB schema unchanged. Only the FIT logic, prompts, gating, and UX change.

Core philosophy applied everywhere: **"The body never changes. Only the clothes change."**

---

## Section A — FIT Result page cleanup (Sections 1, 2, 10)

File: `src/components/fit/FitResults.tsx` (+ `FitPage.tsx` host)

- Remove all recommendation/related/"you may also like" blocks from the result page. Keep only:
  - Body + garment composite (`FitVisual`)
  - Selected size + multi-size compare (S/M/L/XL)
  - Fit analysis panel (chest / waist / shoulder / sleeve / inseam / rise tension + oversized level), minimal monochrome indicators (no colorful bars)
  - **ANALYZE** button (re-runs `fit-vision-analyze` for the current body+garment+size)
  - **CHANGE BODY** button → opens `BodySwitcherSheet` modal
- New component `BodySwitcherSheet.tsx`:
  - Tabs: Saved bodies · Upload new · Manual edit · Gender / physique preset
  - On confirm: updates `body_profiles` row (or selects active body) and triggers regenerate via existing `useCanvasTryOn` / `fit-generate-v2` with the SAME `productKey` + `selectedSize`.

## Section B — Force Body Setup before any try-on (Section 3)

Entry points to gate: Discover product card "TRY ON", `ProductDetailSheet` "TO SHOWROOM"-area try-on CTA, `FitTryOnTrigger` mount.

- New page `src/pages/BodySetupPage.tsx` (route `/fit/setup?productKey=…&size=…&next=/fit`).
- New guard helper `requireBodySetup(navigate, ctx)` in `src/lib/fit/bodySetupGuard.ts`:
  - Reads `body_profiles` for the user (or guest local cache).
  - If missing required fields (height, weight, gender, body type, shoulder, waist, hip, chest, leg ratio, front photo) → push to `BodySetupPage` with `next` param.
  - Else → continue to size selection / generation.
- New flow: `Discovery → TRY ON → BodySetupPage (if needed) → Body Confirmation → Size Selection → Generate → FitResults`.
- Body Setup page sections:
  1. Measurements (height, weight, gender, body type, shoulder, waist, hip, chest, leg ratio)
  2. Photos (front required, side required, back optional)
  3. Optional: body-fat distribution, posture, oversized/tight preference
- Persists to `body_profiles` + `body_scan_images`.

## Section C — Body DNA Lock (Sections 4, 8)

The core fix for "S/M/L changes the body".

New module `src/lib/fit/bodyDNA.ts` and edge fn updates in `supabase/functions/fit-generate-v2/index.ts`:

- `extractBodyDNA(userId)` → returns canonical signature:
  ```
  { shoulderCm, chestCm, waistCm, hipCm, inseamCm, bodyShape,
    posture, bodyFatDistribution, frontPhotoUrl, sidePhotoUrl,
    skeletonKeypoints, silhouetteMaskUrl, signatureHash }
  ```
- Stored on `body_profiles` (no schema change needed — fits in existing columns + `body_landmarks` jsonb).
- `fit-generate-v2` cache key becomes `(body_signature, product_key, size_label)` — body_signature deterministic so same body always reuses cached body composite.
- `buildPrompt` rewrite: clamp body description with explicit negative directives:
  > "Preserve subject identity, body proportions, height, weight, posture, and skin tone EXACTLY as in reference photo. DO NOT slim, beautify, reshape torso/waist/hips/legs/face. Only the GARMENT changes between sizes. Replicate IDM-VTON receives the same body image and pose for every size; only the garment input varies."
- Router (`fit-tryon-router`): always send the same `human_img` (locked body composite) regardless of size. Only `garm_img` varies.

## Section D — Garment extraction + size-driven physics (Sections 5, 6, 7, 9)

New: `src/lib/fit/garmentDNA.ts` + edge fn `garment-dna-extract` (or extend existing `garment-size-fetch` + `cutout-product`):

- Extract per garment: silhouette, sleeve length, intended fit (slim/regular/oversized), fabric stiffness/elasticity/thickness, drape, taper.
- Persist alongside `garment_measurements`.
- Fit calc (`src/lib/fit/regionFitEngine.ts` + new `fitPhysics.ts`): `delta = garmentCm − bodyCm` per region drives:
  - tension (chest/waist/shoulder/sleeve) → wrinkle/stretch hints
  - drape (oversized) → fold + dropped-shoulder hints
  - fabric modifier per type (cotton/denim/knit/hoodie)
- Fed into `buildPrompt` as structured directives so Replicate produces realistic deformation **on the locked body**.
- Accessories (bag, hat, belt, sunglasses, jewelry): new branch `accessoryFit.ts` — scale relative to body, **never auto-upscale**. Rendered via canvas overlay rather than IDM-VTON.

## Section E — Intro / onboarding restoration (Section 11)

- New `src/components/intro/IntroSlides.tsx` shown on first launch + accessible from `/about`:
  1. AI Fit Try-On
  2. Size Analysis
  3. Body-Based Recommendation
  4. Discovery
  5. Multi-Size Preview
- Style: Playfair display headings, Inter body, monochrome with muted purple accent — Apple/SSENSE editorial.
- Mount in `WelcomeTour` flow; gate with `localStorage.mymyon_intro_seen_v3`.

## Section F — Mobile UX + perf (Sections 12, 13)

- `FitResults` mobile layout: full-bleed body composite, sticky bottom bar `[ANALYZE] [CHANGE BODY] [SIZE: M ▾]`, swipeable size chips.
- Pre-warm: `FitTryOnTrigger` already mounts canvas pipeline — extend to also pre-fetch garment DNA + cached body composite.
- Retry handling: on `fit-generate-v2` "partial"/"error", auto-retry once with router fallback then surface non-blocking inline "Re-render" chip.
- Caching: reuse `fit_generations_v2` by new cache key; bump version tag `v3` so old entries don't pollute.

## Section G — Preserve

Untouched: auth, Discover/scraping pipeline, Showroom, OOTD, notifications, subscription, `supabase/integrations/*`, all DB schemas (only data writes via existing tables).

---

## Technical summary

| Area | Files |
|---|---|
| Result UI | `src/components/fit/FitResults.tsx`, `FitPage.tsx`, new `BodySwitcherSheet.tsx`, new `FitAnalysisPanel.tsx` |
| Setup gate | new `src/pages/BodySetupPage.tsx`, new `src/lib/fit/bodySetupGuard.ts`, route in `App.tsx`, callsites in Discover/`ProductDetailSheet`/`FitTryOnTrigger` |
| Body DNA | new `src/lib/fit/bodyDNA.ts`, edits in `supabase/functions/fit-generate-v2/index.ts`, `fit-tryon-router/index.ts` |
| Garment DNA + physics | new `src/lib/fit/garmentDNA.ts`, new `src/lib/fit/fitPhysics.ts`, new `src/lib/fit/accessoryFit.ts`, edits in `regionFitEngine.ts` |
| Intro | new `src/components/intro/IntroSlides.tsx`, mount in `WelcomeTour` |

No DB migrations required — existing `body_profiles.body_landmarks` jsonb + `garment_measurements.raw_extraction` jsonb absorb the new metadata.

---

## Open question before I start

The plan is large (~12 new/edited frontend files + 2 edge-function rewrites). Two ways to land it:

**A) Single big PR** — everything in one pass, one preview cycle.
**B) Phased** — (1) Body-Lock prompt + cache key in `fit-generate-v2` (immediate visual fix), (2) Force Body Setup gate + Change Body button, (3) Garment physics + accessory branch, (4) Intro restoration + result-page cleanup.

Phased is safer because each phase is independently verifiable in preview. Reply **A** or **B** (default: B) and I'll execute.
