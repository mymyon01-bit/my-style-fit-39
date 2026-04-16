---
name: FIT Engine System
description: Hybrid deterministic fit algorithm + AI vision body scan + real product integration
type: feature
---
## FIT System Architecture

### Body Scan
- Uploads front/side/back photos to body-scans storage bucket
- Sends base64 images to wardrobe-ai edge function for AI vision analysis
- AI estimates body proportions, quality score, silhouette type
- Results saved to body_profiles table with scan_confidence

### Measurements
- Manual override always takes priority (confidence: "high")
- Auto-saves to DB on manual edit (height, shoulder, waist, inseam)
- Scan estimates applied with confidence: "medium" or "low"

### Fit Engine (src/lib/fitEngine.ts)
- Deterministic scoring with ease allowances per fit type
- Tops: shoulder 0.30, chest 0.22, waist 0.14, sleeve 0.12, length 0.12
- Bottoms: waist 0.24, hip 0.20, thigh 0.18, inseam 0.14, rise 0.12
- Classification: too-tight → fitted → balanced → relaxed → too-loose
- Confidence modifier = (productDataQuality/100) * (scanQuality/100) * 1.2

### Product Integration
- Mock products with full measurement data (demo)
- DB products from product_cache with approximate fit data generation
- Data quality score estimated from available metadata

### AI Explanation
- Post-algorithm: wardrobe-ai generates natural language fit summary
- AI never overrides algorithmic decisions
- Falls back to engine summary if AI unavailable

### Results UI
- Shop Now button links to external product page
- Rescan and Edit Measurements actions
- Confidence badge (HIGH/MEDIUM/LOW)
- Region-by-region breakdown with visual bars
