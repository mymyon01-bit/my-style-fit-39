/**
 * Runtime app info — version code/name from @capacitor/app, plus build-time
 * signing fingerprint baked in by CI (see src/generated/buildInfo.ts).
 *
 * On web builds everything except BUILD_INFO is unavailable.
 */
import { useEffect, useState } from "react";
import { isNativeApp, nativePlatform } from "./platform";
import { BUILD_INFO } from "@/generated/buildInfo";

export type AppInfo = {
  isNative: boolean;
  platform: "android" | "ios" | "web";
  versionName: string;
  versionCode: string;
  bundleId: string;
  signingSha1: string;
  signingSha256: string;
  commitSha: string;
  builtAt: string;
};

export const useAppInfo = (): AppInfo => {
  const [info, setInfo] = useState<AppInfo>(() => ({
    isNative: isNativeApp(),
    platform: (nativePlatform() ?? "web") as AppInfo["platform"],
    versionName: BUILD_INFO.buildVersionName,
    versionCode: BUILD_INFO.buildVersionCode,
    bundleId: "com.mymyon.app",
    signingSha1: BUILD_INFO.signingSha1,
    signingSha256: BUILD_INFO.signingSha256,
    commitSha: BUILD_INFO.commitSha,
    builtAt: BUILD_INFO.builtAt,
  }));

  useEffect(() => {
    if (!isNativeApp()) return;
    let cancelled = false;
    (async () => {
      try {
        const { App } = await import("@capacitor/app");
        const i = await App.getInfo();
        if (cancelled) return;
        setInfo((prev) => ({
          ...prev,
          versionName: i.version || prev.versionName,
          versionCode: String(i.build ?? prev.versionCode),
          bundleId: i.id || prev.bundleId,
        }));
      } catch (e) {
        console.warn("[appInfo] App.getInfo failed", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return info;
};
