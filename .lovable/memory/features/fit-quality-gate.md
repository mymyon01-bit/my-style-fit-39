---
name: FIT image quality gate + auto-retry
description: Client-side validation of AI fit images, with one auto-retry in safe mode before showing failure
type: feature
---

# FIT Image Quality Gate

The user must NEVER see a broken / blurry / blank / cropped fit image as the final result.

## Pipeline (do not change without recall)

1. `useFitTryOn` triggers `fit-tryon-router` (studio mode — Lovable AI Nano Banana, image-conditioned by product image).
2. On `succeeded` from the router, hook enters new stage `validating` and runs `validateFitImage(url)` in `src/lib/fit/validateFitImage.ts`.
3. `validateFitImage` checks: load OK, min dims (512×640), aspect 0.45..1.30, pixel variance > 220 (rejects all-white/black blanks).
4. If validation fails AND `safeModeAttempt === 0`: bump counter, useEffect re-runs with `safeMode: true` + `forceRegenerate: true` in the body. Router appends a `SAFE RENDER MODE` suffix to the prompt and bypasses cache.
5. If validation fails again: state goes to `failed` with retry CTA. Sticky `lastGoodImageUrl` is preserved.
6. If validation passes: `stage = "ready"`, image is shown.

## Stages

`idle | generating | polling | validating | ready | failed`

`FitVisual` treats `generating | polling | validating` as loading — only `ready` shows the image.

## Manual retry resets the counter

`retry()` callback clears `safeModeAttempt` so a fresh user click restarts the auto-retry-once policy.

## Why it matters

Nano Banana sometimes returns small, blank, or malformed outputs (≈5–10% rate). Without this gate the user saw broken images. With this gate they see only clean output or a clear retry CTA.
