# MYMYON Rebuild — OOTD Community + Unified Nav + AI Search

레퍼런스 인포그래픽(6, 9, 새 BOTTOM NAV) 기준으로 옛 잔재를 모두 걷어내고 새 구조로 통합.

## 1. Bottom Navigation (전체 통일)
최종 5탭으로 확정 — Home / Fit DNA / Discover / OOTD / Profile
- `Closet` 메뉴 제거 (쇼룸이 클로젯 역할). 라우터에서 `/closet` → `/profile` 리다이렉트.
- `ShowroomBrowsePage`는 Discover의 서브뷰로 흡수, 개별 쇼룸 디테일은 그대로 `/showroom/:id` 유지.
- 모바일/웹 모두 동일.

## 2. OOTD 페이지 (커뮤니티 에코시스템)
`OOTDPage`를 4 섹션 탭으로 완전 재구성:

| 섹션 | 내용 |
|---|---|
| **A. Feed** | 무한 수직 피드. Outfit reviews / Style discussions / Community recs |
| **B. My Page** | 본인 아바타·통계(Followers/Following/Stars) + Outfit archive 그리드 + Saved looks + 내 쇼룸 링크 + Style evolution timeline |
| **C. Wave** | 기존 Wave 시스템 재배치 — Viral looks / Challenges / Trend discovery / Creator growth |
| **D. Showroom** | Creator collections / Theme rooms / Seasonal lookbooks / Shopable wardrobes. "내 쇼룸"이 곧 내 클로젯 |

- 옛 OOTD 잔재(MY 탭 별도 버튼, 카드 UI 난잡함, 플로팅 포스트 버튼) 모두 제거.
- 디자인: 9번 가이드 그대로 — Larger imagery / Reduced noise / More whitespace / Stronger typography hierarchy.

## 3. Home 페이지 — LLM Search Bar
- 기존 "BROWSE" 헤더 텍스트 자리에 **AI Search Bar** 1개로 교체.
- Placeholder: "Search styles, products, looks…"
- 자연어 쿼리 → Lovable AI(gemini-3-flash) 호출 → 의도 파싱(상품/스타일/유저/쇼룸) → 기존 products/showrooms/ootd_posts 파이프라인으로 결과 라우팅.
- 결과 페이지: `/search?q=…` — 카테고리별 그룹(Products · Showrooms · Looks · Creators).

## 4. 옛 잔재 제거
- 옛 hero 카피, 옛 카테고리 pill, 옛 Closet 진입점, 옛 OOTD 플로팅 버튼.
- 폰트·컬러는 현재 Playfair/Ivory/Navy/Gold 유지.

## 기술 메모
- 신규: `src/pages/SearchPage.tsx`, `src/components/home/AISearchBar.tsx`, `supabase/functions/ai-search/index.ts` (LOVABLE_API_KEY).
- 수정: `BottomNav.tsx`, `OOTDPage.tsx`(전면 재작성), `HomePage.tsx`(헤더 영역만), `App.tsx`(라우트).
- 신규 컴포넌트: `ootd/sections/FeedSection.tsx`, `MyPageSection.tsx`, `WaveSection.tsx`, `ShowroomSection.tsx`.
- DB는 변경 없음 — 기존 `ootd_posts`, `showrooms`, `products` 그대로 사용.

## 작업 순서
1. Bottom nav 정리 + `/closet` 리다이렉트
2. OOTD 4섹션 컨테이너 + 각 섹션 컴포넌트
3. Home AI Search Bar + edge function + `/search` 페이지
4. 옛 잔재 클린업 & QA(모바일/웹)

승인하면 1→4 순서로 한 번에 진행할게요.