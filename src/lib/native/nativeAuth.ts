/**
 * Native OAuth helpers — uses the OS sign-in sheets (Apple / Google) when
 * running inside the Capacitor shell. On web this returns `null` so the
 * caller falls back to `lovable.auth.signInWithOAuth` (browser redirect).
 *
 * Both providers return an ID token which we hand to Supabase via
 * `signInWithIdToken`, the canonical "verified by Apple/Google" path.
 */
import { supabase } from "@/integrations/supabase/client";
import { isNativeApp, nativePlatform } from "./platform";

export interface NativeOAuthResult {
  ok: boolean;
  error?: string;
}

/**
 * Native Apple Sign-In (iOS only — Apple does not support native
 * sheets on Android). Returns null on web/Android so caller can use
 * the web redirect flow.
 */
export const signInWithAppleNative = async (): Promise<NativeOAuthResult | null> => {
  if (!isNativeApp() || nativePlatform() !== "ios") return null;

  try {
    const { SignInWithApple } = await import(
      "@capacitor-community/apple-sign-in"
    );
    const res = await SignInWithApple.authorize({
      clientId: "com.mymyon.app",
      redirectURI: "https://mymyon.com",
      scopes: "email name",
      state: "mymyon",
      nonce: crypto.randomUUID(),
    });

    const idToken = res.response?.identityToken;
    if (!idToken) return { ok: false, error: "no_identity_token" };

    const { error } = await supabase.auth.signInWithIdToken({
      provider: "apple",
      token: idToken,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "apple_failed" };
  }
};

/**
 * Native Google Sign-In (iOS + Android). Requires platform setup in
 * Xcode/Android Studio — see MOBILE.md. Returns null on web so caller
 * falls back to the existing browser OAuth flow.
 */
export const signInWithGoogleNative = async (): Promise<NativeOAuthResult | null> => {
  if (!isNativeApp()) return null;

  try {
    const { GoogleAuth } = await import(
      "@codetrix-studio/capacitor-google-auth"
    );
    await GoogleAuth.initialize();
    const user = await GoogleAuth.signIn();
    const idToken = user.authentication?.idToken;
    if (!idToken) return { ok: false, error: "no_id_token" };

    const { error } = await supabase.auth.signInWithIdToken({
      provider: "google",
      token: idToken,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "google_failed" };
  }
};
