---
name: Korean market source layer
description: Naver Shopping API + Coupang/Musinsa/Kream/SSG discovery + 50/50 KR mix when query is Hangul or user lang=ko
type: feature
---
## Korean Market (KR launch priority)

### Detection (`src/lib/search/sources.ts`)
`isKoreanMarketQuery(query, { userLanguage, userLocation })` returns true when:
- query contains Hangul, OR
- query mentions korea/seoul/musinsa/kream/naver/coupang/ssg/etc., OR
- profile.language === "ko" / profile.location includes "kr|korea|seoul"

### Sources (priority order for KR queries)
1. **Naver Shopping API** — `fetchFromNaverApi()` in search-discovery edge fn. Auto-active when `NAVER_CLIENT_ID` + `NAVER_CLIENT_SECRET` are set. Until then it's a no-op and discovery covers Naver via `site:shopping.naver.com`.
2. **Coupang / Musinsa / Kream / SSG / 29CM / W Concept / Gmarket** — discovery-only via `discoverKoreanUrls()` (Perplexity site:queries + Korean retail variants like `{q} 네이버쇼핑`, `{q} 쿠팡`, `{q} 최저가`, `{q} 무신사`).
3. **Western** (ASOS / Farfetch / YOOX / Zalando / SSENSE) — supplementary; capped to ~50% of the first 12 slots when KR market.

### Result mix (`enforceKoreanMix`)
When `detectKoreanMarket(session.query)` is true (runner runs after `enforceSourceQuota`):
- Target 50/50 KR vs non-KR in the first 12 slots, KR-first interleave.
- If KR supply is short, falls back gracefully — never inserts placeholders.

### Storage
- Korean products land in `product_cache` with `platform = "naver" | "coupang" | "musinsa" | "kream" | "ssg" | "29cm" | "wconcept" | "gmarket"`, `currency = "KRW"`, `source_trust_level = "high"`.
- Naver API products are injected directly into `extracted` (skip Firecrawl).

### Bilingual fashion check
`isFashionTitle()` in search-discovery accepts both English (`jacket`, `bag`, …) and Korean (`자켓`, `가방`, `운동화`, `드레스`, …) so Hangul Naver titles are not rejected.

### Secrets to add later
`NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET` from developers.naver.com → Application → Naver Shopping. The integration auto-activates on the next search after secrets land — no code change needed.
