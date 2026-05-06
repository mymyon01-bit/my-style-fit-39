## MYMYON FIT V4.0 — Realtime Body-Lock + Speed Optimization

A focused, shippable plan that **keeps everything from V3.9** and layers on predictive prefetch, body-change invalidation, fast-preview rendering, request-priority cancellation, and prompt/cache cleanup. No rebuild.

---

### 1. New core modules (frontend)

```text
src/lib/fit/
  bodyDNA.ts              ← signature stable hash (measurements + gender + posture + image-hash + preset + editTs)
  bodyComposite.ts        ← LOCKED BODY BASE generator + cache (per body signature)
  fitCache.ts             ← unified cache key builder + reuse layer (garmentDNA, sizeCorrelation, prompts, processed images)
  fitPriorityQueue.ts     ← AbortController registry; "latest visible request wins"
  fitPrewarm.ts           ← background prepare orchestrator (Promise.all of all DNA/correlation/cutout work)
```

Existing `garmentDNA.ts`, `fitPhysics.ts`, `sizeCorrelationEngine.ts`, `fitQualityControl.ts`, `genderedSizeSystem.ts`, `brandFitBias.ts`, `accessoryFit.ts` stay; we only add cache wrappers + parallel callers.

---

### 2. Predictive preparation

`useFitPrewarm(productKey)` hook triggered from `ProductDetailSheet`:

Triggers (debounced 500ms):
- sheet open
- dwell > 1.5s
- image zoom
- size selector touch
- save tap
- repeat-view counter ≥ 2

Runs in parallel (`Promise.all`):
1. body DNA load + signature
2. body composite preload
3. garment DNA extract + cutout/mask
4. gendered size normalization
5. size correlation (per region)
6. brand fit bias lookup
7. URL/image resolution

Results stored in `fitCache` keyed by `body_signature + product_key`.

---

### 3. Body change invalidation

`ChangeBodySheet` and any body editor calls `invalidateBodyDNA()`:
- recomputes signature
- clears `fitCache` entries whose key starts with old signature
- triggers re-prewarm for current product

UI states added to `useFitTryOn`:
`body_current | body_changed | preparing_fit | generating_preview | generating_final | validating_result | result_ready | result_unstable`

---

### 4. Fast preview + final studio render

Two-phase render in `useFitTryOn`:

```text
TRY ON tap
 ├─ instant analysis (cached, ~0ms)
 ├─ fastPreview render  → low-step IDM-VTON pass via fit-tryon-router (mode: "preview")
 │     displays immediately; lastGoodImageUrl shown until ready
 └─ finalStudio render  → full pass via fit-generate-v2
       replaces preview when ready
       runs QC; on fail → 1 silent safeMode rerender; on 2nd fail → "FIT PREVIEW UNSTABLE"
```

Edge functions:
- `fit-tryon-router/index.ts` — accept `renderMode: "preview" | "final"`; in preview mode pass lower step count + skip heavy refinement.
- `fit-generate-v2/index.ts` — accept `bodyComposite` + `lockedBodySignature` so prompt skips repeating body description; trim verbose luxury prose; cap to ~7 prompt sections.

---

### 5. Request priority + cancellation

`fitPriorityQueue` registers an `AbortController` per request keyed by current visible size. New request → abort all stale; prewarm runs at lowest priority and is also abortable.

Applied in `useFitTryOn` and `useReplicateTryOn`.

---

### 6. Prompt cleanup (edge functions)

Strict prompt skeleton:
1. `BODY LOCK: signature=<hash>` (one line, replaces 3 prior lock lines)
2. body summary (1 line)
3. garment DNA (1 line)
4. gendered size context (1 line)
5. fit physics (1 line per active region, max 4)
6. generation directives (1 line)
7. negative prompt (1 line)

Removes: repeated lock lines, long luxury descriptions, duplicated warnings.

---

### 7. FitResults cleanup

Remove from `FitResults.tsx`:
- "you may also like" / related products
- duplicate Analyze buttons
- dead try-on branches
- stale state vars
- unused imports

Keep: body composite, FitAnalysisPanel, size chips, FitTrustStrip, Body Accuracy, Change Body, Analyze, Rerender.

---

### 8. Image standardization

`src/lib/fit/imagePrep.ts` (new):
- garment + body images normalized to ≤1024×1024 webp/jpeg
- content-hash cached in browser cache + Supabase storage
- garment cutouts/masks cached by content hash, not product id (so identical garments across products share cache)

---

### 9. Feedback persistence

Migration: add `target_gender`, `body_signature`, `selected_size`, `feedback_type` columns to `fit_feedback` (if missing). Used to evolve `brandFitBias` weighting.

---

### Files touched

**New (5)**: `bodyDNA.ts`, `bodyComposite.ts`, `fitCache.ts`, `fitPriorityQueue.ts`, `fitPrewarm.ts`, `imagePrep.ts`, `useFitPrewarm.ts`

**Edited (≈10)**: `useFitTryOn.ts`, `useReplicateTryOn.ts`, `ProductDetailSheet.tsx`, `FitResults.tsx`, `FitAnalysisPanel.tsx`, `ChangeBodySheet.tsx`, `garmentDNA.ts`, `fitQualityControl.ts`, `fit-generate-v2/index.ts`, `fit-tryon-router/index.ts`

**Migration (1)**: `fit_feedback` columns.

---

### Out of scope (deferred)

- Multi-size delta rendering (Section 11) — requires IDM-VTON pipeline changes; ship after V4.0 lands.
- Storage-side body composite reuse — start with in-memory + IndexedDB; migrate to bucket later.

---

### Performance targets after ship

| Phase | Target |
|---|---|
| Fit analysis visible | <200ms (cache hit) |
| Fast preview | 2–4s |
| Cold final render | <10s |
| Cache hit (same body+product+size) | instant |

---

### Confirm before I start

This is a 7-new + 10-edited-files change touching the live FIT pipeline. I will ship in this order so each phase is independently testable:

1. `bodyDNA` + `fitCache` + `fitPriorityQueue` (foundation)
2. `useFitPrewarm` + `ProductDetailSheet` triggers
3. Body-change invalidation in `ChangeBodySheet`
4. Two-phase render (preview → final) in `useFitTryOn` + edge router
5. Prompt cleanup in `fit-generate-v2`
6. `FitResults` cleanup + new UI states
7. `imagePrep` + feedback migration

Reply **OK** to proceed, or tell me which sections to drop/reorder.