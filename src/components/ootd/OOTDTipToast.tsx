import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { INFO_CARDS, type InfoCardId } from "@/lib/ootd/infoCards";
import { isInfoCardSeen, markInfoCardSeen } from "@/hooks/useInfoCardSeen";

const ACCENT_FG: Record<string, string> = {
  primary: "text-primary", accent: "text-accent",
  star: "text-[hsl(var(--star))]", rose: "text-[hsl(330_85%_60%)]",
};

interface Props {
  ids: InfoCardId[];
}

/** Floating toast that surfaces unseen OOTD tips one-by-one. */
export default function OOTDTipToast({ ids }: Props) {
  const { t } = useI18n();
  const [activeId, setActiveId] = useState<InfoCardId | null>(null);

  useEffect(() => {
    const next = ids.find(id => !isInfoCardSeen(id));
    if (next) {
      const tm = setTimeout(() => setActiveId(next), 800);
      return () => clearTimeout(tm);
    }
  }, [ids.join(",")]);

  const dismiss = () => {
    if (activeId) markInfoCardSeen(activeId);
    setActiveId(null);
    setTimeout(() => {
      const next = ids.find(id => !isInfoCardSeen(id));
      if (next) setActiveId(next);
    }, 400);
  };

  if (!activeId) return null;
  const entry = INFO_CARDS[activeId];
  if (!entry) return null;
  const Icon = entry.icon;

  return (
    <AnimatePresence>
      <motion.div
        key={activeId}
        initial={{ opacity: 0, y: 30, scale: 0.94 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.94 }}
        transition={{ type: "spring", damping: 22, stiffness: 280 }}
        className="fixed bottom-20 right-3 sm:bottom-6 sm:right-6 z-[110] w-[min(92vw,320px)] rounded-2xl border border-border/40 bg-background/95 backdrop-blur-xl p-3.5 shadow-2xl"
      >
        <div className="flex items-start gap-3">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-foreground/[0.06] ${ACCENT_FG[entry.accent]}`}>
            <Icon className="h-4 w-4" strokeWidth={2.2} />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-[12.5px] font-semibold leading-tight text-foreground">
              {t(entry.titleKey as any)}
            </h4>
            <p className="mt-1 text-[11px] leading-relaxed text-foreground/70">
              {t(entry.bodyKey as any)}
            </p>
            <button
              onClick={dismiss}
              className="mt-2 rounded-full bg-[hsl(330_85%_60%)] px-3 py-1 text-[10.5px] font-semibold text-white hover:opacity-90"
            >
              Got it
            </button>
          </div>
          <button onClick={dismiss} aria-label="Dismiss"
            className="shrink-0 rounded-full p-1 text-foreground/40 hover:bg-foreground/10 hover:text-foreground/80">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
