/**
 * useEmailVerified — checks whether the current user has confirmed their
 * email via Supabase auth. Used to gate OOTD posting.
 *
 * Supabase populates `user.email_confirmed_at` once the confirmation link
 * is clicked. We refresh the session on demand so the UI reacts as soon
 * as the user comes back from their inbox.
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export function useEmailVerified() {
  const { user } = useAuth();
  const [verified, setVerified] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setVerified(false); setLoading(false); return; }
    setVerified(!!user.email_confirmed_at);
    setLoading(false);
  }, [user]);

  /** Re-send the confirmation email to the current user. */
  const resendVerification = useCallback(async (): Promise<{ ok: boolean; error?: string }> => {
    if (!user?.email) return { ok: false, error: "No email on record" };
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: user.email,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }, [user]);

  /** Pull a fresh session — call after the user returns from their inbox. */
  const refresh = useCallback(async () => {
    const { data } = await supabase.auth.refreshSession();
    setVerified(!!data.user?.email_confirmed_at);
    return !!data.user?.email_confirmed_at;
  }, []);

  return { verified, loading, email: user?.email ?? null, resendVerification, refresh };
}
