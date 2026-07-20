/**
 * ConsentGate — after a user authenticates (email/password, Google, Apple,
 * anything), verify they have accepted the required Terms & Privacy documents.
 * If not, block the app with a modal that forces acceptance before continuing.
 *
 * This satisfies Google/Apple sign-in compliance: even a user who signs in
 * with a social provider (bypassing the signup form) must record consent.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { CONSENT_UI, toLegalLang } from "@/lib/legal/content";
import ConsentCheckboxes, { type ConsentState } from "./ConsentCheckboxes";
import { recordSignupConsents } from "@/lib/legal/recordConsent";
import { Loader2 } from "lucide-react";

type GateState = "checking" | "ok" | "needs_consent";

const ConsentGate = () => {
  const { user, signOut } = useAuth();
  const { lang } = useI18n();
  const ui = CONSENT_UI[toLegalLang(lang)];

  const [state, setState] = useState<GateState>("checking");
  const [consents, setConsents] = useState<ConsentState>({ terms: false, privacy: false, marketing: false });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) { setState("ok"); return; }
    let cancelled = false;
    (async () => {
      setState("checking");
      try {
        const { data, error: qErr } = await supabase
          .from("user_consents")
          .select("consent_type, granted")
          .eq("user_id", user.id)
          .in("consent_type", ["terms", "privacy"]);
        if (cancelled) return;
        if (qErr) { setState("ok"); return; } // fail-open — never lock out
        const hasTerms = !!data?.find((r) => r.consent_type === "terms" && r.granted);
        const hasPrivacy = !!data?.find((r) => r.consent_type === "privacy" && r.granted);
        setState(hasTerms && hasPrivacy ? "ok" : "needs_consent");
      } catch {
        if (!cancelled) setState("ok");
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  const handleAccept = async () => {
    setError(null);
    if (!consents.terms || !consents.privacy) {
      setError(ui.gateRequiredError);
      return;
    }
    if (!user) return;
    setSaving(true);
    try {
      await recordSignupConsents(user.id, consents, toLegalLang(lang));
      setState("ok");
    } catch {
      setError(ui.gateRequiredError);
    } finally {
      setSaving(false);
    }
  };

  if (!user || state !== "needs_consent") return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-background/95 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-md bg-card border border-border rounded-3xl p-6 shadow-elevated my-6">
        <h2 className="font-display text-[20px] font-semibold text-foreground text-center">
          {ui.gateTitle}
        </h2>
        <p className="mt-2 text-[12.5px] text-foreground/70 text-center leading-relaxed">
          {ui.gateSubtitle}
        </p>
        <div className="mt-6">
          <ConsentCheckboxes value={consents} onChange={setConsents} />
        </div>
        {error && <p className="mt-3 text-[12px] text-destructive/80 text-center">{error}</p>}
        <button
          onClick={handleAccept}
          disabled={saving || !consents.terms || !consents.privacy}
          className="mt-6 w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-[12px] font-semibold tracking-[0.15em] text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {ui.gateAccept}
        </button>
        <button
          onClick={() => void signOut()}
          className="mt-3 w-full text-[11px] text-foreground/55 hover:text-foreground/80"
        >
          {ui.gateSignOut}
        </button>
      </div>
    </div>
  );
};

export default ConsentGate;
