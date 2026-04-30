import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Download, Smartphone, Apple, Share, Plus, X, ShieldCheck, FolderDown, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

const APK_URL = "https://github.com/mymyon01-bit/my-style-fit-39/releases/download/latest-apk/mymyon.apk";

const InstallPage = () => {
  const navigate = useNavigate();
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }
  }, []);

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
            Download my'myon
          </h1>
          <p className="mt-2 text-[12px] leading-relaxed text-foreground/65">
            Get the native Android app, or add to your iPhone home screen.
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

            {/* Android — direct APK download */}
            <div className="rounded-2xl border border-border/30 bg-card/40 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-foreground/70" />
                <span className="text-[11px] font-semibold tracking-[0.15em] text-foreground/75">
                  ANDROID — NATIVE APP
                </span>
              </div>

              <a
                href={APK_URL}
                className="mb-4 flex w-full items-center justify-center gap-2 rounded-full bg-accent px-5 py-3 text-[12px] font-semibold tracking-wide text-accent-foreground transition-opacity hover:opacity-90"
              >
                <Download className="h-4 w-4" />
                Download APK (latest)
              </a>

              <ol className="space-y-3 text-[12px] leading-relaxed text-foreground/70">
                <li className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/10 text-[10px] font-bold text-accent">
                    1
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Download className="h-3.5 w-3.5 shrink-0" />
                    Tap "Download APK" above on your Android phone.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/10 text-[10px] font-bold text-accent">
                    2
                  </span>
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                    Allow "Install from unknown sources" when prompted (Settings → Security).
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/10 text-[10px] font-bold text-accent">
                    3
                  </span>
                  <span className="flex items-center gap-1.5">
                    <FolderDown className="h-3.5 w-3.5 shrink-0" />
                    Open <code className="rounded bg-muted/60 px-1 py-0.5 text-[10.5px]">mymyon.apk</code> from Downloads.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/10 text-[10px] font-bold text-accent">
                    4
                  </span>
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    Tap Install — the my'myon app is on your home screen.
                  </span>
                </li>
              </ol>

              <p className="mt-3 border-t border-border/30 pt-3 text-[10.5px] leading-relaxed text-foreground/50">
                Prefer a browser install instead? Open in Chrome → menu (⋮) → "Add to Home screen".
              </p>
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
