/**
 * Platform helpers — single source of truth for "is this the native app?"
 * vs "is this a phone in a browser?". Used by the Open-in-app banner and
 * by camera / push helpers to no-op on web.
 */
import { Capacitor } from "@capacitor/core";

export const isNativeApp = (): boolean => Capacitor.isNativePlatform();

export const nativePlatform = (): "ios" | "android" | "web" => {
  const p = Capacitor.getPlatform();
  return p === "ios" || p === "android" ? p : "web";
};

export const isMobileBrowser = (): boolean => {
  if (isNativeApp()) return false;
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
};

export const detectMobileOS = (): "ios" | "android" | null => {
  if (typeof navigator === "undefined") return null;
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return null;
};
