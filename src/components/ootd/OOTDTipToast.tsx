import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { INFO_CARDS, type InfoCardId } from "@/lib/ootd/infoCards";
import { isInfoCardSeen, markInfoCardSeen } from "@/hooks/useInfoCardSeen";

const ACCENT_FG: Record<string, string> = {
  primary: "text-primary", accent: "text-accent",
  star: "text-[hsl(var(--star))]", rose: "text-[hsl(330_85%_60%)]",
};
const ACCENT_BG: Record<string, string> = {
  primary: "from-primary/25 to-primary/5",
  accent: "from-accent/25 to-accent/5",
  star: "from-[hsl(var(--star)/0.25)] to-[hsl(var(--star)/0.05)]",
  rose: "from-[hsl(330_85%_60%/0.25)] to-[hsl(330_85%_60%/0.05)]",
};

interface Props { ids: InfoCardId[]; }

/** Centered announcement modal that surfaces unseen OOTD tips one-by-one. */
export default function OOTDTipToast({ ids }: Props) {
  const { t } = useI18n();
  const [activeId, setActiveId] = useState<InfoCardId | null>(null);

  useEffect(() => {
    const next = ids.find(id => !isInfoCardSeen(id));
    if (next) {
      const tm = setTimeout(() => setActiveId(next), 600);
      return () => clearTimeout(tm);
    }
  }, [ids.join(",")]);

  // Lock body scroll while a tip is showing
  useEffect(() => {
    if (!activeId) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [activeId]);

  const dismiss = () => {
    if (activeId) markInfoCardSeen(activeId);
    setActiveId(null);
    setTimeout(() => {
      const next = ids.find(id => !isInfoCardSeen(id));
      if (next) setActiveId(next);
    }, 350);
  };

  if (!activeId) return null;
  const entry = INFO_CARDS[activeId];
  if (!entry) return null;
  const Icon = entry.icon;

  return createPortal(
    <AnimatePresence>
      <motion.div
        key={activeId}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={dismiss}
        className="fixed inset-0 z-[300] flex items-center justify-center bg-black/65 backdrop-blur-sm p-4"
        style={{
          paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
          paddingTop: "max(1rem, env(safe-area-inset-top))",
        }}
      >
        <motion.div
          initial={{ y: 20, scale: 0.94, opacity: 0 }}
          animate={{ y: 0, scale: 1, opacity: 1 }}
          exit={{ y: 10, scale: 0.96, opacity: 0 }}
          transition={{ type: "spring", damping: 22, stiffness: 260 }}
          onClick={e => e.stopPropagation()}
          className="relative w-full max-w-[360px] overflow-hidden rounded-3xl border border-border/40 bg-card shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)]"
        >
          <button
            onClick={dismiss}
            aria-label="Dismiss"
            className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-foreground/10 text-foreground/65 hover:bg-foreground/20 hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>

          {/* Header band */}
          <div className={`bg-gradient-to-br ${ACCENT_BG[entry.accent]} px-6 pt-7 pb-5 flex flex-col items-center text-center`}>
            <div className={`mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-background/70 backdrop-blur ${ACCENT_FG[entry.accent]} shadow-lg`}>
              <Icon className="h-6 w-6" strokeWidth={2.1} />
            </div>
            <p className="text-[9.5px] uppercase tracking-[0.28em] text-foreground/55 font-semibold mb-1.5">
              Notice
            </p>
            <h3 className="font-display text-[18px] font-bold leading-tight text-foreground">
              {t(entry.titleKey as any)}
            </h3>
          </div>

          {/* Body */}
          <div className="px-6 pt-4 pb-6">
            <p className="text-center text-[12.5px] leading-relaxed text-foreground/75">
              {t(entry.bodyKey as any)}
            </p>
            <button
              onClick={dismiss}
              className="mt-5 w-full rounded-full bg-gradient-to-r from-[hsl(330_85%_60%)] to-[hsl(280_70%_55%)] px-4 py-2.5 text-[12.5px] font-semibold text-white shadow-[0_8px_22px_-8px_hsl(330_85%_60%/0.5)] hover:opacity-95"
            >
              Got it
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
