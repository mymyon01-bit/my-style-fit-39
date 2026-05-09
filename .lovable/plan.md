# Wave 확장 플랜 (v2)

## 1. 데이터베이스 마이그레이션

### `waves` 추가/제약
- 컬럼: `visibility text default 'private'` ('private'|'public')
- **1인 1웨이브 제한**: 트리거로 `created_by` 기준 INSERT 시
  - `is_official=true` (블루뱃지) → 무제한
  - 그 외 → 이미 owner인 웨이브 있으면 reject

### 새 테이블
- **`wave_modules`** (wave당 최대 7개): id, wave_id, kind(`photos|board|wardrobe|poll|anon_board`), label, position
- **`wave_module_posts`**: id, wave_id, module_id, author_id, kind, title, body, image_urls[], metadata jsonb, is_anonymous, like/dislike/meh/comment_count
- **`wave_post_reactions`**: post_id, user_id, reaction(`like|dislike|meh`), UNIQUE(post_id,user_id)
- **`wave_post_comments`**: id, post_id, user_id, parent_id, body, like_count
- **`wave_comment_likes`**: comment_id, user_id
- **`wave_polls`** + **`wave_poll_votes`**

### RLS
- 멤버만 read/write
- 게시물 삭제: 본인 OR `is_wave_admin`
- 모듈/웨이브 삭제: `is_wave_owner`만
- 익명 게시판: author_id 저장하되 비-어드민은 마스킹 (클라 처리)

---

## 2. UI 컴포넌트

### 웨이브 모달 개편 (`WaveModal.tsx`)
좌측 세로 메뉴 + 우측 콘텐츠. 모바일은 상단 가로 탭.
- `WaveSidebar` — 모듈 목록 + 추가/이름변경(어드민)
- `WavePhotoModule` / `WaveBoardModule` / `WaveWardrobeModule` / `WavePollModule` / `WaveAnonBoardModule`
- `WavePostCard` — 좋아요/별로에요/싫어요 + 댓글
- `WaveCommentThread` — 댓글 + 대댓글 + 좋아요
- `AddModuleSheet` — 어드민이 종류 선택 + 라벨 변경
- `WaveAdminPanel` — 멤버 관리, 모듈 삭제, 웨이브 삭제

### 기존 수정
- `CreateWaveDialog` — visibility(Private/Public) 라디오, 기존 owner 웨이브 있으면 차단 (블루뱃지 예외)
- `useWaves` — `useWaveModules`, `useWavePosts`, `useWaveReactions` 훅 추가

### Discover → Wave
- 상품 카드 메뉴에 **"Share to Wave"** → 사용자의 wardrobe 모듈 가진 웨이브 선택 → `wave_module_posts` 삽입

### 초대 ("Let's Ride the Wave")
- `InviteToWaveSheet` 확장: 카피 카드 + 공유 버튼 (Message·Copy·Instagram·TikTok·Facebook·WhatsApp·KakaoTalk)
- 공개 라우트 `/wave/:id?invite=...` → 비-멤버는 초대장 랜딩 → 로그인 후 자동 join

---

## 3. ★ 추가 항목 (이번 메시지)

### A. ShareToWaveMenu
- `src/components/ootd/ShareToWaveMenu.tsx`
- OOTD 카드 더보기 메뉴에 "Share to Wave" 항목
- 사용자가 멤버인 웨이브 목록 → 선택 → 해당 웨이브의 photos 모듈에 자동 포스트

### B. 초대 수락/거절 UI
- `src/components/ootd/WaveInviteCard.tsx`
- `MessagesInbox` 또는 알림 드롭다운에서 `wave_invite` 타입 알림을 카드로 렌더
- Accept → `accept_wave_invite` RPC, Decline → `decline_wave_invite` RPC

### C. OOTD 팁을 플로팅 공지 카드로
- 기존 `OOTDInfoCard` 인라인 사용 제거
- **`OOTDTipToast.tsx`** 새 컴포넌트 — 화면 우측 하단/중앙에 토스트 형태 카드 (1개씩 큐로)
- 페이지 진입 시 미확인 팁 중 1개를 토스트로 띄움, "Got it" → `useInfoCardSeen` 마킹
- 페이지 레이아웃 안 차지 → 더 깔끔

### D. My Showroom 웨이브 통합
- `MyShowroomPage` (또는 `ShowroomPage`)에:
  - 통계 영역에 **"Waves: N"** 카운터 추가
  - **"My Wave"** 버튼 (icon: 🌊) → 클릭 시 본인 owner 웨이브 모달 오픈
  - 웨이브 없으면 "Create Wave" CTA

### E. 1인 1웨이브 (블루뱃지 제외)
- 위 마이그레이션 트리거로 강제
- `CreateWaveDialog`에서 사전 체크하여 UI 비활성화 + 안내 문구

---

## 4. i18n
~35개 신규 키 × 8개 언어

## 5. 범위 외
- 웨이브 내 실시간 채팅
- 웨이브 검색/탐색 페이지

진행하겠습니다.