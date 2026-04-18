---
name: FIT Engine System
description: Hybrid deterministic fit algorithm + AI vision body scan + tiered free/premium modes
type: feature
---
## FIT System Architecture

### Tiered Scan Modes
- **Free Mode**: Lightweight Lovable AI (gemini-2.5-flash), sends only front photo, medium/low confidence
- **Premium Mode**: On-demand only (user taps "Refine Fit" or "High Precision Scan"), uses gemini-2.5-pro, sends all photos, deeper analysis
- Premium requires: subscription active, front+side photos, scan quality ≥65
- Premium explanation: detailed regional insights, brand tendency, styling advice (120 words vs 60)

### Body Scan
- Uploads front/side/back photos to body-scans storage bucket
- Sends base64 images to wardrobe-ai edge function for AI vision analysis
- AI estimates body proportions, quality score, silhouette type
- Results saved to body_profiles table with scan_confidence

### Measurements
- Manual override always takes priority (confidence: "high")
- Auto-saves to DB on manual edit (height, shoulder, waist, inseam)
- Scan estimates: premium → "high", free → "medium"/"low"

### Fit Engine (src/lib/fitEngine.ts) — recalibrated for realism
- Tolerance margins (absolute cm): shoulder ±3, chest ±7, waist ±5, hip ±6, thigh ±5, length ±4
- Within tolerance → "balanced" (neutral, no penalty)
- Tops weights: shoulder 0.40, chest 0.30, waist 0.20, sleeve 0.05, length 0.05
- Bottoms weights: waist 0.35, hip 0.25, thigh 0.20, inseam 0.15, rise 0.05
- Score tiers: perfect 85-100, good 70-85, acceptable 60-70, bad <60
- Soft confidence blend: score * (0.55 + 0.45 * confidenceModifier)
- Min-score clamp at 65 unless region has too-tight/too-loose/too-short/too-long
- Friendly labels: balanced→PERFECT FIT, oversized→SLIGHTLY LOOSE, relaxed→RELAXED FIT

### Visual Try-On (VisualFitPreviewCard)
- Layered: SVG silhouette + product image overlay with CSS transforms
- Garment scaleX from chest/waist delta, scaleY from length delta (clamped)
- Confidence FX: low score → slight blur (max 1.4px), opacity 0.92
- Framer-motion spring entrance + cross-size morph
- S/M/L compare toggle inside card
- Cutout via cutout-product edge fn (gemini-2.5-flash-image), localStorage cache
- Falls back to mix-blend-mode:multiply on raw image while cutout loads

### Results UI
- Shows ESTIMATED FIT (free) or REFINED FIT ✨ (premium), HIGH/MEDIUM/LOW confidence badge
