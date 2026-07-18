# 📱 my'myon Android 앱 출시 가이드 (한국어)

웹은 그대로 Lovable에서 운영하면서, 같은 코드로 Android 네이티브 앱을 만드는 전체 과정입니다.

> 💡 **핵심**: 웹과 앱은 **동일한 Lovable Cloud 백엔드**를 공유합니다. 사용자/데이터/별점 모두 자동 동기화돼요.

---

## ✅ 현재 셋업 상태 (이미 완료된 부분)

이 프로젝트는 이미 Capacitor 네이티브 앱 셋업이 끝나 있어요:

- ✅ `capacitor.config.ts` — 앱 ID `com.mymyon.app`, 앱명 `my'myon`
- ✅ Camera, Push Notifications, Splash Screen 플러그인 설치됨
- ✅ `.github/workflows/android-build.yml` — **GitHub에 push할 때마다 APK 자동 빌드**
- ✅ `/install` 페이지에서 최신 APK 다운로드 가능

즉, **개발자 도구 없이도 친구한테 APK를 바로 보낼 수 있는 상태**입니다.

---

## 🚀 단계 1: 친구/베타 테스터에게 APK 배포 (가장 빠름, 30분)

Play Store 등록 없이 APK 파일로 바로 설치하는 방법입니다.

### 1-1. GitHub에 프로젝트 연결
1. Lovable 에디터 우측 상단 → **GitHub → Connect to GitHub**
2. GitHub 계정 인증
3. **Create Repository** 클릭 → 새 저장소 자동 생성

### 1-2. 자동 빌드 확인
1. GitHub 저장소 페이지 → **Actions** 탭
2. "Build Android APK" 워크플로가 자동 실행됨 (5~10분 소요)
3. 완료되면 ✅ 초록 체크가 뜸

### 1-3. APK 다운로드 링크
빌드가 끝나면 아래 URL에 항상 **최신 APK**가 올라가 있어요:

```
https://github.com/<당신의계정>/<저장소명>/releases/download/latest-apk/mymyon.apk
```

또는 앱 내의 **`/install` 페이지**에 자동으로 다운로드 버튼이 표시됩니다.

### 1-4. 설치 방법 (사용자 안내용)
1. Android 폰에서 위 링크 열기 → APK 다운로드
2. 설정 → "출처를 알 수 없는 앱" 허용
3. 다운로드 폴더에서 `mymyon.apk` 탭 → 설치

---

## 🏪 단계 2: Google Play Store 정식 출시

Play Store에 올리려면 **로컬 컴퓨터**(Windows/Mac/Linux 다 가능)에 개발 도구를 깔아야 해요.

### 2-1. 사전 준비

| 항목 | 비용 | 비고 |
|------|------|------|
| Google Play Console 계정 | **$25 (1회)** | https://play.google.com/console |
| Android Studio | 무료 | https://developer.android.com/studio |
| Node.js 20+ | 무료 | https://nodejs.org |
| Java JDK 21 | 무료 | Android Studio에 포함 |

### 2-2. 코드 받아오기 (한 번만)

```bash
# GitHub에서 프로젝트 클론
git clone https://github.com/<당신의계정>/<저장소명>.git
cd <저장소명>

# 의존성 설치
npm install

# Android 플랫폼 추가
npx cap add android
```

### 2-3. ⚠️ 프로덕션 설정 (매우 중요!)

**`capacitor.config.ts`** 파일을 열고 `server` 블록을 **반드시 제거**하세요:

```typescript
// ❌ 이 부분을 통째로 삭제:
server: {
  url: "https://538d9ee4-...lovableproject.com?forceHideBadge=true",
  cleartext: true,
},
```

> 안 지우면 앱이 Lovable 프리뷰 URL을 로드해버려서 출시용으로 못 씁니다.
>
> (참고: GitHub Actions 자동 빌드는 이걸 자동으로 제거하지만, 로컬 빌드는 수동으로 해야 해요.)

### 2-4. 빌드 + 동기화

```bash
npm run build
npx cap sync android
```

### 2-5. 서명 키 만들기 (한 번만)

Play Store는 서명된 앱만 받습니다.

```bash
keytool -genkey -v -keystore mymyon-release.keystore \
  -alias mymyon -keyalg RSA -keysize 2048 -validity 10000
```

비밀번호와 정보 입력 → `mymyon-release.keystore` 파일이 생김.

> ⚠️ **이 파일과 비밀번호 절대 잃어버리지 마세요.** 잃어버리면 앱 업데이트 못 합니다. 클라우드에 백업하세요.

### 2-6. Android Studio에서 AAB 빌드

```bash
npx cap open android
```

→ Android Studio가 열리면:

1. **Build** 메뉴 → **Generate Signed Bundle / APK**
2. **Android App Bundle (AAB)** 선택 → Next
3. 위에서 만든 `mymyon-release.keystore` 선택 + 비밀번호 입력
4. **release** 빌드 변형 선택 → Finish
5. `android/app/release/app-release.aab` 파일 생성됨

### 2-7. Play Console에 업로드

1. https://play.google.com/console → **앱 만들기**
2. 앱 이름: `my'myon`, 언어: 한국어 (또는 영어)
3. 좌측 메뉴 → **프로덕션** → **새 버전 만들기**
4. `app-release.aab` 업로드
5. 출시 정보 입력:
   - 앱 설명 (짧은 설명 80자, 긴 설명 4000자)
   - 스크린샷 최소 2장 (폰 스크린샷)
   - 앱 아이콘 512x512 PNG
   - 기능 그래픽 1024x500 PNG
   - 개인정보처리방침 URL (앱 내 `/legal/privacy` 사용 가능)
6. **콘텐츠 등급** 설문 작성
7. **검토를 위해 제출** → 보통 2~7일 내 심사 통과

---

## 🔄 코드 업데이트할 때

Lovable에서 코드 수정 후 → 자동으로 GitHub에 push됨 → Android APK도 자동 빌드.

**Play Store 업데이트**가 필요하면:

```bash
git pull
npm install
npm run build
npx cap sync android
# capacitor.config.ts에서 server 블록 다시 제거 (Lovable이 다시 추가했을 수 있음)
npx cap open android
# Build → Generate Signed Bundle/APK → 같은 keystore로 서명
# Play Console에서 새 버전 업로드 (versionCode 1 증가시킬 것)
```

`android/app/build.gradle`에서 `versionCode`를 매번 1씩 올려야 합니다.

---

## 🔔 푸시 알림 설정 (선택)

푸시 알림을 보내려면 Firebase Cloud Messaging(FCM) 설정이 필요해요:

1. https://console.firebase.google.com → 새 프로젝트
2. Android 앱 추가 (패키지명: `com.mymyon.app`)
3. `google-services.json` 다운로드 → `android/app/` 폴더에 넣기
4. 프로젝트에 `register-device-token` edge function 추가 필요 (요청 주시면 만들어드릴게요)

---

## ❓ 자주 막히는 부분

| 문제 | 해결 |
|------|------|
| `npx cap add android` 에러 | Java 21 설치 확인: `java -version` |
| 빌드는 됐는데 앱이 흰 화면 | `capacitor.config.ts`의 `server.url` 제거 안 한 것 |
| Play Store "서명 키 충돌" | 처음 만든 keystore 잃어버림 → 새 패키지명으로 재출시해야 함 |
| GitHub Actions 빌드 실패 | Actions 탭에서 로그 확인, 보통 의존성 문제 |

---

## 📞 도움이 더 필요하면

- 이 가이드대로 진행하다 막히면 Lovable 채팅으로 에러 메시지를 보내주세요
- 푸시 알림 백엔드(`register-device-token` edge function)가 필요하면 말씀해주세요
- iOS도 나중에 필요하면 별도 가이드 만들어드릴게요 (Mac 필수)

행운을 빕니다! 🚀
