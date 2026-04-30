/**
 * App self-update for the Android sideload build.
 *
 * Flow:
 *  1. On boot (native only), fetch the latest published `app_releases` row
 *     for `platform = 'android'`.
 *  2. Compare its `version_code` with the currently-installed code from
 *     `@capacitor/app` getInfo().
 *  3. If newer, return the release so the UI can offer Install / Later.
 *  4. On Install, open the APK URL via @capacitor/browser. Android's
 *     download manager grabs the file and Package Installer shows the
 *     system update dialog. When the APK is signed with the SAME keystore
 *     as the installed app, Android replaces it in-place WITHOUT asking
 *     to uninstall first and WITHOUT wiping user data. If the user sees
 *     "uninstall existing app" — that's a signature mismatch on the
 *     server-side build, not a bug in this code.
 *
 * NOTE: We intentionally do NOT use `@capacitor/filesystem` to download
 * the APK ourselves and then trigger PackageInstaller via a custom
 * intent — that requires a custom native plugin and FileProvider config.
 * Letting the system browser/download-manager handle the .apk URL is the
 * standard, zero-extra-permission path for sideload updates.
 */
import { supabase } from "@/integrations/supabase/client";
import { isNativeApp, nativePlatform } from "./platform";

export type AppRelease = {
  id: string;
  version_name: string;
  version_code: number;
  apk_url: string;
  release_notes: string | null;
  is_critical: boolean;
  min_supported_version_code: number;
};

const SKIP_KEY = "wardrobe:update-skipped:";

/**
 * Returns the installed app's version_code, or null on web / failure.
 */
const getInstalledVersionCode = async (): Promise<number | null> => {
  if (!isNativeApp()) return null;
  try {
    const { App } = await import("@capacitor/app");
    const info = await App.getInfo();
    // On Android, `build` is the integer versionCode as a string.
    const code = parseInt(info.build, 10);
    return Number.isFinite(code) ? code : null;
  } catch (e) {
    console.warn("[update] getInfo failed", e);
    return null;
  }
};

export type UpdateCheckResult =
  | { status: "current" }
  | { status: "unavailable" }
  | { status: "available"; release: AppRelease; installedCode: number };

/**
 * Checks whether a newer release exists. Safe to call on every cold boot.
 */
export const checkForUpdate = async (): Promise<UpdateCheckResult> => {
  if (!isNativeApp() || nativePlatform() !== "android") {
    return { status: "unavailable" };
  }

  const installedCode = await getInstalledVersionCode();
  if (installedCode == null) return { status: "unavailable" };

  const { data, error } = await supabase
    .from("app_releases")
    .select("id, version_name, version_code, apk_url, release_notes, is_critical, min_supported_version_code")
    .eq("platform", "android")
    .eq("is_published", true)
    .order("version_code", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn("[update] release lookup failed", error.message);
    return { status: "unavailable" };
  }
  if (!data) return { status: "unavailable" };

  if (data.version_code <= installedCode) return { status: "current" };

  return { status: "available", release: data as AppRelease, installedCode };
};

/**
 * Whether the user previously dismissed this exact version. Critical
 * updates ignore this flag and always prompt.
 */
export const hasUserSkipped = (release: AppRelease): boolean => {
  if (release.is_critical) return false;
  try {
    return localStorage.getItem(SKIP_KEY + release.version_code) === "1";
  } catch {
    return false;
  }
};

export const markUserSkipped = (release: AppRelease): void => {
  try {
    localStorage.setItem(SKIP_KEY + release.version_code, "1");
  } catch {
    // ignore
  }
};

/**
 * Triggers the Android system download + install flow. Opens the APK URL
 * in the system browser so the platform's PackageInstaller takes over.
 */
export const installUpdate = async (release: AppRelease): Promise<void> => {
  try {
    const { Browser } = await import("@capacitor/browser");
    // `windowName: "_system"` ensures Android opens the URL with the
    // external download manager (which then hands the .apk to PackageInstaller).
    await Browser.open({ url: release.apk_url, windowName: "_system" });
  } catch (e) {
    console.error("[update] install open failed", e);
    // Fallback: just navigate the WebView. Most Android WebViews refuse
    // to load .apk inline and will hand it to the download manager too.
    if (typeof window !== "undefined") window.location.href = release.apk_url;
  }
};
