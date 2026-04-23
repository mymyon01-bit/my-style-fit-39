/**
 * Static fallback legal text — KR / EN / IT.
 * Live versions are stored in the `legal_documents` table and are
 * admin-editable. This file is the offline fallback used while data loads
 * or if the network call fails.
 */

export type LegalKey = "terms" | "privacy" | "phone" | "marketing";
export type LegalLang = "ko" | "en" | "it";

export interface LegalDoc {
  title: string;
  body: string;
}

export const LEGAL_FALLBACK: Record<LegalKey, Record<LegalLang, LegalDoc>> = {
  terms: {
    ko: {
      title: "서비스 이용약관",
      body: `본 서비스는 PND INC (mymyon.com)에서 제공하는 패션 추천, OOTD 공유, 상품 탐색 및 관련 기능을 제공합니다.

회원은 정확한 정보를 입력해야 하며 타인의 정보를 도용하거나 허위 정보를 입력해서는 안 됩니다.

회원은 서비스 이용 시 관련 법령 및 회사 정책을 준수해야 하며 다음 행위를 금지합니다:
- 타인의 권리 침해
- 부정 이용 및 계정 도용
- 서비스 운영 방해

회사는 필요 시 서비스 이용을 제한하거나 계정을 종료할 수 있습니다.
회원은 언제든지 탈퇴할 수 있습니다.`,
    },
    en: {
      title: "Terms of Service",
      body: `This service is provided by PND INC (mymyon.com) and offers fashion recommendations, OOTD sharing, and product discovery.

Users must provide accurate information and must not impersonate others.

Users must not:
- infringe on rights
- misuse accounts
- disrupt the service

The company may restrict or terminate accounts if violations occur.
Users may terminate their accounts at any time.`,
    },
    it: {
      title: "Termini di Servizio",
      body: `Questo servizio è fornito da PND INC (mymyon.com) e offre raccomandazioni di moda, condivisione OOTD e scoperta di prodotti.

Gli utenti devono fornire informazioni accurate e non devono impersonare altri.

Gli utenti non devono:
- violare i diritti
- abusare degli account
- interrompere il servizio

L'azienda può limitare o chiudere gli account in caso di violazioni.
Gli utenti possono chiudere il proprio account in qualsiasi momento.`,
    },
  },
  privacy: {
    ko: {
      title: "개인정보 처리방침",
      body: `수집 항목:
- 필수: 이메일, 비밀번호, 닉네임
- 선택: 성별, 키, 몸무게, 체형, 프로필 이미지

이용 목적:
- 계정 관리
- 추천 서비스
- 부정 이용 방지

보유 기간:
- 탈퇴 시까지

동의 거부 시:
- 필수 서비스 이용 제한`,
    },
    en: {
      title: "Privacy Policy",
      body: `Data collected:
- required: email, password, nickname
- optional: gender, height, weight, body type, profile image

Purpose:
- account management
- recommendations
- fraud prevention

Retention:
- until account deletion`,
    },
    it: {
      title: "Informativa sulla Privacy",
      body: `Dati raccolti:
- obbligatori: email, password, nickname
- facoltativi: genere, altezza, peso, tipo di corporatura, immagine del profilo

Finalità:
- gestione dell'account
- raccomandazioni
- prevenzione delle frodi

Conservazione:
- fino alla cancellazione dell'account`,
    },
  },
  phone: {
    ko: {
      title: "휴대폰 인증 (OOTD)",
      body: `OOTD 기능 이용 시 휴대폰 인증이 필요합니다.

수집:
- 전화번호
- 인증 결과
- 인증 시간

목적:
- 보안 및 부정 방지

동의하지 않으면 OOTD 기능 제한`,
    },
    en: {
      title: "Phone Verification (OOTD)",
      body: `Phone verification is required for OOTD features.

Collected:
- phone number
- verification result
- timestamp

Purpose:
- security and fraud prevention

Without consent, OOTD features are restricted.`,
    },
    it: {
      title: "Verifica Telefonica (OOTD)",
      body: `La verifica telefonica è richiesta per le funzionalità OOTD.

Raccolto:
- numero di telefono
- risultato della verifica
- data e ora

Finalità:
- sicurezza e prevenzione delle frodi

Senza consenso, le funzionalità OOTD sono limitate.`,
    },
  },
  marketing: {
    ko: {
      title: "마케팅 정보 수신 동의",
      body: `이벤트 및 추천 정보를 받을 수 있습니다.
동의하지 않아도 서비스 이용 가능`,
    },
    en: {
      title: "Marketing Communications",
      body: `Receive promotions and updates.
Optional and not required for service use.`,
    },
    it: {
      title: "Comunicazioni di Marketing",
      body: `Ricevi promozioni e aggiornamenti.
Facoltativo e non richiesto per l'uso del servizio.`,
    },
  },
};

/** Company info — required by Korean e-commerce law to be displayed. */
export const COMPANY_INFO = {
  name: "PND INC",
  site: "mymyon.com",
  businessReg: "117-07-80785",
  ecomReg: "2009-서울양천-00277",
  address: "서울특별시 양천구 목동서로 38 110-105",
  phone: "010-2157-9962",
  representative: "—", // placeholder
  supportEmail: "mymyon.01@gmail.com",
} as const;
