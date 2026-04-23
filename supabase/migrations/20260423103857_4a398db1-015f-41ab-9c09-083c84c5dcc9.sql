
-- ============================================================
-- LEGAL DOCUMENTS — admin-editable bilingual content (KR/EN/IT)
-- ============================================================
CREATE TABLE public.legal_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  doc_key TEXT NOT NULL,           -- 'terms' | 'privacy' | 'phone' | 'marketing'
  language TEXT NOT NULL,          -- 'ko' | 'en' | 'it'
  version INTEGER NOT NULL DEFAULT 1,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  is_current BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (doc_key, language, version)
);
CREATE INDEX idx_legal_docs_current ON public.legal_documents (doc_key, language) WHERE is_current = true;
ALTER TABLE public.legal_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone reads legal documents"
  ON public.legal_documents FOR SELECT
  USING (true);

CREATE POLICY "Admins manage legal documents"
  ON public.legal_documents FOR ALL
  TO authenticated
  USING (is_admin_or_above(auth.uid()))
  WITH CHECK (is_admin_or_above(auth.uid()));

CREATE TRIGGER trg_legal_docs_updated
  BEFORE UPDATE ON public.legal_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- USER CONSENTS — versioned record of agreement
-- ============================================================
CREATE TABLE public.user_consents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  consent_type TEXT NOT NULL,      -- 'terms' | 'privacy' | 'marketing' | 'phone'
  granted BOOLEAN NOT NULL,
  document_version INTEGER,
  language TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_user_consents_user ON public.user_consents (user_id, consent_type, created_at DESC);
ALTER TABLE public.user_consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own consents"
  ON public.user_consents FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own consents"
  ON public.user_consents FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins view all consents"
  ON public.user_consents FOR SELECT
  TO authenticated
  USING (is_admin_or_above(auth.uid()));

-- ============================================================
-- PHONE VERIFICATIONS — OTP records + verified status
-- ============================================================
CREATE TABLE public.phone_verifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  phone_number TEXT NOT NULL,
  country_code TEXT,
  otp_code TEXT,                   -- mock/dev only; clear after verify
  provider TEXT NOT NULL DEFAULT 'mock',  -- 'mock' | 'portone' | 'twilio'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'verified' | 'expired' | 'failed'
  attempts INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '5 minutes'),
  verified_at TIMESTAMPTZ,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_phone_verifications_user ON public.phone_verifications (user_id, created_at DESC);
ALTER TABLE public.phone_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own phone verifications"
  ON public.phone_verifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own phone verifications"
  ON public.phone_verifications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own phone verifications"
  ON public.phone_verifications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins view all phone verifications"
  ON public.phone_verifications FOR SELECT
  TO authenticated
  USING (is_admin_or_above(auth.uid()));

CREATE TRIGGER trg_phone_verif_updated
  BEFORE UPDATE ON public.phone_verifications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- PROFILES — add phone verified flag (denormalized for fast OOTD gating)
-- ============================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS phone_number TEXT,
  ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ;

-- ============================================================
-- SEED INITIAL LEGAL DOCUMENTS (KR + EN + IT)
-- ============================================================
INSERT INTO public.legal_documents (doc_key, language, version, title, body) VALUES
-- TERMS
('terms', 'ko', 1, '서비스 이용약관',
'본 서비스는 PND INC (mymyon.com)에서 제공하는 패션 추천, OOTD 공유, 상품 탐색 및 관련 기능을 제공합니다.

회원은 정확한 정보를 입력해야 하며 타인의 정보를 도용하거나 허위 정보를 입력해서는 안 됩니다.

회원은 서비스 이용 시 관련 법령 및 회사 정책을 준수해야 하며 다음 행위를 금지합니다:
- 타인의 권리 침해
- 부정 이용 및 계정 도용
- 서비스 운영 방해

회사는 필요 시 서비스 이용을 제한하거나 계정을 종료할 수 있습니다.
회원은 언제든지 탈퇴할 수 있습니다.'),

('terms', 'en', 1, 'Terms of Service',
'This service is provided by PND INC (mymyon.com) and offers fashion recommendations, OOTD sharing, and product discovery.

Users must provide accurate information and must not impersonate others.

Users must not:
- infringe on rights
- misuse accounts
- disrupt the service

The company may restrict or terminate accounts if violations occur.
Users may terminate their accounts at any time.'),

('terms', 'it', 1, 'Termini di Servizio',
'Questo servizio è fornito da PND INC (mymyon.com) e offre raccomandazioni di moda, condivisione OOTD e scoperta di prodotti.

Gli utenti devono fornire informazioni accurate e non devono impersonare altri.

Gli utenti non devono:
- violare i diritti
- abusare degli account
- interrompere il servizio

L''azienda può limitare o chiudere gli account in caso di violazioni.
Gli utenti possono chiudere il proprio account in qualsiasi momento.'),

-- PRIVACY
('privacy', 'ko', 1, '개인정보 처리방침',
'수집 항목:
- 필수: 이메일, 비밀번호, 닉네임
- 선택: 성별, 키, 몸무게, 체형, 프로필 이미지

이용 목적:
- 계정 관리
- 추천 서비스
- 부정 이용 방지

보유 기간:
- 탈퇴 시까지

동의 거부 시:
- 필수 서비스 이용 제한'),

('privacy', 'en', 1, 'Privacy Policy',
'Data collected:
- required: email, password, nickname
- optional: gender, height, weight, body type, profile image

Purpose:
- account management
- recommendations
- fraud prevention

Retention:
- until account deletion'),

('privacy', 'it', 1, 'Informativa sulla Privacy',
'Dati raccolti:
- obbligatori: email, password, nickname
- facoltativi: genere, altezza, peso, tipo di corporatura, immagine del profilo

Finalità:
- gestione dell''account
- raccomandazioni
- prevenzione delle frodi

Conservazione:
- fino alla cancellazione dell''account'),

-- PHONE
('phone', 'ko', 1, '휴대폰 인증 (OOTD)',
'OOTD 기능 이용 시 휴대폰 인증이 필요합니다.

수집:
- 전화번호
- 인증 결과
- 인증 시간

목적:
- 보안 및 부정 방지

동의하지 않으면 OOTD 기능 제한'),

('phone', 'en', 1, 'Phone Verification (OOTD)',
'Phone verification is required for OOTD features.

Collected:
- phone number
- verification result
- timestamp

Purpose:
- security and fraud prevention

Without consent, OOTD features are restricted.'),

('phone', 'it', 1, 'Verifica Telefonica (OOTD)',
'La verifica telefonica è richiesta per le funzionalità OOTD.

Raccolto:
- numero di telefono
- risultato della verifica
- data e ora

Finalità:
- sicurezza e prevenzione delle frodi

Senza consenso, le funzionalità OOTD sono limitate.'),

-- MARKETING
('marketing', 'ko', 1, '마케팅 정보 수신 동의',
'이벤트 및 추천 정보를 받을 수 있습니다.
동의하지 않아도 서비스 이용 가능'),

('marketing', 'en', 1, 'Marketing Communications',
'Receive promotions and updates.
Optional and not required for service use.'),

('marketing', 'it', 1, 'Comunicazioni di Marketing',
'Ricevi promozioni e aggiornamenti.
Facoltativo e non richiesto per l''uso del servizio.');

-- App config: phone verification toggle + provider
INSERT INTO public.app_config (key, category, value, description, is_secret) VALUES
('ootd_phone_required', 'verification', 'true'::jsonb, 'Require phone verification before OOTD upload', false),
('phone_verify_provider', 'verification', '"mock"'::jsonb, 'Phone verification provider: mock | portone | twilio', false)
ON CONFLICT (key) DO NOTHING;
