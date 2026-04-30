/**
 * OAuth Bridge — opened by the native app inside the system browser.
 *
 * Flow:
 *  1. Native app opens https://mymyon.com/~oauth-bridge?provider=google&return=mymyon://auth-callback
 *  2. This page triggers lovable.auth.signInWithOAuth(provider) which redirects
 *     to Google → Lovable Cloud callback → back to this page with a session.
 *  3. Once the session is set, redirect to `mymyon://auth-callback#access_token=...&refresh_token=...`
 *     which the Capacitor app intercepts via App.addListener("appUrlOpen").
 *
 * The page itself shows a tiny "signing you in…" UI; users only see it for
 * a few seconds during the OAuth round-trip.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

const OAuthBridge = () => {
  const [status, setStatus] = useState<"working" | "error">("working");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const provider = (params.get("provider") || "google") as "google" | "apple";
    const ret = params.get("return") || "mymyon://auth-callback";

    let cancelled = false;

    const handToApp = (
      access_token?: string,
      refresh_token?: string,
      error?: string,
    ) => {
      const url = new URL(ret);
      if (error) {
        url.searchParams.set("error", error);
      } else if (access_token && refresh_token) {
        url.hash = `access_token=${encodeURIComponent(access_token)}&refresh_token=${encodeURIComponent(refresh_token)}`;
      }
      window.location.replace(url.toString());
    };

    const run = async () => {
      // 1) If we already have a session (we're returning from the OAuth provider),
      //    hand the tokens back to the native app immediately.
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token && session?.refresh_token) {
        handToApp(session.access_token, session.refresh_token);
        return;
      }

      // 2) Otherwise, kick off the OAuth flow. After the redirect back, the
      //    page reloads, supabase persists the session, and the branch above
      //    runs.
      try {
        const result = await lovable.auth.signInWithOAuth(provider, {
          redirect_uri: window.location.href, // come back here
        });
        if (cancelled) return;
        if (result.error) {
          setErrorMsg(String(result.error));
          setStatus("error");
          handToApp(undefined, undefined, String(result.error));
          return;
        }
        // result.redirected === true → browser is navigating to provider, nothing to do.
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : "oauth_failed";
        setErrorMsg(msg);
        setStatus("error");
        handToApp(undefined, undefined, msg);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6 text-center">
      {status === "working" ? (
        <>
          <div className="mb-4 h-10 w-10 animate-spin rounded-full border-2 border-foreground/20 border-t-foreground" />
          <p className="font-mono text-[12px] tracking-[0.2em] text-foreground/70">
            SIGNING YOU IN…
          </p>
          <p className="mt-2 text-[11px] text-foreground/40">
            You'll be returned to the app automatically.
          </p>
        </>
      ) : (
        <>
          <p className="font-mono text-[12px] tracking-[0.2em] text-destructive">
            SIGN-IN FAILED
          </p>
          <p className="mt-2 max-w-xs text-[11px] text-foreground/60">{errorMsg}</p>
        </>
      )}
    </div>
  );
};

export default OAuthBridge;
