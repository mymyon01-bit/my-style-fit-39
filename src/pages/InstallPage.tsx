import { useState, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { motion } from "framer-motion";
import { Download, Smartphone, Apple, ChevronDown } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const InstallPage = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [activeGuide, setActiveGuide] = useState<"ios" | "android" | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);

    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") setIsInstalled(true);
      setDeferredPrompt(null);
    }
  };

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isAndroid = /Android/.test(navigator.userAgent);

  const APK_URL = "/downloads/mymyon.apk";

  const handleApkDownload = () => {
    const a = document.createElement("a");
    a.href = APK_URL;
    a.download = "mymyon.apk";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-5 lg:px-12 lg:py-7">
        <button
          onClick={() => navigate("/")}
          className="font-display text-[12px] font-semibold tracking-[0.4em] text-foreground/70"
        >
          WARDROBE
        </button>
      </div>

      <div className="mx-auto max-w-lg px-6 pb-24 pt-8 lg:max-w-xl lg:pt-16">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center"
        >
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-accent/10 lg:h-24 lg:w-24">
            <img
              src="/icons/icon-192.png"
              alt="Wardrobe"
              className="h-14 w-14 rounded-xl lg:h-16 lg:w-16"
            />
          </div>

          <h1 className="font-display text-2xl font-bold tracking-wide text-foreground lg:text-3xl">
            {t("downloadApp")}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-foreground/70 lg:text-base">
            {t("downloadAppDesc")}
          </p>
        </motion.div>

        {/* Primary download buttons — APK for Android, TestFlight notice for iOS */}
        {!isInstalled && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-10 space-y-3"
          >
            {/* Android APK direct download */}
            <button
              onClick={handleApkDownload}
              className="flex w-full items-center justify-center gap-3 rounded-full bg-foreground px-6 py-4 text-sm font-semibold tracking-wide text-background transition-opacity hover:opacity-90"
            >
              <Smartphone className="h-5 w-5" />
              Download for Android (APK)
            </button>

            {/* iOS — sideloading not allowed, point to TestFlight/App Store */}
            <button
              onClick={() => {
                if (isIOS) {
                  setActiveGuide("ios");
                }
              }}
              className="flex w-full items-center justify-center gap-3 rounded-full border border-foreground/20 bg-card/50 px-6 py-4 text-sm font-semibold tracking-wide text-foreground/80 transition-colors hover:bg-card"
            >
              <Apple className="h-5 w-5" />
              iOS — TestFlight coming soon
            </button>

            {/* Browser PWA install (Android Chrome / desktop) */}
            {deferredPrompt && (
              <button
                onClick={handleInstall}
                className="flex w-full items-center justify-center gap-3 rounded-full bg-accent/90 px-6 py-4 text-sm font-semibold tracking-wide text-white transition-colors hover:bg-accent"
              >
                <Download className="h-5 w-5" />
                {t("installNow")} (Web App)
              </button>
            )}

            <p className="px-2 pt-1 text-center text-[11px] leading-relaxed text-foreground/55">
              Android: after download, open the APK and allow "Install from
              unknown sources" if prompted. The app is unsigned beta — store
              release coming soon.
            </p>
          </motion.div>
        )}

        {isInstalled && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-10 rounded-xl border border-accent/20 bg-accent/5 px-6 py-5 text-center"
          >
            <p className="text-sm font-medium text-accent">{t("appInstalled")}</p>
          </motion.div>
        )}

        {/* Manual install guides */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-12 space-y-4"
        >
          {/* iOS Guide */}
          <div className="overflow-hidden rounded-xl border border-border/30 bg-card/50">
            <button
              onClick={() => setActiveGuide(activeGuide === "ios" ? null : "ios")}
              className="flex w-full items-center justify-between px-5 py-4"
            >
              <div className="flex items-center gap-3">
                <Apple className="h-5 w-5 text-foreground/75" />
                <span className="text-sm font-semibold tracking-wide text-foreground/80">
                  iPhone / iPad
                </span>
              </div>
              <ChevronDown
                className={`h-4 w-4 text-foreground/75 transition-transform ${
                  activeGuide === "ios" ? "rotate-180" : ""
                }`}
              />
            </button>
            {activeGuide === "ios" && (
              <div className="border-t border-border/20 px-5 pb-5 pt-4">
                <ol className="space-y-3 text-[13px] leading-relaxed text-foreground/75">
                  <li className="flex gap-3">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/10 text-[10px] font-bold text-accent">1</span>
                    {t("iosStep1")}
                  </li>
                  <li className="flex gap-3">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/10 text-[10px] font-bold text-accent">2</span>
                    {t("iosStep2")}
                  </li>
                  <li className="flex gap-3">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/10 text-[10px] font-bold text-accent">3</span>
                    {t("iosStep3")}
                  </li>
                </ol>
              </div>
            )}
          </div>

          {/* Android Guide */}
          <div className="overflow-hidden rounded-xl border border-border/30 bg-card/50">
            <button
              onClick={() => setActiveGuide(activeGuide === "android" ? null : "android")}
              className="flex w-full items-center justify-between px-5 py-4"
            >
              <div className="flex items-center gap-3">
                <Smartphone className="h-5 w-5 text-foreground/75" />
                <span className="text-sm font-semibold tracking-wide text-foreground/80">
                  Android
                </span>
              </div>
              <ChevronDown
                className={`h-4 w-4 text-foreground/75 transition-transform ${
                  activeGuide === "android" ? "rotate-180" : ""
                }`}
              />
            </button>
            {activeGuide === "android" && (
              <div className="border-t border-border/20 px-5 pb-5 pt-4">
                <ol className="space-y-3 text-[13px] leading-relaxed text-foreground/75">
                  <li className="flex gap-3">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/10 text-[10px] font-bold text-accent">1</span>
                    {t("androidStep1")}
                  </li>
                  <li className="flex gap-3">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/10 text-[10px] font-bold text-accent">2</span>
                    {t("androidStep2")}
                  </li>
                  <li className="flex gap-3">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/10 text-[10px] font-bold text-accent">3</span>
                    {t("androidStep3")}
                  </li>
                </ol>
              </div>
            )}
          </div>
        </motion.div>

        {/* Features */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="mt-12"
        >
          <h2 className="mb-5 text-center text-[10px] font-semibold tracking-[0.25em] text-foreground/75">
            {t("appFeatures").toUpperCase()}
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: "⚡", label: t("featureFast") },
              { icon: "📱", label: t("featureOffline") },
              { icon: "🔔", label: t("featureNotifications") },
              { icon: "✨", label: t("featureNative") },
            ].map((f, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-lg border border-border/20 bg-card/30 px-4 py-3"
              >
                <span className="text-lg">{f.icon}</span>
                <span className="text-[11px] font-medium text-foreground/75">{f.label}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default InstallPage;
