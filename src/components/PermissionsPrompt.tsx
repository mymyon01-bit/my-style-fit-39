/**
 * PermissionsPrompt — first-launch consent sheet for the native APK.
 *
 * Shown once (gated by localStorage) on iOS / Android only. Asks the user
 * to opt into push notifications and location, then triggers the system
 * dialogs in sequence. Skipping is always allowed; the user can revisit
 * later from Settings.
 *
 * NEVER auto-fires the OS permission dialogs — that previously froze the
 * Android WebView. Everything is gated behind explicit button taps.
 */
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, MapPin, Check, X, Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { isNativeApp } from "@/lib/native/platform";
import { getPushPermissionStatus, initPushNotifications } from "@/lib/native/push";
import { getLocationPermissionStatus, requestLocationPermission } from "@/lib/native/location";

const STORAGE_KEY = "wardrobe:permissions-prompt:v1";

type Step = "intro" | "notif" | "location" | "done";

const PermissionsPrompt = () => {
  const { t } = useI18n();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("intro");
  const [busy, setBusy] = useState(false);
  const [notifGranted, setNotifGranted] = useState(false);
  const [locGranted, setLocGranted] = useState(false);

  // Decide whether to show. Native-only, once per install.
  useEffect(() => {
    if (!isNativeApp()) return;
    if (localStorage.getItem(STORAGE_KEY)) return;
    (async () => {
      const [pushStatus, locStatus] = await Promise.all([
        getPushPermissionStatus(),
        getLocationPermissionStatus(),
      ]);
      // If both already resolved (granted or denied), don't bother the user.
      if (pushStatus !== "prompt" && locStatus !== "prompt") {
        localStorage.setItem(STORAGE_KEY, "auto-skipped");
        return;
      }
      // Wait until the welcome tour likely finished (gives splash + tour
      // ~3.5s to complete) before popping a system dialog.
      setTimeout(() => setOpen(true), 3500);
    })();
  }, []);

  const close = () => {
    localStorage.setItem(STORAGE_KEY, "completed");
    setOpen(false);
  };

  const handleEnableNotif = async () => {
    setBusy(true);
    try {
      const result = await initPushNotifications((token, platform) => {
        console.log("[push] device token registered", { platform, token: token.slice(0, 12) + "…" });
      });
      setNotifGranted(result === "granted");
    } finally {
      setBusy(false);
      setStep("location");
    }
  };

  const handleSkipNotif = () => setStep("location");

  const handleEnableLocation = async () => {
    setBusy(true);
    try {
      const result = await requestLocationPermission();
      setLocGranted(result === "granted");
    } finally {
      setBusy(false);
      setStep("done");
      // Auto-close the success card after a beat.
      setTimeout(close, 1400);
    }
  };

  const handleSkipLocation = () => {
    setStep("done");
    setTimeout(close, 1200);
  };

  // Refresh weather hook once location is granted so the home screen
  // updates without a manual reload. We post a custom event the hook
  // can listen for if needed; otherwise users see fresh data on next nav.
  useEffect(() => {
    if (locGranted) window.dispatchEvent(new Event("wardrobe:location-granted"));
  }, [locGranted]);

  // Tag the prompt to the current user (best-effort). Not required.
  useEffect(() => { void user; }, [user]);

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="perm-backdrop"
        className="fixed inset-0 z-[80] bg-background/80 backdrop-blur-md"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={close}
      />
      <motion.div
        key="perm-sheet"
        className="fixed inset-x-0 bottom-0 z-[81] mx-auto max-w-md rounded-t-3xl border border-foreground/10 bg-card p-7 pb-10 shadow-[0_-12px_60px_-12px_hsl(var(--accent)/0.35)] sm:bottom-6 sm:rounded-3xl sm:p-8"
        initial={{ y: "100%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        transition={{ type: "spring", stiffness: 280, damping: 30 }}
      >
        <button
          aria-label="Close"
          onClick={close}
          className="absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-full text-foreground/60 transition-colors hover:bg-foreground/5 hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>

        <AnimatePresence mode="wait">
          {step === "intro" && (
            <motion.div
              key="intro"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
              className="space-y-6"
            >
              <div className="space-y-2">
                <p className="text-[10px] font-bold tracking-[0.3em] text-accent">
                  {t("permWelcomeKicker")}
                </p>
                <h2 className="font-display text-2xl font-medium italic leading-tight tracking-tight text-foreground">
                  {t("permIntroTitle")}
                </h2>
                <p className="text-[13px] leading-relaxed text-foreground/70">
                  {t("permIntroBody")}
                </p>
              </div>

              <ul className="space-y-3">
                <li className="flex items-start gap-3 rounded-2xl border border-foreground/[0.08] bg-foreground/[0.02] p-4">
                  <Bell className="mt-0.5 h-4 w-4 flex-none text-accent" />
                  <div className="space-y-0.5">
                    <p className="text-[12px] font-semibold tracking-wide text-foreground/90">
                      {t("permNotifLabel")}
                    </p>
                    <p className="text-[11px] leading-snug text-foreground/60">
                      {t("permNotifBody")}
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3 rounded-2xl border border-foreground/[0.08] bg-foreground/[0.02] p-4">
                  <MapPin className="mt-0.5 h-4 w-4 flex-none text-accent" />
                  <div className="space-y-0.5">
                    <p className="text-[12px] font-semibold tracking-wide text-foreground/90">
                      {t("permLocationLabel")}
                    </p>
                    <p className="text-[11px] leading-snug text-foreground/60">
                      {t("permLocationBody")}
                    </p>
                  </div>
                </li>
              </ul>

              <div className="flex items-center gap-3">
                <button
                  onClick={close}
                  className="flex-1 rounded-full border border-foreground/15 px-5 py-3 text-[11px] font-semibold tracking-[0.2em] text-foreground/70 transition-colors hover:bg-foreground/5"
                >
                  {t("permSkipAll")}
                </button>
                <button
                  onClick={() => setStep("notif")}
                  className="flex-[1.4] rounded-full bg-accent px-5 py-3 text-[11px] font-bold tracking-[0.2em] text-accent-foreground transition-opacity hover:opacity-90"
                >
                  {t("permContinue")}
                </button>
              </div>
            </motion.div>
          )}

          {step === "notif" && (
            <motion.div
              key="notif"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
              className="space-y-6"
            >
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                <Bell className="h-6 w-6" />
              </div>
              <div className="space-y-2 text-center">
                <h2 className="font-display text-xl font-medium italic text-foreground">
                  {t("permNotifAskTitle")}
                </h2>
                <p className="text-[12px] leading-relaxed text-foreground/65">
                  {t("permNotifAskBody")}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSkipNotif}
                  disabled={busy}
                  className="flex-1 rounded-full border border-foreground/15 px-5 py-3 text-[11px] font-semibold tracking-[0.2em] text-foreground/70 transition-colors hover:bg-foreground/5 disabled:opacity-40"
                >
                  {t("permNotNow")}
                </button>
                <button
                  onClick={handleEnableNotif}
                  disabled={busy}
                  className="flex-[1.4] inline-flex items-center justify-center gap-2 rounded-full bg-accent px-5 py-3 text-[11px] font-bold tracking-[0.2em] text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  {t("permEnable")}
                </button>
              </div>
            </motion.div>
          )}

          {step === "location" && (
            <motion.div
              key="location"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
              className="space-y-6"
            >
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                <MapPin className="h-6 w-6" />
              </div>
              <div className="space-y-2 text-center">
                <h2 className="font-display text-xl font-medium italic text-foreground">
                  {t("permLocationAskTitle")}
                </h2>
                <p className="text-[12px] leading-relaxed text-foreground/65">
                  {t("permLocationAskBody")}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSkipLocation}
                  disabled={busy}
                  className="flex-1 rounded-full border border-foreground/15 px-5 py-3 text-[11px] font-semibold tracking-[0.2em] text-foreground/70 transition-colors hover:bg-foreground/5 disabled:opacity-40"
                >
                  {t("permNotNow")}
                </button>
                <button
                  onClick={handleEnableLocation}
                  disabled={busy}
                  className="flex-[1.4] inline-flex items-center justify-center gap-2 rounded-full bg-accent px-5 py-3 text-[11px] font-bold tracking-[0.2em] text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  {t("permEnable")}
                </button>
              </div>
            </motion.div>
          )}

          {step === "done" && (
            <motion.div
              key="done"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
              className="space-y-4 py-4 text-center"
            >
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/15 text-accent">
                <Check className="h-7 w-7" />
              </div>
              <p className="text-[14px] font-semibold text-foreground">
                {t("permAllSet")}
              </p>
              <p className="text-[11px] text-foreground/55">
                {notifGranted || locGranted
                  ? t("permYouCanChange")
                  : t("permEnableAnytime")}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
};

export default PermissionsPrompt;
