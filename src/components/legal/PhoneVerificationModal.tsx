/**
 * PhoneVerificationModal — appears when an unverified user attempts to use
 * an OOTD feature (upload, post, share). Two steps:
 *   1) consent + phone entry → request OTP
 *   2) enter OTP → verify
 *
 * In mock/dev mode the issued OTP is shown directly in the UI for testing.
 */
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { usePhoneVerification } from "@/hooks/usePhoneVerification";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { recordPhoneConsent } from "@/lib/legal/recordConsent";
import LegalDocViewer from "@/components/legal/LegalDocViewer";
import type { LegalKey, LegalLang } from "@/lib/legal/content";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVerified?: () => void;
}

const PhoneVerificationModal = ({ open, onOpenChange, onVerified }: Props) => {
  const { user } = useAuth();
  const { lang } = useI18n();
  const { requestOtp, verifyOtp } = usePhoneVerification();

  const [step, setStep] = useState<"consent" | "code">("consent");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [code, setCode] = useState("");
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [mockCode, setMockCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<LegalKey | null>(null);

  const isKR = lang === "ko";
  const isIT = lang === "it";
  const docLang: LegalLang = lang === "ko" || lang === "it" ? lang : "en";

  const t = (en: string, ko: string, it: string) => isKR ? ko : isIT ? it : en;

  const reset = () => {
    setStep("consent"); setPhone(""); setConsent(false); setCode("");
    setVerificationId(null); setMockCode(null); setError(null);
  };

  const handleClose = (o: boolean) => { if (!o) reset(); onOpenChange(o); };

  const handleSendCode = async () => {
    setError(null);
    if (!consent) { setError(t("Please agree to phone verification.", "휴대폰 인증에 동의해주세요.", "Acconsenti alla verifica telefonica.")); return; }
    if (!phone || phone.replace(/\D/g, "").length < 8) {
      setError(t("Enter a valid phone number.", "올바른 전화번호를 입력해주세요.", "Inserisci un numero valido."));
      return;
    }
    setLoading(true);
    if (user) await recordPhoneConsent(user.id, docLang);
    const res = await requestOtp(phone);
    setLoading(false);
    if (!res.ok || !res.verificationId) { setError(res.error ?? "Failed"); return; }
    setVerificationId(res.verificationId);
    setMockCode(res.mockCode ?? null);
    setStep("code");
  };

  const handleVerify = async () => {
    if (!verificationId) return;
    setError(null); setLoading(true);
    const res = await verifyOtp(verificationId, code);
    setLoading(false);
    if (!res.ok) { setError(res.error ?? "Failed"); return; }
    toast.success(t("Phone verified", "휴대폰 인증 완료", "Telefono verificato"));
    onVerified?.();
    handleClose(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="h-4 w-4 text-accent" />
            <DialogTitle className="text-[15px]">
              {t("Phone Verification", "휴대폰 인증", "Verifica Telefonica")}
            </DialogTitle>
          </div>
          <DialogDescription className="text-[12px] text-foreground/65 leading-[1.6]">
            {t(
              "Phone verification is required to use OOTD features.",
              "OOTD 기능 이용을 위해 휴대폰 인증이 필요합니다.",
              "La verifica telefonica è richiesta per le funzionalità OOTD.",
            )}
          </DialogDescription>
        </DialogHeader>

        {step === "consent" && (
          <div className="space-y-4 pt-2">
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={t("Phone number (e.g. +82 10-1234-5678)", "전화번호 (예: 010-1234-5678)", "Telefono (es. +39 333 1234567)")}
              className="w-full bg-transparent border-b border-foreground/15 py-3 text-[14px] outline-none focus:border-accent transition-colors"
            />

            <button
              type="button"
              onClick={() => setConsent(!consent)}
              className="flex items-start gap-2.5 text-left w-full"
            >
              <span className={`mt-0.5 h-4 w-4 shrink-0 rounded border flex items-center justify-center ${
                consent ? "border-accent bg-accent/20" : "border-foreground/25"
              }`}>
                {consent && <span className="h-2 w-2 rounded-sm bg-accent" />}
              </span>
              <span className="text-[11.5px] text-foreground/70 leading-tight">
                <span className="text-[9px] font-bold tracking-[0.18em] mr-1.5 text-destructive/80">[REQUIRED]</span>
                {t(
                  "I consent to phone verification for OOTD features.",
                  "OOTD 기능 이용을 위한 휴대폰 인증에 동의합니다.",
                  "Acconsento alla verifica telefonica per le funzionalità OOTD.",
                )}
                {" "}
                <button type="button" onClick={(e) => { e.stopPropagation(); setViewing("phone"); }} className="text-accent/65 hover:text-accent font-semibold tracking-[0.12em] text-[9px]">VIEW</button>
              </span>
            </button>

            {error && <p className="text-[11px] text-destructive/80">{error}</p>}

            <button
              onClick={handleSendCode}
              disabled={loading}
              className="w-full py-3 text-[11px] font-semibold tracking-[0.18em] bg-foreground text-background rounded-md hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : t("SEND CODE", "인증번호 받기", "INVIA CODICE")}
            </button>
          </div>
        )}

        {step === "code" && (
          <div className="space-y-4 pt-2">
            {mockCode && (
              <div className="rounded border border-accent/30 bg-accent/10 p-3 text-center">
                <p className="text-[9px] font-bold tracking-[0.2em] text-accent/70">DEV MODE — MOCK CODE</p>
                <p className="font-mono text-2xl tracking-[0.3em] text-accent mt-1">{mockCode}</p>
              </div>
            )}
            <input
              type="text"
              value={code}
              maxLength={6}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder={t("Enter 6-digit code", "6자리 인증번호 입력", "Codice a 6 cifre")}
              className="w-full bg-transparent border-b border-foreground/15 py-3 text-center text-[18px] font-mono tracking-[0.3em] outline-none focus:border-accent transition-colors"
            />
            {error && <p className="text-[11px] text-destructive/80">{error}</p>}
            <button
              onClick={handleVerify}
              disabled={loading || code.length !== 6}
              className="w-full py-3 text-[11px] font-semibold tracking-[0.18em] bg-foreground text-background rounded-md hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : t("VERIFY", "인증하기", "VERIFICA")}
            </button>
            <button
              onClick={() => { setStep("consent"); setMockCode(null); setCode(""); }}
              className="w-full text-[10px] tracking-[0.18em] text-foreground/55 hover:text-foreground/80 transition-colors"
            >
              ← {t("BACK", "뒤로", "INDIETRO")}
            </button>
          </div>
        )}

        <LegalDocViewer docKey={viewing} open={viewing !== null} onOpenChange={(o) => { if (!o) setViewing(null); }} />
      </DialogContent>
    </Dialog>
  );
};

export default PhoneVerificationModal;
