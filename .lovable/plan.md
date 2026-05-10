# MYMYON FIT — Lovable AI render + clean dashboard UI

Two coordinated changes. Body-lock + realism directives stay; rendering pipeline and result screen are rebuilt.

## 1. Render: Replicate → Lovable AI Gateway

**Goal:** stop the "PNG-pasted-on-mannequin" look. Use Lovable AI image-conditioned model so the garment is actually *seen* and wrapped onto the locked mannequin body, with proper depth, strap placement, and fabric drape.

### `supabase/functions/fit-tryon-router/index.ts`
- Default `mode = "studio"` now routes to **Lovable AI Gateway** (`google/gemini-3.1-flash-image-preview`) via `https://ai.gateway.lovable.dev/v1/images/generations`, sending:
  - garment image URL as visual reference (so model sees the actual print/cut/straps)
  - body reference URL (mannequin lock, no face/skin)
  - existing `realismDirective` block (V12) — body-locked, measurement-first
  - **new `garmentAlignmentBlock`**: hard rules — straps anchor to acromion, neckline contours collarbone, bust seam wraps chest curve, waist follows torso compression, hem drapes over hips, fabric must show depth/shading on side curve. Forbid: floating overlay, flat texture projection, body clipping, sticker effect.
- Replicate path kept only as **fallback** when Lovable AI returns 402/429 or empty output. Bump `STUDIO_RENDER_VERSION` to `lovable-ai-v13-aligned` to bust cache.
- Auth headers: `Lovable-API-Key: ${LOVABLE_API_KEY}` (already auto-provisioned).
- On 402 → surface `code: "credits_exhausted"`; on 429 → `rate_limited`.

### `src/lib/fit/validateFitImage.ts` (light tweak)
- Add an "overlay artifact" heuristic: detect uniform-edge garment regions (typical of PNG paste). If detected on first render, request `safeMode=true` retry which prepends an even stricter alignment block.

## 2. UI Redesign — `FitResults.tsx` (reference image)

Replace the current scrollable stack with a **3-column dashboard** (desktop) / collapsible stack (mobile):

```text
┌─────────────┬──────────────────────────────────┬──────────────┐
│ MY BODY     │  SIZE PREVIEW   [Front] [Side]   │ PRODUCT      │
│ Female / 29 │                                  │ name + brand │
│ 168 / 96    │  ┌───┐ ┌───┐ ┌───┐ ┌───┐         │ [AI FITTING] │
│ Bust 106    │  │ S │ │ M │ │ L*│ │XL │         │              │
│ Waist 92    │  │img│ │img│ │img│ │img│         │ SIZE         │
│ Hip 112     │  └───┘ └───┘ └───┘ └───┘         │ S M [L] XL   │
│ Shoulder 43 │  TooTight Close BEST  Loose      │              │
│             │                                  │ BEST FOR YOU │
│ [silhouette]│  Per-card 2-line caption         │ Size L  ▼    │
│             │                                  │              │
│ Body locked │                                  │ FIT SUMMARY  │
│             │                                  │ Chest  ✓     │
│             │                                  │ Waist  ✓     │
│             │                                  │ Hip    ✓     │
│             │                                  │ Length ◐     │
│             │                                  │ Strap  ✓     │
│             │                                  │              │
│             │                                  │ [ADD TO BAG] │
└─────────────┴──────────────────────────────────┴──────────────┘
        Fit Tip: "Prefer relaxed? Try XL."
```

### Components
- **New `MyBodyPanel.tsx`** (left): gender/age, H/W, key cm, mannequin silhouette thumbnail, "Body is locked" note + small "Edit" link.
- **New `SizePreviewGrid.tsx`** (center): 4 size cards from `result.sizeResults`, each rendering its own `FitImageCanvas` with `SizeWarpProfile`. Active card has accent border + "BEST" pill if recommended. 2-line caption from `solver` labels (e.g. "Chest & waist tight / Fabric pulls at bust"). Front/Side toggle at top.
- **New `FitSummaryRail.tsx`** (right): product name + brand, AI FITTING badge, fabric chip, size chips (S M L XL), "BEST SIZE FOR YOU" callout with "Why this size?" disclosure, region table (chest/waist/hip/length/strap with ✓ ◐ ✗ indicators), ADD TO BAG + save buttons.
- **Bottom strip `FitTip.tsx`**: one-line guidance ("If you prefer a more relaxed look, try XL").
- Mobile: stack as Body → Grid → Summary; sticky bottom CTA; existing mobile menu offset already handled.

### What gets removed/hidden
- Long verbose explanation cards, FitTrustStrip, FitAnalysisPanel, FitBreakdown, RegionFitTable — moved into "Why this size?" disclosure (collapsed by default).
- Keep `useFitTryOn`, `useSizeRecommendation`, `solver`, `regionFit`, `baselineFitVerdict`, body-DNA guard exactly as today — only the presentation layer changes.

### Files
- **edit:** `supabase/functions/fit-tryon-router/index.ts`, `src/components/fit/FitResults.tsx`, `src/lib/fit/validateFitImage.ts`
- **new:** `src/components/fit/MyBodyPanel.tsx`, `src/components/fit/SizePreviewGrid.tsx`, `src/components/fit/FitSummaryRail.tsx`, `src/components/fit/FitTip.tsx`

## Out of scope
Body scan, sizing math, OOTD/Shorts, auth — untouched. No new dependencies.

## Risk
Lovable AI image preview model may still under-respect alignment rules. Mitigation: stricter imperative phrasing, garment image passed as primary reference, validateFitImage retry, Replicate fallback on failure.
