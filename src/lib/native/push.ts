/**
 * Push notifications bootstrap for the native iOS/Android shell.
 * No-op on web. Call `initPushNotifications(userId)` once after the user is
 * signed in so we have an auth context to associate the device token with.
 *
 * Tokens are POSTed to the `register-device-token` Lovable Cloud edge
 * function which upserts them into `push_device_tokens` for later targeting.
 */
import { PushNotifications } from "@capacitor/push-notifications";
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
        body: {
          token,
          platform,
          app_version: "1.0.0",
        },
      },
    );
    if (error) console.error("[push] register-device-token failed", error);
  } catch (e) {
    console.error("[push] register-device-token threw", e);
  }
};

export const initPushNotifications = async (
  onToken?: (token: string, platform: "ios" | "android") => void,
): Promise<void> => {
  if (!isNativeApp() || initialized) return;
  initialized = true;

  const perm = await PushNotifications.requestPermissions();
  if (perm.receive !== "granted") return;

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
};
