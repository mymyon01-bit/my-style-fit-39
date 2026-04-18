---
name: Korean market source layer
description: Tiered KR sources — Musinsa+Naver (T1) → Coupang+Interpark (T2) → Western (T3); Interpark capped 12%
type: feature
---
## Korean Market (KR launch priority)

### Source tiers (`src/lib/search/sources.ts` — `krTier()`, `KR_TIER_1`, `KR_TIER_2`)
- **Tier 1 (style + primary inventory)**: Musinsa, Naver — drive top row + style anchor
- **Tier 2 (conversion + supplementary)**: Coupang (price/buy-now), Interpark (capped 10-15%), plus other KR (Kream, SSG, 29CM, W Concept, Gmarket, Ably, Zigzag)
- **Tier 3 (fallback)**: Western (ASOS, Farfetch, YOOX, Zalando, SSENSE, …)

### Detection
`isKoreanMarketQuery(query, { userLanguage, userLocation })` returns true when:
- query contains Hangul, OR
- query mentions korea/seoul/musinsa/kream/naver/coupang/ssg/interpark/etc., OR
- profile.language === "ko" / profile.location includes "kr|korea|seoul"

### Discovery (`supabase/functions/search-discovery/index.ts`)
1. **Naver Shopping API** — `fetchFromNaverApi()`. Auto-active when `NAVER_CLIENT_ID` + `NAVER_CLIENT_SECRET` are set; otherwise no-op.
2. **`discoverKoreanUrls()`** — site:-scoped passes for Musinsa/Naver/Coupang/Interpark/Kream/29CM/SSG + KR retail variants:
   - `{q} 무신사` (style), `{q} 네이버쇼핑` (inventory)
   - `{q} 쿠팡 최저가` (conversion), `{q} 인터파크` (supplementary)
   - `{q} 스타일`, `{q} 구매`

### Result mix (`enforceKoreanMix`)
Replaces the old 50/50 mixer. Layout for the first 24 slots when KR market:
- **Top row (slots 0-3)**: Tier 1 only — alternate Musinsa → Naver. Pads from Coupang/other-KR if T1 is short, never Western.
- **Mid rows**: T1 + T2 interleave (Musinsa, Naver, Coupang, other-KR, Interpark) — Interpark hard-capped at ~12% of window.
- **Lower rows / append**: remaining KR first, then Western.
- Hard cap: no single source > 35% of window.

### Storage
- KR products → `product_cache` with `platform` (naver/coupang/musinsa/kream/ssg/29cm/wconcept/gmarket/interpark), `currency = "KRW"`, `source_trust_level = "high"`.
- Naver API products injected directly into `extracted` (skip Firecrawl).
- All KR products also seed `query_clusters` so future searches render instantly.

### Bilingual fashion check
`isFashionTitle()` accepts English (`jacket`, `bag`, …) and Korean (`자켓`, `가방`, `운동화`, `드레스`, …) so Hangul Naver/Musinsa titles are not rejected.

### Secrets to add later
`NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET` from developers.naver.com → Application → Naver Shopping. Auto-activates on the next search after secrets land — no code change needed.
