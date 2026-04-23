/**
 * EmailVerificationModal — appears when an unverified user attempts to use
 * an OOTD feature. Shows the email on file, a resend button, and an
 * "I've verified" button that re-checks the session.
 *
 * Verification itself happens in the user's inbox (Supabase magic link).
 */
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Loader2, Mail, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useEmailVerified } from "@/hooks/useEmailVerified";
import { useI18n } from "@/lib/i18n";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVerified?: () => void;
}

const EmailVerificationModal = ({ open, onOpenChange, onVerified }: Props) => {
  const { lang } = useI18n();
  const { email, resendVerification, refresh } = useEmailVerified();
  const [sending, setSending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [sentAt, setSentAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isKR = lang === "ko";
  const isIT = lang === "it";
  const t = (en: string, ko: string, it: string) => isKR ? ko : isIT ? it : en;

  const handleResend = async () => {
    setError(null); setSending(true);
    const res = await resendVerification();
    setSending(false);
    if (!res.ok) { setError(res.error ?? "Failed"); return; }
    setSentAt(Date.now());
    toast.success(t("Verification email sent", "인증 메일을 보냈습니다", "Email di verifica inviata"));
  };

  const handleCheck = async () => {
    setError(null); setChecking(true);
    const ok = await refresh();
    setChecking(false);
    if (ok) {
      toast.success(t("Email verified", "이메일 인증 완료", "Email verificata"));
      onVerified?.();
      onOpenChange(false);
    } else {
      setError(t(
        "Not verified yet. Check your inbox and click the link.",
        "아직 인증되지 않았습니다. 받은편지함에서 링크를 클릭해주세요.",
        "Non ancora verificata. Controlla la tua casella di posta.",
      ));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <Mail className="h-4 w-4 text-accent" />
            <DialogTitle className="text-[15px]">
              {t("Email Verification", "이메일 인증", "Verifica Email")}
            </DialogTitle>
          </div>
          <DialogDescription className="text-[12px] text-foreground/65 leading-[1.6]">
            {t(
              "Email verification is required to use OOTD features.",
              "OOTD 기능 이용을 위해 이메일 인증이 필요합니다.",
              "La verifica email è richiesta per le funzionalità OOTD.",
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="rounded border border-foreground/[0.08] bg-foreground/[0.03] p-3">
            <p className="text-[9px] font-bold tracking-[0.2em] text-foreground/45">
              {t("EMAIL ON FILE", "등록된 이메일", "EMAIL REGISTRATA")}
            </p>
            <p className="font-mono text-[13px] text-foreground/85 mt-1 break-all">
              {email ?? "—"}
            </p>
          </div>

          <p className="text-[11.5px] text-foreground/65 leading-[1.6]">
            {t(
              "We've sent a confirmation link to your email. Click the link, then come back and tap \"I've verified\".",
              "이메일로 인증 링크를 보냈습니다. 링크를 클릭한 후 돌아와서 \"인증 완료\"를 눌러주세요.",
              "Abbiamo inviato un link di conferma alla tua email. Clicca il link, poi torna e tocca \"Verificato\".",
            )}
          </p>

          {error && <p className="text-[11px] text-destructive/80">{error}</p>}

          <div className="space-y-2">
            <button
              onClick={handleCheck}
              disabled={checking}
              className="w-full py-3 text-[11px] font-semibold tracking-[0.18em] bg-foreground text-background rounded-md hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {checking
                ? <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                : t("I'VE VERIFIED", "인증 완료", "HO VERIFICATO")}
            </button>

            <button
              onClick={handleResend}
              disabled={sending || (sentAt !== null && Date.now() - sentAt < 30_000)}
              className="w-full py-2.5 text-[10px] font-semibold tracking-[0.18em] text-foreground/70 hover:text-foreground border border-foreground/15 rounded-md transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {sending
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <RefreshCw className="h-3.5 w-3.5" />}
              {t("RESEND EMAIL", "메일 재발송", "REINVIA EMAIL")}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EmailVerificationModal;
