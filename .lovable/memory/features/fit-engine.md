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

### Fit Engine (src/lib/fitEngine.ts)
- Deterministic scoring with ease allowances per fit type
- Tops: shoulder 0.30, chest 0.22, waist 0.14, sleeve 0.12, length 0.12
- Bottoms: waist 0.24, hip 0.20, thigh 0.18, inseam 0.14, rise 0.12
- Classification: too-tight → fitted → balanced → relaxed → too-loose
- Confidence modifier = (productDataQuality/100) * (scanQuality/100) * 1.2

### Cost Control
- Free mode = default, handles majority of traffic
- Premium scan only on explicit user action
- Free sends 1 image, premium sends all
- Cached body profile reused across sessions
- AI explanation only runs once per product selection

### Results UI
- Shows "ESTIMATED FIT" (free) or "REFINED FIT ✨" (premium)
- "Refine Fit — High Precision" CTA for premium users
- Locked CTA with "(Premium)" for free users
- Shop Now button links to external product page
- Confidence badge (HIGH/MEDIUM/LOW)
