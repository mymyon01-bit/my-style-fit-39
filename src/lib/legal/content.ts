/**
 * Static fallback legal text — supports all 8 app languages.
 * Live versions live in `legal_documents` (admin-editable). This is the
 * offline fallback shown while data loads or if the network fails.
 */

export type LegalKey = "terms" | "privacy" | "phone" | "marketing";
export type LegalLang = "ko" | "en" | "it" | "de" | "es" | "fr" | "ja" | "zh";

export const LEGAL_LANGUAGES: LegalLang[] = ["ko", "en", "it", "de", "es", "fr", "ja", "zh"];

export const LEGAL_LANG_LABEL: Record<LegalLang, string> = {
  ko: "KR",
  en: "EN",
  it: "IT",
  de: "DE",
  es: "ES",
  fr: "FR",
  ja: "JP",
  zh: "ZH",
};

export interface LegalDoc {
  title: string;
  body: string;
}

/** Consent UI copy (checkbox labels, buttons, modal titles) per language. */
export interface ConsentUiCopy {
  agreeAll: string;
  required: string;
  optional: string;
  view: string;
  terms: string;
  privacy: string;
  marketing: string;
  gateTitle: string;
  gateSubtitle: string;
  gateAccept: string;
  gateSignOut: string;
  gateRequiredError: string;
  languageLabel: string;
}

export const CONSENT_UI: Record<LegalLang, ConsentUiCopy> = {
  ko: {
    agreeAll: "모두 동의",
    required: "필수",
    optional: "선택",
    view: "보기",
    terms: "서비스 이용약관 동의",
    privacy: "개인정보 처리방침 동의",
    marketing: "마케팅 정보 수신 (선택)",
    gateTitle: "가입을 마무리해 주세요",
    gateSubtitle: "서비스를 계속 이용하려면 아래 약관에 동의해 주세요.",
    gateAccept: "동의하고 계속하기",
    gateSignOut: "로그아웃",
    gateRequiredError: "필수 약관에 모두 동의해야 합니다.",
    languageLabel: "언어",
  },
  en: {
    agreeAll: "Agree to all",
    required: "REQUIRED",
    optional: "OPTIONAL",
    view: "VIEW",
    terms: "I agree to the Terms of Service",
    privacy: "I agree to the Privacy Policy",
    marketing: "Marketing communications (optional)",
    gateTitle: "One more step",
    gateSubtitle: "Please review and accept the terms below to continue.",
    gateAccept: "Accept & Continue",
    gateSignOut: "Sign out",
    gateRequiredError: "Please accept the required terms to continue.",
    languageLabel: "Language",
  },
  it: {
    agreeAll: "Accetta tutto",
    required: "OBBLIGATORIO",
    optional: "FACOLTATIVO",
    view: "APRI",
    terms: "Accetto i Termini di Servizio",
    privacy: "Accetto l'Informativa sulla Privacy",
    marketing: "Comunicazioni di marketing (facoltativo)",
    gateTitle: "Ancora un passo",
    gateSubtitle: "Rivedi e accetta i termini per continuare.",
    gateAccept: "Accetta e continua",
    gateSignOut: "Esci",
    gateRequiredError: "Accetta i termini obbligatori per continuare.",
    languageLabel: "Lingua",
  },
  de: {
    agreeAll: "Allen zustimmen",
    required: "ERFORDERLICH",
    optional: "OPTIONAL",
    view: "ANSEHEN",
    terms: "Ich stimme den Nutzungsbedingungen zu",
    privacy: "Ich stimme der Datenschutzerklärung zu",
    marketing: "Marketing-Kommunikation (optional)",
    gateTitle: "Noch ein Schritt",
    gateSubtitle: "Bitte stimme den folgenden Bedingungen zu, um fortzufahren.",
    gateAccept: "Akzeptieren & Fortfahren",
    gateSignOut: "Abmelden",
    gateRequiredError: "Bitte stimme den erforderlichen Bedingungen zu.",
    languageLabel: "Sprache",
  },
  es: {
    agreeAll: "Aceptar todo",
    required: "OBLIGATORIO",
    optional: "OPCIONAL",
    view: "VER",
    terms: "Acepto los Términos del Servicio",
    privacy: "Acepto la Política de Privacidad",
    marketing: "Comunicaciones de marketing (opcional)",
    gateTitle: "Un paso más",
    gateSubtitle: "Revisa y acepta los términos para continuar.",
    gateAccept: "Aceptar y continuar",
    gateSignOut: "Cerrar sesión",
    gateRequiredError: "Debes aceptar los términos obligatorios.",
    languageLabel: "Idioma",
  },
  fr: {
    agreeAll: "Tout accepter",
    required: "REQUIS",
    optional: "OPTIONNEL",
    view: "VOIR",
    terms: "J'accepte les Conditions d'utilisation",
    privacy: "J'accepte la Politique de confidentialité",
    marketing: "Communications marketing (optionnel)",
    gateTitle: "Encore une étape",
    gateSubtitle: "Veuillez accepter les conditions ci-dessous pour continuer.",
    gateAccept: "Accepter et continuer",
    gateSignOut: "Se déconnecter",
    gateRequiredError: "Veuillez accepter les conditions requises.",
    languageLabel: "Langue",
  },
  ja: {
    agreeAll: "すべてに同意",
    required: "必須",
    optional: "任意",
    view: "表示",
    terms: "利用規約に同意します",
    privacy: "プライバシーポリシーに同意します",
    marketing: "マーケティング配信 (任意)",
    gateTitle: "あと一歩です",
    gateSubtitle: "続けるには以下の規約に同意してください。",
    gateAccept: "同意して続ける",
    gateSignOut: "サインアウト",
    gateRequiredError: "必須項目に同意してください。",
    languageLabel: "言語",
  },
  zh: {
    agreeAll: "全部同意",
    required: "必需",
    optional: "可选",
    view: "查看",
    terms: "我同意《服务条款》",
    privacy: "我同意《隐私政策》",
    marketing: "营销信息 (可选)",
    gateTitle: "还差一步",
    gateSubtitle: "请阅读并同意以下条款以继续使用。",
    gateAccept: "同意并继续",
    gateSignOut: "退出登录",
    gateRequiredError: "请先同意必需条款。",
    languageLabel: "语言",
  },
};

/** Normalize any app language code to a supported LegalLang. */
export function toLegalLang(code: string | null | undefined): LegalLang {
  const c = (code || "en").toLowerCase().slice(0, 2) as LegalLang;
  return LEGAL_LANGUAGES.includes(c) ? c : "en";
}

// --- Legal document bodies -------------------------------------------------

const TERMS_BODIES: Record<LegalLang, LegalDoc> = {
  ko: {
    title: "서비스 이용약관",
    body: `본 서비스는 PND INC (mymyon.com)에서 제공하는 패션 추천, OOTD 공유, 상품 탐색 및 관련 기능을 제공합니다.

회원은 정확한 정보를 입력해야 하며 타인의 정보를 도용하거나 허위 정보를 입력해서는 안 됩니다.

다음 행위를 금지합니다:
- 타인의 권리 침해
- 부정 이용 및 계정 도용
- 서비스 운영 방해

회사는 필요 시 서비스 이용을 제한하거나 계정을 종료할 수 있습니다.
회원은 언제든지 탈퇴할 수 있습니다.`,
  },
  en: {
    title: "Terms of Service",
    body: `This service is provided by PND INC (mymyon.com) and offers fashion recommendations, OOTD sharing, and product discovery.

You must provide accurate information and must not impersonate others.

You must not:
- infringe on others' rights
- misuse accounts
- disrupt the service

We may restrict or terminate accounts if violations occur.
You may delete your account at any time.`,
  },
  it: {
    title: "Termini di Servizio",
    body: `Servizio fornito da PND INC (mymyon.com): raccomandazioni di moda, condivisione OOTD e scoperta di prodotti.

Devi fornire informazioni accurate e non impersonare altri.

È vietato:
- violare i diritti altrui
- abusare degli account
- interrompere il servizio

Possiamo limitare o chiudere gli account in caso di violazioni.
Puoi eliminare l'account in qualsiasi momento.`,
  },
  de: {
    title: "Nutzungsbedingungen",
    body: `Dieser Dienst wird von PND INC (mymyon.com) bereitgestellt und bietet Modeempfehlungen, OOTD-Sharing und Produkt-Discovery.

Du musst korrekte Angaben machen und darfst dich nicht als andere ausgeben.

Verboten sind:
- Verletzung von Rechten Dritter
- Missbrauch von Konten
- Störung des Dienstes

Bei Verstößen können Konten eingeschränkt oder gekündigt werden.
Du kannst dein Konto jederzeit löschen.`,
  },
  es: {
    title: "Términos del Servicio",
    body: `Servicio ofrecido por PND INC (mymyon.com): recomendaciones de moda, publicación de OOTD y descubrimiento de productos.

Debes proporcionar información precisa y no suplantar a otros.

Está prohibido:
- infringir derechos ajenos
- abusar de cuentas
- interrumpir el servicio

Podemos restringir o cancelar cuentas por infracciones.
Puedes eliminar tu cuenta en cualquier momento.`,
  },
  fr: {
    title: "Conditions d'utilisation",
    body: `Service fourni par PND INC (mymyon.com) : recommandations mode, partage OOTD et découverte de produits.

Vous devez fournir des informations exactes et ne pas usurper l'identité d'autrui.

Interdictions :
- porter atteinte aux droits d'autrui
- abus de compte
- perturbation du service

Nous pouvons restreindre ou résilier les comptes en cas de violation.
Vous pouvez supprimer votre compte à tout moment.`,
  },
  ja: {
    title: "利用規約",
    body: `本サービスは PND INC (mymyon.com) が提供するファッションレコメンド、OOTD 共有、商品ディスカバリー等の機能です。

正確な情報を入力し、他人になりすまさないでください。

以下の行為を禁止します:
- 他者の権利侵害
- アカウントの不正利用
- サービス運営の妨害

違反があった場合、アカウントの制限・停止を行うことがあります。
いつでも退会できます。`,
  },
  zh: {
    title: "服务条款",
    body: `本服务由 PND INC (mymyon.com) 提供,包括时尚推荐、OOTD 分享和商品发现功能。

请提供准确信息,不得冒充他人。

禁止行为:
- 侵犯他人权利
- 滥用账户
- 干扰服务运行

如有违规,我们可能限制或终止账户。
您可以随时删除账户。`,
  },
};

const PRIVACY_BODIES: Record<LegalLang, LegalDoc> = {
  ko: {
    title: "개인정보 처리방침",
    body: `수집 항목:
- 필수: 이메일, 비밀번호 (또는 Google/Apple 소셜 로그인 식별자), 닉네임
- 소셜 로그인 시: 이름, 프로필 사진, 이메일 (제공자로부터 수신)
- 선택: 성별, 키, 몸무게, 체형, 프로필 이미지, 위치

이용 목적:
- 계정 관리 및 본인 확인
- AI 개인화 추천 서비스
- 부정 이용 방지 및 보안

제3자 제공:
- Google/Apple: 소셜 로그인 인증 목적으로만 사용
- 그 외 제3자 제공 없음 (법령 근거 예외 제외)

보유 기간: 탈퇴 시까지 (법령상 보존 기간 예외)
언제든 열람·수정·삭제·처리정지를 요청할 수 있습니다.
문의: mymyon.01@gmail.com`,
  },
  en: {
    title: "Privacy Policy",
    body: `Data collected:
- Required: email, password (or Google/Apple social login identifier), nickname
- From social login: name, profile picture, email (received from the provider)
- Optional: gender, height, weight, body type, profile image, location

Purpose:
- Account management and identity verification
- AI-personalized recommendations
- Fraud prevention and security

Third-party sharing:
- Google/Apple: for social sign-in only
- No other third-party sharing (except as required by law)

Retention: until account deletion (except legal retention).
You may request access, correction, deletion, or restriction at any time.
Contact: mymyon.01@gmail.com`,
  },
  it: {
    title: "Informativa sulla Privacy",
    body: `Dati raccolti:
- Obbligatori: email, password (o identificativo social Google/Apple), nickname
- Da social login: nome, foto profilo, email (dal provider)
- Facoltativi: genere, altezza, peso, tipo di corporatura, immagine profilo, posizione

Finalità:
- Gestione account e verifica identità
- Raccomandazioni personalizzate con IA
- Prevenzione frodi e sicurezza

Condivisione con terzi:
- Google/Apple: solo per l'accesso social
- Nessun'altra condivisione (salvo obblighi di legge)

Conservazione: fino alla cancellazione dell'account (salvo obblighi legali).
Puoi richiedere accesso, correzione, cancellazione o limitazione.
Contatto: mymyon.01@gmail.com`,
  },
  de: {
    title: "Datenschutzerklärung",
    body: `Erhobene Daten:
- Erforderlich: E-Mail, Passwort (oder Google/Apple-Login-Kennung), Nickname
- Bei Social-Login: Name, Profilbild, E-Mail (vom Anbieter)
- Optional: Geschlecht, Größe, Gewicht, Körpertyp, Profilbild, Standort

Zweck:
- Kontoverwaltung und Identitätsprüfung
- KI-personalisierte Empfehlungen
- Betrugsprävention und Sicherheit

Weitergabe an Dritte:
- Google/Apple: ausschließlich für Social-Login
- Keine sonstige Weitergabe (außer gesetzlich vorgeschrieben)

Speicherung: bis zur Kontolöschung (gesetzliche Fristen vorbehalten).
Du kannst Auskunft, Berichtigung, Löschung oder Einschränkung verlangen.
Kontakt: mymyon.01@gmail.com`,
  },
  es: {
    title: "Política de Privacidad",
    body: `Datos recopilados:
- Obligatorios: email, contraseña (o identificador social Google/Apple), nickname
- Del inicio de sesión social: nombre, foto de perfil, email (del proveedor)
- Opcionales: género, altura, peso, tipo de cuerpo, imagen de perfil, ubicación

Finalidad:
- Gestión de cuenta y verificación
- Recomendaciones personalizadas con IA
- Prevención de fraude y seguridad

Terceros:
- Google/Apple: solo para el inicio de sesión social
- Sin otras cesiones (salvo obligación legal)

Conservación: hasta la eliminación de la cuenta (salvo obligación legal).
Puedes solicitar acceso, rectificación, supresión o limitación.
Contacto: mymyon.01@gmail.com`,
  },
  fr: {
    title: "Politique de confidentialité",
    body: `Données collectées :
- Obligatoires : email, mot de passe (ou identifiant social Google/Apple), pseudo
- Via connexion sociale : nom, photo de profil, email (du fournisseur)
- Facultatives : genre, taille, poids, morphologie, photo de profil, localisation

Finalités :
- Gestion du compte et vérification
- Recommandations personnalisées par IA
- Prévention de la fraude et sécurité

Partage :
- Google/Apple : uniquement pour la connexion sociale
- Aucun autre partage (sauf obligation légale)

Conservation : jusqu'à suppression du compte (sauf obligation légale).
Vous pouvez demander l'accès, la rectification, la suppression ou la limitation.
Contact : mymyon.01@gmail.com`,
  },
  ja: {
    title: "プライバシーポリシー",
    body: `収集する情報:
- 必須: メールアドレス、パスワード (または Google/Apple ソーシャルログイン識別子)、ニックネーム
- ソーシャルログイン時: 氏名、プロフィール画像、メール (提供元から受信)
- 任意: 性別、身長、体重、体型、プロフィール画像、位置情報

利用目的:
- アカウント管理および本人確認
- AI パーソナライズ推薦
- 不正利用防止・セキュリティ

第三者提供:
- Google/Apple: ソーシャルログイン認証のためのみ
- その他の第三者提供なし (法令に基づく場合を除く)

保存期間: 退会まで (法令上の保存義務を除く)。
いつでも開示・訂正・削除・利用停止を請求できます。
連絡先: mymyon.01@gmail.com`,
  },
  zh: {
    title: "隐私政策",
    body: `收集信息:
- 必需: 邮箱、密码 (或 Google/Apple 社交登录标识)、昵称
- 社交登录时: 姓名、头像、邮箱 (由提供方发送)
- 可选: 性别、身高、体重、体型、头像、位置

使用目的:
- 账户管理与身份验证
- AI 个性化推荐
- 反欺诈与安全

第三方共享:
- Google/Apple: 仅用于社交登录
- 无其他共享 (法律要求除外)

保存期限: 至账户注销 (法定保存除外)。
您可随时行使查阅、更正、删除或限制处理的权利。
联系方式: mymyon.01@gmail.com`,
  },
};

const PHONE_BODIES: Record<LegalLang, LegalDoc> = {
  ko: { title: "휴대폰 인증 (OOTD)", body: `OOTD 기능 이용 시 휴대폰 인증이 필요합니다.\n\n수집: 전화번호, 인증 결과, 인증 시간\n목적: 보안 및 부정 방지\n미동의 시 OOTD 기능 이용 제한` },
  en: { title: "Phone Verification (OOTD)", body: `Phone verification is required for OOTD features.\n\nCollected: phone number, verification result, timestamp\nPurpose: security & fraud prevention\nWithout consent, OOTD features are restricted.` },
  it: { title: "Verifica Telefonica (OOTD)", body: `Verifica telefonica richiesta per l'OOTD.\n\nDati: numero, esito, timestamp\nFinalità: sicurezza e prevenzione frodi\nSenza consenso, OOTD limitato.` },
  de: { title: "Telefonverifizierung (OOTD)", body: `Für OOTD ist eine Telefonverifizierung erforderlich.\n\nDaten: Nummer, Ergebnis, Zeitstempel\nZweck: Sicherheit und Betrugsprävention\nOhne Zustimmung OOTD eingeschränkt.` },
  es: { title: "Verificación telefónica (OOTD)", body: `Se requiere verificación telefónica para OOTD.\n\nDatos: número, resultado, marca de tiempo\nFinalidad: seguridad y prevención de fraude\nSin consentimiento, OOTD limitado.` },
  fr: { title: "Vérification téléphonique (OOTD)", body: `Vérification requise pour OOTD.\n\nDonnées : numéro, résultat, horodatage\nFinalité : sécurité et prévention de la fraude\nSans consentement, OOTD limité.` },
  ja: { title: "電話番号認証 (OOTD)", body: `OOTD 利用時に電話番号認証が必要です。\n\n収集: 電話番号、認証結果、時刻\n目的: セキュリティ・不正防止\n未同意の場合 OOTD 機能が制限されます。` },
  zh: { title: "手机验证 (OOTD)", body: `使用 OOTD 需要手机验证。\n\n收集:手机号、验证结果、时间戳\n目的:安全与反欺诈\n未同意将限制 OOTD 功能。` },
};

const MARKETING_BODIES: Record<LegalLang, LegalDoc> = {
  ko: { title: "마케팅 정보 수신 동의", body: `이벤트·프로모션·추천 정보를 받을 수 있습니다.\n동의하지 않아도 서비스 이용 가능합니다.` },
  en: { title: "Marketing Communications", body: `Receive promotions, events, and personalized updates.\nOptional — not required to use the service.` },
  it: { title: "Comunicazioni di Marketing", body: `Ricevi promozioni ed eventi.\nFacoltativo — non richiesto per l'uso del servizio.` },
  de: { title: "Marketing-Kommunikation", body: `Erhalte Aktionen und Neuigkeiten.\nOptional – nicht erforderlich.` },
  es: { title: "Comunicaciones de Marketing", body: `Recibe promociones y novedades.\nOpcional — no obligatorio.` },
  fr: { title: "Communications marketing", body: `Recevez promotions et actualités.\nOptionnel — non requis.` },
  ja: { title: "マーケティング情報の受信", body: `イベント・プロモーション情報を受信できます。\n任意です。` },
  zh: { title: "接收营销信息", body: `接收活动与推广信息。\n可选,非必需。` },
};

export const LEGAL_FALLBACK: Record<LegalKey, Record<LegalLang, LegalDoc>> = {
  terms: TERMS_BODIES,
  privacy: PRIVACY_BODIES,
  phone: PHONE_BODIES,
  marketing: MARKETING_BODIES,
};

/** Company info — required by Korean e-commerce law to be displayed. */
export const COMPANY_INFO = {
  name: "PND INC",
  site: "mymyon.com",
  businessReg: "117-07-80785",
  ecomReg: "2009-서울양천-00277",
  address: "서울특별시 양천구 목동서로 38 110-105",
  phone: "010-2157-9962",
  representative: "—",
  supportEmail: "mymyon.01@gmail.com",
} as const;
