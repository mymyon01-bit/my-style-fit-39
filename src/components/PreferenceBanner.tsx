import { Sparkles, X } from "lucide-react";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface PreferenceBannerProps {
  onOpenQuiz: () => void;
}

const DISMISS_KEY = "preferenceBanner:dismissed";
const SUPPRESS_KEY = "preferenceBanner:suppressed";

const PreferenceBanner = ({ onOpenQuiz }: PreferenceBannerProps) => {
  const [dismissed, setDismissed] = useState(false);
  const [suppressed, setSuppressed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(SUPPRESS_KEY) === "1") setSuppressed(true);
    if (sessionStorage.getItem(DISMISS_KEY) === "1") setDismissed(true);
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    try { sessionStorage.setItem(DISMISS_KEY, "1"); } catch {}
  };

  const handleSuppress = () => {
    setSuppressed(true);
    try { localStorage.setItem(SUPPRESS_KEY, "1"); } catch {}
  };

  if (dismissed || suppressed) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        className="relative overflow-hidden rounded-2xl border border-accent/20 bg-gradient-to-r from-accent/[0.08] via-accent/[0.04] to-transparent p-5"
      >
        {/* Top-right controls */}
        <div className="absolute right-3 top-3 flex items-center gap-1.5">
          <button
            onClick={handleSuppress}
            className="rounded-full bg-foreground/[0.05] px-2.5 py-1 text-[9px] font-semibold tracking-[0.12em] text-foreground/50 transition-colors hover:bg-foreground/[0.08] hover:text-foreground/75"
            aria-label="Don't remind me again"
          >
            DON'T REMIND ME
          </button>
          <button
            onClick={handleDismiss}
            className="flex h-6 w-6 items-center justify-center rounded-full bg-foreground/[0.05] text-foreground/40 transition-colors hover:text-foreground/60"
            aria-label="Dismiss"
          >
            <X className="h-3 w-3" />
          </button>
        </div>

        <div className="flex items-start gap-4 pr-4 pt-7 sm:pt-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/15">
            <Sparkles className="h-5 w-5 text-accent" />
          </div>
          <div className="flex-1 space-y-2">
            <p className="text-[13px] font-semibold text-foreground leading-tight">
              Tell us your style to unlock smarter results
            </p>
            <p className="text-[11px] leading-relaxed text-foreground/50">
              Take a quick 1-minute style quiz. We'll personalize every recommendation, search, and outfit suggestion just for you.
            </p>
            <button
              onClick={onOpenQuiz}
              className="mt-1 flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-[11px] font-bold tracking-[0.1em] text-accent-foreground transition-all hover:opacity-90"
            >
              <Sparkles className="h-3.5 w-3.5" />
              TAKE STYLE QUIZ
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default PreferenceBanner;
