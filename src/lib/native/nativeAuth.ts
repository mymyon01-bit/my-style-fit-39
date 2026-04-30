/**
 * Native OAuth — opens the system browser (Chrome Custom Tabs on Android,
 * Safari View Controller on iOS) pointing at our public web domain
 * (https://mymyon.com/~oauth-bridge), where Lovable Cloud finishes the
 * OAuth handshake.
 *
 * To get the resulting tokens back into the WebView we use TWO transports
 * in parallel — whichever lands first wins:
 *   (a) A custom-scheme deep link (`mymyon://auth-callback#access_token=...`)
 *       captured via `App.addListener("appUrlOpen", ...)`. This requires the
 *       Android intent-filter / iOS URL-scheme to be registered.
 *   (b) An HTTPS polling fallback against the `oauth-token-exchange` edge
 *       function, keyed by a one-time `nonce` we generated. This works
 *       even if the deep-link scheme isn't registered (which was the cause
 *       of the previous "browser closes, login fails" reports).
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
const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/oauth-token-exchange`;
const APIKEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const POLL_INTERVAL_MS = 1500;
const MAX_WAIT_MS = 5 * 60 * 1000; // 5 minutes
const POST_CLOSE_GRACE_MS = 8000; // keep polling 8s after browser closed

const makeNonce = () => {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
};

interface PollResult {
  access_token?: string;
  refresh_token?: string;
  error?: string;
}

const pollExchange = async (nonce: string): Promise<PollResult | null> => {
  try {
    const res = await fetch(`${FN_URL}?action=claim&nonce=${encodeURIComponent(nonce)}`, {
      method: "GET",
      headers: { apikey: APIKEY, Authorization: `Bearer ${APIKEY}` },
    });
    if (!res.ok) return null;
    const body = await res.json().catch(() => null);
    if (!body) return null;
    if (body.pending) return null;
    if (body.error) return { error: String(body.error) };
    if (body.access_token && body.refresh_token)
      return { access_token: body.access_token, refresh_token: body.refresh_token };
    return null;
  } catch {
    return null;
  }
};

const openOAuthInBrowser = async (
  provider: "google" | "apple",
): Promise<NativeOAuthResult> => {
  try {
    const { Browser } = await import("@capacitor/browser");
    const { App } = await import("@capacitor/app");

    const nonce = makeNonce();
    const bridgeUrl =
      `${WEB_ORIGIN}/~oauth-bridge` +
      `?provider=${provider}` +
      `&nonce=${encodeURIComponent(nonce)}` +
      `&return=${encodeURIComponent(APP_SCHEME)}`;

    // Promise that resolves when ANY of the transports delivers tokens
    // (deep link OR polling) OR a hard error / timeout occurs.
    const tokenPromise = new Promise<PollResult>((resolve) => {
      let settled = false;
      let browserClosedAt: number | null = null;
      const settle = (v: PollResult) => {
        if (settled) return;
        settled = true;
        resolve(v);
      };

      // (a) Deep-link path
      const urlHandle = App.addListener("appUrlOpen", async ({ url }) => {
        if (!url.startsWith("mymyon://auth-callback")) return;
        try { await Browser.close(); } catch { /* noop */ }
        const u = new URL(url);
        const hashParams = new URLSearchParams(u.hash.replace(/^#/, ""));
        const queryParams = u.searchParams;
        const access_token = hashParams.get("access_token") ?? queryParams.get("access_token") ?? undefined;
        const refresh_token = hashParams.get("refresh_token") ?? queryParams.get("refresh_token") ?? undefined;
        const error = queryParams.get("error") ?? hashParams.get("error") ?? undefined;
        urlHandle.then((h) => h.remove()).catch(() => {});
        if (error) settle({ error });
        else settle({ access_token, refresh_token });
      });

      // (b) Polling path
      const startedAt = Date.now();
      const pollTimer = setInterval(async () => {
        if (settled) { clearInterval(pollTimer); return; }
        if (Date.now() - startedAt > MAX_WAIT_MS) {
          clearInterval(pollTimer);
          settle({ error: "timeout" });
          return;
        }
        // Stop polling shortly after the browser is closed if nothing arrived.
        if (browserClosedAt && Date.now() - browserClosedAt > POST_CLOSE_GRACE_MS) {
          clearInterval(pollTimer);
          settle({ error: "browser_closed" });
          return;
        }
        const r = await pollExchange(nonce);
        if (r && (r.error || (r.access_token && r.refresh_token))) {
          clearInterval(pollTimer);
          try { await Browser.close(); } catch { /* noop */ }
          settle(r);
        }
      }, POLL_INTERVAL_MS);

      // Browser-closed signal — start the grace window.
      const closeHandle = Browser.addListener("browserFinished", () => {
        browserClosedAt = Date.now();
        closeHandle.then((h) => h.remove()).catch(() => {});
      });
    });

    await Browser.open({ url: bridgeUrl, presentationStyle: "popover" });

    const result = await tokenPromise;

    if (result.error) return { ok: false, error: result.error };
    if (!result.access_token || !result.refresh_token)
      return { ok: false, error: "no_tokens" };

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
