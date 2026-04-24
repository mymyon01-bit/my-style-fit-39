import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Download, Smartphone, Apple, Share, Plus, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const InstallPage = () => {
  const navigate = useNavigate();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

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
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setIsInstalled(true);
    setDeferredPrompt(null);
  };

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

  return (
    <div className="min-h-screen bg-background">
      {/* Header — back/close on left, brand center, large tap target */}
      <div className="sticky top-0 z-10 flex items-center justify-between gap-2 bg-background/95 px-4 py-3 backdrop-blur-md border-b border-border/30">
        <button
          onClick={() => navigate(-1)}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-muted/60 text-foreground/70 transition-colors hover:bg-muted hover:text-foreground active:scale-95"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
        <span className="font-display text-[11px] font-semibold tracking-[0.35em] text-foreground/70">
          MY'MYON
        </span>
        <span className="h-9 w-9" aria-hidden />
      </div>

      <div className="mx-auto w-full max-w-sm px-5 pb-20 pt-6">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10">
            <img src="/icons/icon-192.png" alt="my'myon" className="h-11 w-11 rounded-xl" />
          </div>
          <h1 className="font-display text-xl font-bold tracking-wide text-foreground">
            Add to Home Screen
          </h1>
          <p className="mt-2 text-[12px] leading-relaxed text-foreground/65">
            Install my'myon on your phone. Opens full-screen, works offline.
          </p>
        </motion.div>

        {isInstalled ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-8 rounded-xl border border-accent/20 bg-accent/5 px-5 py-4 text-center"
          >
            <p className="text-[13px] font-medium text-accent">Already installed ✓</p>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-8 space-y-3"
          >
            {/* Native install prompt (Android Chrome / Desktop) */}
            {deferredPrompt && (
              <button
                onClick={handleInstall}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 py-3 text-[12px] font-semibold tracking-wide text-background transition-opacity hover:opacity-90"
              >
                <Download className="h-4 w-4" />
                Install now
              </button>
            )}

            {/* iOS instructions */}
            <div className="rounded-2xl border border-border/30 bg-card/40 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Apple className="h-4 w-4 text-foreground/70" />
                <span className="text-[11px] font-semibold tracking-[0.15em] text-foreground/75">
                  IPHONE
                </span>
              </div>
              <ol className="space-y-2.5 text-[12px] leading-relaxed text-foreground/70">
                <li className="flex items-center gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/10 text-[10px] font-bold text-accent">
                    1
                  </span>
                  <span>Open in Safari</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/10 text-[10px] font-bold text-accent">
                    2
                  </span>
                  <span className="flex items-center gap-1.5">
                    Tap <Share className="h-3.5 w-3.5" /> Share
                  </span>
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/10 text-[10px] font-bold text-accent">
                    3
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Plus className="h-3.5 w-3.5" /> Add to Home Screen
                  </span>
                </li>
              </ol>
            </div>

            {/* Android instructions */}
            <div className="rounded-2xl border border-border/30 bg-card/40 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-foreground/70" />
                <span className="text-[11px] font-semibold tracking-[0.15em] text-foreground/75">
                  ANDROID
                </span>
              </div>
              <ol className="space-y-2.5 text-[12px] leading-relaxed text-foreground/70">
                <li className="flex items-center gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/10 text-[10px] font-bold text-accent">
                    1
                  </span>
                  <span>Open in Chrome</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/10 text-[10px] font-bold text-accent">
                    2
                  </span>
                  <span>Tap menu (⋮) top right</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/10 text-[10px] font-bold text-accent">
                    3
                  </span>
                  <span>Add to Home screen</span>
                </li>
              </ol>
            </div>

            {!isIOS && !deferredPrompt && (
              <p className="px-2 pt-1 text-center text-[10.5px] leading-relaxed text-foreground/50">
                Install option appears in your browser menu.
              </p>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default InstallPage;
