import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I

const makeCode = (len = 8) => {
  let out = "";
  const arr = new Uint32Array(len);
  crypto.getRandomValues(arr);
  for (let i = 0; i < len; i++) out += CODE_ALPHABET[arr[i] % CODE_ALPHABET.length];
  return out;
};

/**
 * Returns the current user's referral code, generating one on first call.
 * Returns null when the user is not logged in or while loading.
 */
export function useReferralCode() {
  const { user } = useAuth();
  const [code, setCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user) {
        setCode(null);
        setLoading(false);
        return;
      }
      setLoading(true);

      const { data: existing } = await supabase
        .from("referrals")
        .select("code")
        .eq("referrer_id", user.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing?.code) {
        if (!cancelled) {
          setCode(existing.code);
          setLoading(false);
        }
        return;
      }

      // Generate a new pending code
      for (let attempt = 0; attempt < 5; attempt++) {
        const candidate = makeCode();
        const { error } = await supabase.from("referrals").insert({
          referrer_id: user.id,
          code: candidate,
          status: "pending",
        });
        if (!error) {
          if (!cancelled) {
            setCode(candidate);
            setLoading(false);
          }
          return;
        }
        // unique conflict — try again
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user]);

  return { code, loading };
}

const REF_KEY = "wardrobe.referralCode";

export function captureReferralFromUrl() {
  if (typeof window === "undefined") return;
  try {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (ref && /^[A-Z0-9]{4,16}$/.test(ref)) {
      sessionStorage.setItem(REF_KEY, ref);
    }
  } catch { /* ignore */ }
}

export function consumeStoredReferral(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const v = sessionStorage.getItem(REF_KEY);
    if (v) sessionStorage.removeItem(REF_KEY);
    return v;
  } catch {
    return null;
  }
}

export async function claimReferralIfAny(): Promise<{ ok: boolean; reason?: string; stars?: number } | null> {
  const code = consumeStoredReferral();
  if (!code) return null;
  const { data, error } = await supabase.rpc("claim_referral" as any, { _code: code });
  if (error) return { ok: false, reason: error.message };
  const r = data as any;
  return { ok: !!r?.ok, reason: r?.reason, stars: r?.stars_awarded };
}
