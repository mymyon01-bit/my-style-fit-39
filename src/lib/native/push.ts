/**
 * Push notifications bootstrap for the native iOS/Android shell.
 * No-op on web. Call `initPushNotifications()` once after the user is signed
 * in so we have an auth context to associate the device token with.
 *
 * Tokens are sent to the `register-device-token` Lovable Cloud edge function
 * (create that function later — for now we just log them).
 */
import { PushNotifications } from "@capacitor/push-notifications";
import { isNativeApp, nativePlatform } from "./platform";

let initialized = false;

export const initPushNotifications = async (
  onToken?: (token: string, platform: "ios" | "android") => void
): Promise<void> => {
  if (!isNativeApp() || initialized) return;
  initialized = true;

  const perm = await PushNotifications.requestPermissions();
  if (perm.receive !== "granted") return;

  await PushNotifications.register();

  PushNotifications.addListener("registration", (token) => {
    const platform = nativePlatform();
    if (platform === "ios" || platform === "android") {
      onToken?.(token.value, platform);
    }
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
