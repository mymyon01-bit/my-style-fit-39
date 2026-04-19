# Legacy FIT modules

Files here are **not imported by the active FIT path**. They are preserved
for reference. The current FIT pipeline is intentionally simple:

```
FitPage
  → useFit state (measurements, scan)
  → /lib/fit/score.ts        (computeFit — recalibrated weights)
  → /lib/fit/bodyProfile.ts  (BMI + frame, no fake measurements)
  → /lib/fit/globalSize.ts   (height-based fallback when brand chart missing)
  → /lib/fit/explain.ts      (deterministic, region-driven bullets)
  → FitResults card
  → optional TryOnPreviewModal (Replicate)
```

Removed from main view:
- `BodySilhouette.tsx` — low-quality SVG body outline, looked unprofessional
- `VisualFitPreviewCard.tsx` — fake-overlay try-on preview, not believable

Do not re-import from `src/legacy/fit/`. If a piece of behavior is needed,
port it cleanly into `/lib/fit/` or `/components/fit/` and delete the legacy
copy on your way out.
