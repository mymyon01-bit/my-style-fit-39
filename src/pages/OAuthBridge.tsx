/**
 * OAuth Bridge — opened by the native app inside the system browser.
 *
 * Flow:
 *  1. Native app generates a `nonce` and opens
 *     https://mymyon.com/~oauth-bridge?provider=google&nonce=NONCE
 *  2. This page triggers lovable.auth.signInWithOAuth(provider) which redirects
 *     to Google → Lovable Cloud callback → back to this page (?nonce= preserved
 *     because we set redirect_uri to window.location.href).
 *  3. Once the session is set, POST the tokens to the oauth-token-exchange
 *     edge function keyed by `nonce`. The native app polls that function and
 *     receives the tokens.
 *  4. As a best-effort fallback we ALSO try the old custom-scheme deep link
 *     `mymyon://auth-callback#access_token=...` so existing builds with the
 *     scheme registered still work instantly.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/oauth-token-exchange`;

const OAuthBridge = () => {
  const [status, setStatus] = useState<"working" | "done" | "error">("working");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const provider = (params.get("provider") || "google") as "google" | "apple";
    const nonce = params.get("nonce") || "";
    const ret = params.get("return") || "mymyon://auth-callback";

    let cancelled = false;

    const handToApp = async (
      access_token?: string,
      refresh_token?: string,
      error?: string,
    ) => {
      // 1) Push tokens to the exchange table so the polling native app picks them up.
      if (nonce && access_token && refresh_token) {
        try {
          await fetch(`${FN_URL}?action=store`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            },
            body: JSON.stringify({ nonce, access_token, refresh_token }),
          });
        } catch {
          /* swallow — fallback below still tries deep link */
        }
      }

      // 2) Fallback: try the legacy custom-scheme deep link too.
      try {
        const url = new URL(ret);
        if (error) {
          url.searchParams.set("error", error);
        } else if (access_token && refresh_token) {
          url.hash = `access_token=${encodeURIComponent(access_token)}&refresh_token=${encodeURIComponent(refresh_token)}`;
        }
        // Use location.replace so the system browser's history doesn't keep this page.
        window.location.replace(url.toString());
      } catch {
        /* deep link not registered — that's fine, the polling path works. */
      }

      setStatus("done");
    };

    const run = async () => {
      // 1) Already have a session (returning from provider) → hand off immediately.
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token && session?.refresh_token) {
        await handToApp(session.access_token, session.refresh_token);
        return;
      }

      // 2) Otherwise kick off OAuth. Provider will redirect back here, the
      //    branch above runs on next mount.
      try {
        const result = await lovable.auth.signInWithOAuth(provider, {
          redirect_uri: window.location.href, // preserves ?nonce=
        });
        if (cancelled) return;
        if (result.error) {
          const msg = String(result.error);
          setErrorMsg(msg);
          setStatus("error");
          await handToApp(undefined, undefined, msg);
          return;
        }
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : "oauth_failed";
        setErrorMsg(msg);
        setStatus("error");
        await handToApp(undefined, undefined, msg);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6 text-center">
      {status === "error" ? (
        <>
          <p className="font-mono text-[12px] tracking-[0.2em] text-destructive">
            SIGN-IN FAILED
          </p>
          <p className="mt-2 max-w-xs text-[11px] text-foreground/60">{errorMsg}</p>
        </>
      ) : status === "done" ? (
        <>
          <p className="font-mono text-[12px] tracking-[0.2em] text-foreground/70">
            SIGNED IN — RETURN TO THE APP
          </p>
          <p className="mt-2 max-w-xs text-[11px] text-foreground/40">
            You can close this browser tab now.
          </p>
        </>
      ) : (
        <>
          <div className="mb-4 h-10 w-10 animate-spin rounded-full border-2 border-foreground/20 border-t-foreground" />
          <p className="font-mono text-[12px] tracking-[0.2em] text-foreground/70">
            SIGNING YOU IN…
          </p>
        </>
      )}
    </div>
  );
};

export default OAuthBridge;
