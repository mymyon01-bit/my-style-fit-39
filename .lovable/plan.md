# MYMYON 구조 정리 계획

전체 요청은 매우 크므로 **2 단계**로 안전하게 진행합니다.
Phase 1만 먼저 진행하고, 끝난 뒤 결과를 보고 Phase 2 를 결정합니다.
기능은 하나도 제거하지 않고 **재배치만** 합니다.

---

## Phase 1 — 정보 구조(IA) & 네비게이션 재정리

목표: 메인 메뉴를 4개로 정리하고, OOTD를 더 이상 “앱 속 앱(모달+자체 탭바)”이 아닌 FEED 안의 콘텐츠로 통합.

### 1. 메인 네비게이션을 4탭으로

모바일 `BottomNav` & 데스크탑 `DesktopNav` 모두:

```
PRODUCTS  ·  FIT  ·  FEED  ·  MY
```

- `/discover` → PRODUCTS (라벨만 변경, 라우트 유지)
- `/fit` → FIT
- `/feed` → **신규 라우트** (FEED, 아래 3번 참조)
- `/profile` → MY
- 데스크탑의 OOTD 다이어리 중앙 앵커 제거 → 일반 nav 링크로 흡수
- 모바일 BottomNav 의 OOTD 전용 버튼 / 다이어리 아이콘 제거
- Settings 메인 탭에 없음(이미 MY 안), 변동 없음

### 2. OOTD 모달 종료

`OOTDModalHost`, `useOOTDModal`, `OOTDDiaryButton`, `OOTDDiaryIcon`, OOTD 전용 자체 하단 탭바 모두 **레거시**로 비활성화.
대신 OOTD 콘텐츠는 신규 `/feed` 페이지의 한 탭으로 노출.

- `useOOTDModal()` 호출하던 모든 곳(28개 파일)은 `navigate("/feed")` 또는 `navigate("/feed?tab=ootd")` 로 교체
- `OOTDModalHost`/`OOTDDiary*` 컴포넌트는 파일 보존하되 App에서 마운트 해제 (롤백 용이)

### 3. 신규 `/feed` 페이지

`src/pages/FeedPage.tsx` 신설. 상단 세그먼트(top tabs):

```
For You · Following · Ranking · Showrooms
```

각 탭은 기존 구현을 그대로 활용:
- For You / Following → `OOTDShortsFeed` / 기존 OOTD 피드 컴포넌트 재사용
- Ranking → 현재 OOTD 모달 안 Ranking 탭 콘텐츠 이식
- Showrooms → `ShowroomBrowsePage` 콘텐츠 임베드 (라우트 `/showroom`도 유지)

탭 상태는 `?tab=` 쿼리로 동기화 (딥링크/뒤로가기).

### 4. OOTD 업로드 진입점

OOTD 게시는 FEED 우상단 “＋ Post” 버튼 + MY 페이지 카드에서 진입 (기존 `OOTDUploadSheet` 그대로 사용). 별도 + FAB 는 추가하지 않음(요청서의 “clarity 우선” 가이드 반영).

### 5. MY 페이지 정리

기존 `ProfilePage` 유지. 단:
- 상단에 Settings 톱니 아이콘 유지(이미 있음)
- 기존 OOTD 모달로 보내던 “View All / My OOTDs” 버튼들 → `/feed?tab=following&user=me` 또는 본인 OOTD 목록으로 라우팅

### 6. 회귀 검증 체크리스트

- [ ] PRODUCTS 검색 / 카테고리 / 저장 동작
- [ ] FIT 스캔 / try-on / size 추천
- [ ] FEED 의 4개 탭 전환, OOTD 피드 무한스크롤, Star/Like/Save, 댓글
- [ ] MY: 편집 / 로그아웃 / 서클·리플 시트
- [ ] `/user/:userId` 방문자 페이지 (직전 작업) 유지
- [ ] 모바일 360–430px 가로 스크롤 없음, 하단 탭 가림 없음
- [ ] 데스크탑 nav 중복 없음, 빈 공간 과다 없음

---

## Phase 2 — 비주얼/카드 시스템 오버홀 (옵션, 별도 승인)

색상 토큰 교체(요청서 16번), 카드 라디우스·패딩 통일, OOTD 카드 / Product 카드 디자인 리뉴얼.
Phase 1 끝난 뒤 따로 진행해야 안전.

---

## Technical notes

- 라우트 추가: `src/App.tsx` 에 `<Route path="/feed" element={<FeedPage />} />`
- 신규 파일: `src/pages/FeedPage.tsx`
- 수정: `src/components/BottomNav.tsx`, `src/components/DesktopNav.tsx`, `src/App.tsx`(OOTDModalHost 제거)
- 28개 파일의 `useOOTDModal` 호출 → `useNavigate` 로 교체 (자동 일괄 + 수동 검수)
- `prefetchAllTabs` / `prefetchRoute` 도 `/feed` 추가
- i18n 키: 기존 `tabOotd` 는 라벨만 `FEED` 로 재사용하거나 신규 `tabFeed` 추가
- `OOTDModalProvider` 는 임시로 빈 Provider 로 두어 기존 import 깨지지 않게 유지 → 추후 제거

---

**진행 여부**: Phase 1 만 먼저 시작해도 될까요? 아니면 Phase 2(컬러/카드 시스템)까지 한 번에 갈까요?
