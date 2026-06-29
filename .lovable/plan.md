# Fit DNA — Results 화면 정확도 & 레이아웃 리빌드

## 문제 요약
- 167cm/45kg 여성에 Medium이 시각적으로는 타이트한데 라벨이 "LOOSE FIT"으로 표시 → 라벨과 이미지가 불일치.
- 상단 Body DNA 패널이 과하게 차지해서 핵심 try-on 이미지가 작게 보임.
- 너무 많은 설명 라벨이 한꺼번에 노출됨.
- 체형 맞춤 상품 추천이 없음.

## 1. 사이즈 ↔ 이미지 일관성 파이프라인
- `src/lib/sizing/v3Classify.ts`의 가슴/허리/엉덩이 ease 가중치를 stretch 원단(Cotton+Spandex 같은) 기준으로 보정. 마른 체형(BMI<18)에서 음수 ease(브랜드 차트 > 신체)일 때만 LOOSE로 분류되도록 임계값 강화.
- `fit-tryon-router` edge function에 **render-label 동기화 가드** 추가: Gemini가 만든 try-on 이미지의 시각적 텐션과 v3Classify 라벨이 어긋날 가능성이 큰 케이스(BMI <18 + LOOSE)에서 라벨을 한 단계 다운(LOOSE → BEST 또는 SLIGHTLY LOOSE) 시키는 후처리.
- 동일 입력에 대해 라벨 결과를 캐시(`STUDIO_RENDER_VERSION` bump)하여 다음 호출부터 동기화된 결과 반환.

## 2. Results 레이아웃 재설계 (`FitResults.tsx`)
```text
┌──────────────────────────────────────────────────────────┐
│  [SIZE PREVIEW — try-on 이미지 크게]   │  PRODUCT CARD   │
│                                        │  Best Size: M   │
│   (전체 폭의 60-65%)                    │  Add to Bag     │
│                                        │  Why this size? │
│   [S] [M-Best] [L] [XL] 사이즈 셀렉터    │  ───────────    │
│                                        │  ANALYZE ▾      │
└──────────────────────────────────────────┴────────────────┘
┌──────────────────────────────────────────────────────────┐
│  YOUR BODY DNA (compact strip, 우측 또는 하단)            │
│  Bust 94 · Waist 59 · Hip 96 · 점수 ring 3개 (작게)       │
└──────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────┐
│  RECOMMENDED FOR YOUR SHAPE (가로 스크롤 상품 카드)        │
└──────────────────────────────────────────────────────────┘
```
- `BodyDnaPanel` 을 상단에서 빼고 **컴팩트 사이드/하단 스트립**으로 축소. 점수/측정값만 노출, 상세 설명은 ANALYZE 시트로 이동.
- 메인 try-on 이미지 영역을 키워서 시각적 핵심으로 만들기.
- 상품 카드는 오른쪽 컬럼: Best Size + Add to Bag + Why/Analyze 토글.

## 3. ANALYZE 시트 통합
- 기존 `FitAnalysisPanel`, region fit table, body DNA 상세 텍스트, NEW CAPABILITIES 칩들을 **하나의 바텀시트** "Analyze details"로 합쳐 기본 숨김.
- 메인 화면에는 한 줄 요약(예: "Tight in shoulder, balanced in bust")만 노출.

## 4. 체형 맞춤 상품 추천 (신규 섹션)
- 새 컴포넌트 `RecommendedForShape.tsx`:
  - 사용자 BMI/신체 측정값 + 선호 fit 키워드로 `products` 테이블에서 적합 상품 필터(이미 있는 추천 함수 `src/lib/recommendation.ts` 활용).
  - 가로 스크롤 카드 6-8개, 탭하면 ProductDetailSheet 오픈.
- Results 화면 맨 아래 + Fit DNA 메인에도 동일 컴포넌트 노출.

## 5. 작업 파일
- `src/components/fit/FitResults.tsx` — 전체 레이아웃 재구성, BodyDnaPanel 축소판으로 교체.
- `src/components/fit/BodyDnaPanel.tsx` — `variant="compact"` prop 추가, 스트립 모드 지원.
- `src/components/fit/FitAnalysisPanel.tsx` — Analyze 바텀시트로 흡수.
- `src/components/fit/RecommendedForShape.tsx` — 신규.
- `src/lib/sizing/v3Classify.ts` — LOOSE 판정 임계값 강화 + stretch 보정.
- `supabase/functions/fit-tryon-router/index.ts` — 라벨 후처리 가드 + `STUDIO_RENDER_VERSION` bump → `lovable-ai-v17-sync`.
- `src/pages/FitPage.tsx` — BodyDnaPanel 상단 노출 제거(또는 compact 형태로 이동).

## 비범위
- OOTD, Showroom, Discover는 이번 작업에 포함하지 않음.
- Gemini 모델 자체는 변경하지 않음 (이미지 품질 OK 상태 유지).
