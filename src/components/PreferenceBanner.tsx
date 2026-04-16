import { Sparkles, X } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface PreferenceBannerProps {
  onOpenQuiz: () => void;
}

const PreferenceBanner = ({ onOpenQuiz }: PreferenceBannerProps) => {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        className="relative overflow-hidden rounded-2xl border border-accent/20 bg-gradient-to-r from-accent/[0.08] via-accent/[0.04] to-transparent p-5"
      >
        {/* Dismiss */}
        <button
          onClick={() => setDismissed(true)}
          className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-foreground/[0.05] text-foreground/40 hover:text-foreground/60 transition-colors"
        >
          <X className="h-3 w-3" />
        </button>

        <div className="flex items-start gap-4">
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
