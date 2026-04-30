/**
 * UpdateBanner — checks GitHub Releases for a newer APK and shows a
 * dismissible banner with a one-tap update flow.
 *
 * Only renders inside the Capacitor native shell. On the web there is
 * nothing to update because the bundle reloads on every visit.
 */
import { useEffect, useState } from "react";
import { Download, X, Sparkles } from "lucide-react";
import { App } from "@capacitor/app";
import { isNativeApp } from "@/lib/native/platform";

const RELEASES_API =
  "https://api.github.com/repos/mymyon01-bit/my-style-fit-39/releases/tags/latest-apk";
const APK_URL =
  "https://github.com/mymyon01-bit/my-style-fit-39/releases/download/latest-apk/mymyon.apk";
const DISMISS_KEY_PREFIX = "mymyon.update-dismissed.";

interface ReleaseInfo {
  versionCode: number;
  versionName: string;
}

const parseRelease = (body: string): ReleaseInfo | null => {
  const codeMatch = body.match(/versionCode:\s*(\d+)/i);
  const nameMatch = body.match(/versionName:\s*([\w.\-]+)/i);
  if (!codeMatch) return null;
  return {
    versionCode: parseInt(codeMatch[1], 10),
    versionName: nameMatch?.[1] ?? "latest",
  };
};

const UpdateBanner = () => {
  const [latest, setLatest] = useState<ReleaseInfo | null>(null);
  const [currentCode, setCurrentCode] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!isNativeApp()) return;

    let cancelled = false;
    (async () => {
      try {
        const info = await App.getInfo();
        // build is the versionCode on Android, version is versionName.
        const code = parseInt(info.build, 10);
        if (Number.isNaN(code)) return;
        setCurrentCode(code);

        const res = await fetch(RELEASES_API, {
          headers: { Accept: "application/vnd.github+json" },
        });
        if (!res.ok) return;
        const json = await res.json();
        const release = parseRelease(json.body || "");
        if (!release || cancelled) return;

        setLatest(release);

        // If the user dismissed THIS exact version, stay hidden.
        const dismissedFor = localStorage.getItem(
          DISMISS_KEY_PREFIX + release.versionCode,
        );
        if (dismissedFor === "1") setDismissed(true);
      } catch {
        /* offline or rate-limited — silently skip */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const hasUpdate =
    latest != null && currentCode != null && latest.versionCode > currentCode;

  if (!hasUpdate || dismissed) return null;

  const handleUpdate = () => {
    // Open the APK URL in the system browser so Android's package installer
    // takes over after download.
    window.open(APK_URL, "_blank");
  };

  const handleDismiss = () => {
    if (latest) {
      localStorage.setItem(DISMISS_KEY_PREFIX + latest.versionCode, "1");
    }
    setDismissed(true);
  };

  return (
    <div className="fixed inset-x-0 top-0 z-[60] px-3 pt-3">
      <div className="mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-accent/30 bg-background/95 p-3 shadow-lg backdrop-blur-md">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/15">
          <Sparkles className="h-4 w-4 text-accent" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[11px] font-semibold tracking-[0.15em] text-foreground">
            UPDATE AVAILABLE
          </p>
          <p className="truncate text-[11px] text-foreground/60">
            New version {latest!.versionName} is ready.
          </p>
        </div>
        <button
          onClick={handleUpdate}
          className="flex shrink-0 items-center gap-1 rounded-full bg-foreground px-3 py-1.5 font-mono text-[10px] font-semibold tracking-wider text-background transition-opacity hover:opacity-90"
        >
          <Download className="h-3 w-3" />
          UPDATE
        </button>
        <button
          onClick={handleDismiss}
          aria-label="Dismiss"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-foreground/50 transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};

export default UpdateBanner;
