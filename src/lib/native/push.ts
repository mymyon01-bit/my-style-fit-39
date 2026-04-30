/**
 * Push notifications bootstrap for the native iOS/Android shell.
 * No-op on web. Call `initPushNotifications()` ONLY after the user has
 * explicitly opted in (e.g. via the PermissionsPrompt) — never on app
 * boot. Auto-prompting on launch caused the app to freeze on some
 * Android builds because the permission dialog blocked the WebView's
 * first paint.
 *
 * Tokens are POSTed to the `register-device-token` Lovable Cloud edge
 * function which upserts them into `push_device_tokens` for later targeting.
 */
import { supabase } from "@/integrations/supabase/client";
import { isNativeApp, nativePlatform } from "./platform";

let initialized = false;

const sendTokenToBackend = async (
  token: string,
  platform: "ios" | "android",
) => {
  try {
    const { error } = await supabase.functions.invoke(
      "register-device-token",
      {
        body: { token, platform, app_version: "1.0.0" },
      },
    );
    if (error) console.error("[push] register-device-token failed", error);
  } catch (e) {
    console.error("[push] register-device-token threw", e);
  }
};

/**
 * Returns the current permission status without requesting it. Safe to call
 * on every launch — used to decide whether to show the in-app prompt.
 */
export const getPushPermissionStatus = async (): Promise<
  "granted" | "denied" | "prompt" | "unavailable"
> => {
  if (!isNativeApp()) return "unavailable";
  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    const res = await PushNotifications.checkPermissions();
    if (res.receive === "granted") return "granted";
    if (res.receive === "denied") return "denied";
    return "prompt";
  } catch (e) {
    console.warn("[push] checkPermissions failed", e);
    return "unavailable";
  }
};

/**
 * Requests permission and registers for push. Wrapped in try/catch so a
 * plugin failure can never crash the React tree.
 */
export const initPushNotifications = async (
  onToken?: (token: string, platform: "ios" | "android") => void,
): Promise<"granted" | "denied" | "error"> => {
  if (!isNativeApp()) return "error";
  if (initialized) return "granted";

  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");

    const perm = await PushNotifications.requestPermissions();
    if (perm.receive !== "granted") return "denied";

    initialized = true;
    await PushNotifications.register();

    PushNotifications.addListener("registration", (token) => {
      const platform = nativePlatform();
      if (platform !== "ios" && platform !== "android") return;
      sendTokenToBackend(token.value, platform);
      onToken?.(token.value, platform);
    });

    PushNotifications.addListener("registrationError", (err) => {
      console.error("[push] registration error", err);
    });

    PushNotifications.addListener("pushNotificationReceived", (n) => {
      console.log("[push] received", n);
    });

    PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
      console.log("[push] action", action);
    });

    return "granted";
  } catch (e) {
    console.error("[push] init failed", e);
    return "error";
  }
};
