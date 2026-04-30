/**
 * Native OAuth — opens the system browser (Chrome Custom Tabs on Android,
 * Safari View Controller on iOS) pointing at our public web domain
 * (https://mymyon.com/~oauth-bridge), where Lovable Cloud finishes the
 * OAuth handshake. The bridge page then redirects to a custom-scheme URL
 * (`mymyon://auth-callback#access_token=...&refresh_token=...`) which the
 * app intercepts via `App.addListener("appUrlOpen", ...)` to set the
 * Supabase session.
 *
 * On web this returns null so callers fall back to the regular
 * `lovable.auth.signInWithOAuth` redirect flow.
 */
import { supabase } from "@/integrations/supabase/client";
import { isNativeApp } from "./platform";

export interface NativeOAuthResult {
  ok: boolean;
  error?: string;
}

const WEB_ORIGIN = "https://mymyon.com";
const APP_SCHEME = "mymyon://auth-callback";

const openOAuthInBrowser = async (
  provider: "google" | "apple",
): Promise<NativeOAuthResult> => {
  try {
    const { Browser } = await import("@capacitor/browser");
    const { App } = await import("@capacitor/app");

    // Build the bridge URL. The web app at /~oauth-bridge will trigger
    // lovable.auth.signInWithOAuth and, on success, redirect to APP_SCHEME
    // with the session tokens in the URL hash.
    const bridgeUrl = `${WEB_ORIGIN}/~oauth-bridge?provider=${provider}&return=${encodeURIComponent(APP_SCHEME)}`;

    // Promise that resolves when the deep link comes back to the app, OR
    // when the user closes the in-app browser. The deep-link path is the
    // happy path; the browser-finished path is a fallback so we don't hang
    // forever if the deep link scheme isn't registered on the device.
    const tokenPromise = new Promise<{ access_token?: string; refresh_token?: string; error?: string }>(
      (resolve) => {
        let settled = false;
        const settle = (v: { access_token?: string; refresh_token?: string; error?: string }) => {
          if (settled) return;
          settled = true;
          resolve(v);
        };

        const urlHandle = App.addListener("appUrlOpen", async ({ url }) => {
          if (!url.startsWith("mymyon://auth-callback")) return;
          try { await Browser.close(); } catch { /* noop */ }
          // Tokens come back in the URL hash (#access_token=...&refresh_token=...)
          // or as ?error=... on failure.
          const u = new URL(url);
          const hashParams = new URLSearchParams(u.hash.replace(/^#/, ""));
          const queryParams = u.searchParams;
          const access_token = hashParams.get("access_token") ?? queryParams.get("access_token") ?? undefined;
          const refresh_token = hashParams.get("refresh_token") ?? queryParams.get("refresh_token") ?? undefined;
          const error = queryParams.get("error") ?? hashParams.get("error") ?? undefined;
          urlHandle.then((h) => h.remove());
          settle({ access_token, refresh_token, error: error || undefined });
        });

        // Fallback: if the user closes the browser without the deep link
        // firing (e.g. cancelled, or scheme not registered), fail fast so
        // the UI can show "sign-in cancelled" instead of spinning forever.
        const closeHandle = Browser.addListener("browserFinished", () => {
          // Give the deep-link handler a beat to win the race.
          setTimeout(() => {
            settle({ error: "browser_closed" });
            closeHandle.then((h) => h.remove());
          }, 600);
        });
      },
    );

    await Browser.open({ url: bridgeUrl, presentationStyle: "popover" });

    // Wait up to 5 minutes for the user to complete OAuth.
    const result = await Promise.race([
      tokenPromise,
      new Promise<{ error: string }>((resolve) =>
        setTimeout(() => resolve({ error: "timeout" }), 5 * 60 * 1000),
      ),
    ]);

    if ("error" in result && result.error) {
      return { ok: false, error: result.error };
    }
    if (!("access_token" in result) || !result.access_token || !result.refresh_token) {
      return { ok: false, error: "no_tokens" };
    }

    const { error } = await supabase.auth.setSession({
      access_token: result.access_token,
      refresh_token: result.refresh_token,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : `${provider}_failed` };
  }
};

export const signInWithGoogleNative = async (): Promise<NativeOAuthResult | null> => {
  if (!isNativeApp()) return null;
  return openOAuthInBrowser("google");
};

export const signInWithAppleNative = async (): Promise<NativeOAuthResult | null> => {
  if (!isNativeApp()) return null;
  return openOAuthInBrowser("apple");
};
