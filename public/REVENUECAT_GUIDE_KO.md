# MYMYON 인앱 구독 설정 가이드 (RevenueCat + AppBuild)

앱 코드는 이미 준비되어 있습니다. 아래는 사람(계정 소유자)만 할 수 있는 설정 단계입니다.

## 1. 스토어에서 구독 상품 만들기

### App Store Connect (iOS)
1. 나의 앱 → MYMYON → 수익화 → 구독
2. 구독 그룹 생성: `MYMYON Premium`
3. 상품 2개 추가
   - 제품 ID: `mymyon_premium_monthly` / 가격 $3.99 / 1개월
   - 제품 ID: `mymyon_premium_yearly` / 가격 $29.99 / 1년
4. 각 상품에 현지화 이름·설명, 심사용 스크린샷 입력
5. 계약·세금·금융 거래 → 유료 앱 계약 체결 (이게 없으면 상품이 절대 안 뜹니다)

### Google Play Console (Android)
1. 수익 창출 → 구독 → 구독 만들기
2. 동일한 제품 ID 2개(`mymyon_premium_monthly`, `mymyon_premium_yearly`) 생성 후 기본 요금제 추가
3. 앱을 최소 내부 테스트 트랙에 한 번 업로드해야 상품이 활성화됩니다.

## 2. RevenueCat 설정

1. app.revenuecat.com 에서 프로젝트 `MYMYON` 생성
2. Apps → iOS 앱 추가: 번들 ID 입력 + App Store Connect **In-App Purchase Key(.p8)** 업로드
3. Apps → Android 앱 추가: 패키지명 + Google Play **서비스 계정 JSON** 업로드
4. **Entitlements** → 새로 만들기
   - Identifier: `premium`  ← 반드시 이 철자 (앱 코드가 이 값을 읽습니다)
5. **Products** → 스토어에서 만든 제품 ID 4개(iOS 2 + Android 2) import → 각각 `premium` 엔타이틀먼트에 연결
6. **Offerings** → `default` offering 생성
   - Package `$rc_monthly` → 월간 상품
   - Package `$rc_annual` → 연간 상품
   앱은 `default` offering을 그대로 화면에 표시합니다.
7. API Keys에서 iOS/Android **public SDK key**를 복사

## 3. AppBuild 설정

1. AppBuild 프로젝트 → Integrations → RevenueCat 켜기
2. 위에서 복사한 iOS / Android public SDK key 붙여넣기
3. Build & Submit 으로 빌드 생성
   - iOS: TestFlight 업로드
   - Android: 내부 테스트 트랙 업로드

웹 코드에는 RevenueCat 패키지를 설치하지 않습니다. 래퍼(AppBuild)가 주입하는 브리지만 사용하므로,
웹사이트에서는 구독 화면이 "앱에서 구독하세요" 안내로 표시됩니다.

## 4. 실제 결제 테스트

### iOS
1. App Store Connect → 사용자 및 액세스 → Sandbox 테스터 계정 생성
2. 아이폰 설정 → App Store → Sandbox 계정에 로그인
3. TestFlight로 MYMYON 설치 → 로그인 → 프로필 → Subscription
4. 상품 가격이 뜨는지 확인 → Subscribe 탭 → Apple 결제 시트에서 확인
5. 결제 후 프리미엄 배지가 즉시 표시되는지, 앱을 껐다 켜도 유지되는지 확인
6. 다른 기기에서 "Restore purchases" 동작 확인

### Android
Play Console → 설정 → 라이선스 테스트에 계정 추가 후 내부 테스트 트랙에서 동일하게 확인.

## 5. 스토어 심사 체크리스트

- [ ] 구독 화면에 가격·기간·자동갱신 문구 노출 (이미 구현됨)
- [ ] "Restore purchases" 버튼 (이미 구현됨)
- [ ] 이용약관·개인정보처리방침 링크 (이미 구현됨)
- [ ] 심사자용 테스트 계정 제공
- [ ] iOS: 유료 앱 계약 체결 완료

## 문제 해결

| 증상 | 원인 |
| --- | --- |
| 상품이 하나도 안 뜸 | 유료 앱 계약 미체결, 또는 offering 미설정 |
| 결제는 됐는데 프리미엄 미적용 | 엔타이틀먼트 이름이 `premium`이 아님 |
| 웹에서 결제 버튼이 없음 | 정상 동작입니다. 결제는 앱에서만 가능합니다 |
