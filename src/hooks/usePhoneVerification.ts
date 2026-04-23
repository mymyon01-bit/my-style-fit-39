/**
 * usePhoneVerification — hook for the OOTD phone verification flow.
 *
 * In the current "mock/dev" mode the OTP is generated client-side and stored
 * in the `phone_verifications` row. The user types it back in to verify.
 *
 * When PortOne or Twilio is wired up later, swap the `requestOtp` body with
 * an edge function call — the React surface here stays the same.
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export type PhoneStatus = "idle" | "sending" | "awaiting_code" | "verifying" | "verified" | "failed";

export function usePhoneVerification() {
  const { user } = useAuth();
  const [phoneVerified, setPhoneVerified] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  // Read denormalized flag on the profile.
  useEffect(() => {
    let cancelled = false;
    if (!user) { setPhoneVerified(false); setLoading(false); return; }
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("phone_verified")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      setPhoneVerified(!!data?.phone_verified);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user]);

  /** Generate a mock OTP, store it, and reveal it (DEV). */
  const requestOtp = useCallback(async (phone: string): Promise<{ ok: boolean; mockCode?: string; error?: string; verificationId?: string }> => {
    if (!user) return { ok: false, error: "Not signed in" };
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const { data, error } = await supabase
      .from("phone_verifications")
      .insert({
        user_id: user.id,
        phone_number: phone,
        otp_code: code,
        provider: "mock",
        status: "pending",
      })
      .select("id")
      .single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, mockCode: code, verificationId: data.id };
  }, [user]);

  /** Validate the OTP and mark profile verified. */
  const verifyOtp = useCallback(async (verificationId: string, code: string): Promise<{ ok: boolean; error?: string }> => {
    if (!user) return { ok: false, error: "Not signed in" };
    const { data: row } = await supabase
      .from("phone_verifications")
      .select("otp_code, expires_at, status, phone_number")
      .eq("id", verificationId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!row) return { ok: false, error: "Verification not found" };
    if (row.status === "verified") return { ok: true };
    if (new Date(row.expires_at).getTime() < Date.now()) {
      await supabase.from("phone_verifications").update({ status: "expired" }).eq("id", verificationId);
      return { ok: false, error: "Code expired. Please request a new one." };
    }
    if (row.otp_code !== code.trim()) {
      await supabase.rpc as unknown; // no-op typing guard
      await supabase
        .from("phone_verifications")
        .update({ attempts: 1, status: "failed" })
        .eq("id", verificationId);
      return { ok: false, error: "Incorrect code" };
    }

    await supabase
      .from("phone_verifications")
      .update({ status: "verified", verified_at: new Date().toISOString(), otp_code: null })
      .eq("id", verificationId);

    await supabase
      .from("profiles")
      .update({
        phone_verified: true,
        phone_number: row.phone_number,
        phone_verified_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);

    setPhoneVerified(true);
    return { ok: true };
  }, [user]);

  return { phoneVerified, loading, requestOtp, verifyOtp };
}
