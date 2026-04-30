/**
 * AppUpdatePrompt — checks for a new sideload APK on app boot and offers
 * the user a one-tap install. Native Android only.
 *
 * UI sits above the bottom nav (same z-index strategy as PermissionsPrompt)
 * so it's never clipped on small phones.
 */
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, X, ArrowRight, Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { isNativeApp } from "@/lib/native/platform";
import {
  checkForUpdate,
  hasUserSkipped,
  installUpdate,
  markUserSkipped,
  type AppRelease,
} from "@/lib/native/appUpdate";

const AppUpdatePrompt = () => {
  const { t } = useI18n();
  const [release, setRelease] = useState<AppRelease | null>(null);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (!isNativeApp()) return;
    let cancelled = false;
    // Wait until the app has had a few seconds to settle (splash, welcome
    // tour, permissions prompt) before stacking another modal on top.
    const timer = setTimeout(async () => {
      try {
        const result = await checkForUpdate();
        if (cancelled) return;
        if (result.status !== "available") return;
        if (hasUserSkipped(result.release)) return;
        setRelease(result.release);
      } catch (e) {
        console.warn("[update] check failed", e);
      }
    }, 6000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  const handleSkip = () => {
    if (release) markUserSkipped(release);
    setRelease(null);
  };

  const handleInstall = async () => {
    if (!release) return;
    setInstalling(true);
    try {
      await installUpdate(release);
    } finally {
      setInstalling(false);
      // Keep the sheet up — the user is now in the system installer flow
      // and will return to a fresh app instance.
    }
  };

  if (!release) return null;

  const critical = release.is_critical;

  return (
    <AnimatePresence>
      <motion.div
        key="update-backdrop"
        className="fixed inset-0 z-[120] bg-background/85 backdrop-blur-md"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={critical ? undefined : handleSkip}
      />
      <motion.div
        key="update-sheet"
        className="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom)+12px)] z-[121] mx-auto max-w-md rounded-3xl border border-foreground/10 bg-card p-7 pb-8 shadow-[0_-12px_60px_-12px_hsl(var(--accent)/0.4)] sm:bottom-6 sm:p-8"
        initial={{ y: "100%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        transition={{ type: "spring", stiffness: 280, damping: 30 }}
      >
        {!critical && (
          <button
            aria-label="Close"
            onClick={handleSkip}
            className="absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-full text-foreground/60 transition-colors hover:bg-foreground/5 hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        <div className="space-y-6">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10 text-accent">
            <Download className="h-6 w-6" />
          </div>

          <div className="space-y-2 text-center">
            <p className="text-[10px] font-bold tracking-[0.3em] text-accent">
              {critical ? t("updateCriticalKicker") : t("updateAvailableKicker")}
            </p>
            <h2 className="font-display text-xl font-medium italic text-foreground">
              {t("updateAvailableTitle")} {release.version_name}
            </h2>
            {release.release_notes ? (
              <p className="whitespace-pre-line text-[12px] leading-relaxed text-foreground/65">
                {release.release_notes}
              </p>
            ) : (
              <p className="text-[12px] leading-relaxed text-foreground/65">
                {t("updateAvailableBody")}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            {!critical && (
              <button
                onClick={handleSkip}
                disabled={installing}
                className="flex-1 rounded-full border border-foreground/15 px-5 py-3 text-[11px] font-semibold tracking-[0.2em] text-foreground/70 transition-colors hover:bg-foreground/5 disabled:opacity-40"
              >
                {t("updateLater")}
              </button>
            )}
            <button
              onClick={handleInstall}
              disabled={installing}
              className="flex-[1.4] inline-flex items-center justify-center gap-2 rounded-full bg-accent px-5 py-3 text-[11px] font-bold tracking-[0.2em] text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {installing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ArrowRight className="h-3.5 w-3.5" />
              )}
              {t("updateInstall")}
            </button>
          </div>

          <p className="text-center text-[10px] leading-relaxed text-foreground/45">
            {t("updateInstallHint")}
          </p>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default AppUpdatePrompt;
