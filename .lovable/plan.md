
# MYMYON Discover — Luxury Brand Integration (MVP+)

기존 Discover 파이프라인(`search-discovery`, `multi-source-scraper`, `discover-search-engine`, `google-shopping`)은 이미 다중 소스 병렬 페치로 동작합니다. 새 백엔드를 만들지 않고, **3가지 레이어만 추가**해서 럭셔리 브랜드를 안전하게 끌어옵니다.

---

## 1. 데이터베이스 — `discovery_cache` 테이블 추가

쿼리별 결과 캐시 (TTL 6시간). 럭셔리 브랜드 검색은 페치 비용이 크므로 캐시가 핵심.

```text
discovery_cache
├── query_key (text, PK)        ← normalize(query)+lang+gender 해시
├── query (text)                ← 원본 쿼리
├── product_ids (uuid[])        ← product_cache 참조
├── source_breakdown (jsonb)    ← {serpapi: 12, apify: 8, ...}
├── created_at, expires_at
└── hit_count
```

RLS: 모두 읽기 가능, 서비스 롤만 쓰기.

---

## 2. 브랜드 정규화 — `src/lib/discover/luxuryBrands.ts` (신규)

자유 입력 인식 + 정규화 (Top 30+ 럭셔리 + 컨템포러리, 별칭/한글/약자 포함):

```text
brand_alias = {
  "lv" | "louis vuitton" | "루이비통" → "Louis Vuitton",
  "구찌" | "gucci" → "Gucci",
  "버버리" | "burberry" → "Burberry",
  ...30+ 브랜드
}
```

함수:
- `normalizeBrand(raw: string): string | null`
- `detectLuxuryBrand(query: string): { brand, isLuxury, weight }` — 모든 브랜드 자동 인식 (휴리스틱: 알려진 럭셔리 도메인 + 가격대)
- `LUXURY_BRAND_BOOST: Record<string, number>` — Hermès=1.4, LV/Chanel/Gucci=1.3, 컨템포러리=1.15

엣지 함수와 클라이언트가 함께 import할 수 있도록 순수 TS.

---

## 3. Edge Function — `discover-luxury` (신규, 얇은 오케스트레이터)

기존 함수들을 재사용해 럭셔리 검색 흐름만 통합:

```text
POST /discover-luxury  { query, gender?, lang? }

1. cache lookup (discovery_cache) → hit이면 즉시 반환
2. brand normalization → query 보강 ("gucci shirt" → "Gucci shirt site:gucci.com OR farfetch.com")
3. 병렬 fan-out:
   - google-shopping (SerpAPI 기반, 이미 존재)
   - search-discovery (Perplexity + Firecrawl, 이미 존재)
   - multi-source-scraper (Apify, 이미 존재)
4. 결과 통합:
   - 정규화된 schema로 매핑
   - dedupe: brand + normalized_title + image_hash(첫 80바이트)
   - filter: image_url 있음, product_url 유효, 가격 sanity (1~50000)
5. 랭킹: brand_weight × freshness × price_match(user_profile)
6. discovery_cache에 upsert (TTL 6h)
7. 응답: { products[], cached: false, sources: {...} }
```

**중요**: `google-shopping` 등 기존 함수는 그대로 두고 호출만 함. 직접 스크래핑/HTML 저장 없음.

---

## 4. 클라이언트 통합

- `src/hooks/useDiscoverSearch.ts`: 럭셔리 브랜드가 쿼리에 감지되면 (`detectLuxuryBrand`) 기존 Discover와 **추가로** `discover-luxury`를 호출. 결과는 같은 product 리스트에 머지.
- `src/pages/DiscoverPage.tsx`: 결과 카드에 브랜드 강조(이미 `brand` 필드 있음). 출처 태그(`source: serpapi/apify/perplexity`)를 카드 우측 하단에 작은 칩으로 노출.
- "Try Fit" 버튼은 기존 `SubmitProductDialog` 흐름 그대로 → 사이즈 없으면 `size_confidence: low` 표시 후 fit 엔진으로 패스.

---

## 5. 안전 장치

- **No scraping bypass**: 모든 페치는 기존 SerpAPI/Apify/Firecrawl/Perplexity 사용. 새로운 직접 크롤러 없음.
- **이미지**: 공식 CDN URL만 사용. 깨지면 placeholder. 호스팅/리업로드 안함.
- **링크**: 항상 원본 product_url로 `target="_blank" rel="noopener noreferrer"`.
- **Supabase 스키마**: 신규 테이블 1개만 추가, 기존 `product_cache`는 그대로.
- **Firebase 도입 없음.**

---

## 6. 변경 파일

신규
- `supabase/migrations/*_discovery_cache.sql`
- `supabase/functions/discover-luxury/index.ts`
- `src/lib/discover/luxuryBrands.ts`

수정
- `src/hooks/useDiscoverSearch.ts` — 럭셔리 감지 시 fan-out 추가
- `src/pages/DiscoverPage.tsx` — 출처 칩, 사이즈 신뢰도 라벨

---

## 7. 수용 기준 (Acceptance)

- "Gucci shirt" / "구찌 셔츠" / "버버리 트렌치" → 실제 해당 브랜드 상품 노출
- 결과는 SerpAPI/Apify/Perplexity 중 합법 소스에서만 옴
- 두 번째 동일 검색 시 < 200ms (캐시 히트)
- 카드 클릭 → 원본 브랜드/리테일러 페이지로 이동
- 기존 Discover 결과 흐름 영향 없음
- Fit 시스템(`fit-tryon-router`) 변경 없음
