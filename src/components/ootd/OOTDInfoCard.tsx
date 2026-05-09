import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { INFO_CARDS, type InfoCardId } from "@/lib/ootd/infoCards";
import { useInfoCardSeen } from "@/hooks/useInfoCardSeen";

interface OOTDInfoCardProps {
  id: InfoCardId;
  /** Visual size on mobile. md (default) = compact, lg = bigger first-time hero */
  size?: "sm" | "md" | "lg";
  className?: string;
}

const ACCENT_BG: Record<string, string> = {
  primary: "from-primary/15 to-primary/[0.04]",
  accent: "from-accent/20 to-accent/[0.04]",
  star: "from-[hsl(var(--star)/0.2)] to-[hsl(var(--star)/0.04)]",
  rose: "from-[hsl(330_85%_60%/0.18)] to-[hsl(330_85%_60%/0.04)]",
};
const ACCENT_FG: Record<string, string> = {
  primary: "text-primary",
  accent: "text-accent",
  star: "text-[hsl(var(--star))]",
  rose: "text-[hsl(330_85%_60%)]",
};

/**
 * Inline, dismissible info card. Adapts:
 *  - mobile: compact full-width
 *  - tablet/desktop: sits inline at md width
 * Once dismissed, never reappears (until reset in Settings).
 */
export default function OOTDInfoCard({ id, size = "md", className = "" }: OOTDInfoCardProps) {
  const { seen, dismiss } = useInfoCardSeen(id);
  const { t } = useI18n();
  const entry = INFO_CARDS[id];
  if (!entry || seen) return null;

  const Icon = entry.icon;
  const sizeCls =
    size === "lg" ? "p-4 sm:p-5" : size === "sm" ? "p-2.5 sm:p-3" : "p-3 sm:p-3.5";
  const titleCls =
    size === "lg" ? "text-[14px] sm:text-[15px]" : size === "sm" ? "text-[11.5px] sm:text-[12px]" : "text-[12.5px] sm:text-[13px]";
  const bodyCls =
    size === "lg" ? "text-[12px] sm:text-[13px]" : size === "sm" ? "text-[10px] sm:text-[10.5px]" : "text-[11px] sm:text-[11.5px]";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -6, scale: 0.96 }}
        transition={{ type: "spring", damping: 22, stiffness: 280 }}
        className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${ACCENT_BG[entry.accent]} backdrop-blur-md ${sizeCls} ${className}`}
      >
        <div className="flex items-start gap-3">
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-background/60 ${ACCENT_FG[entry.accent]}`}>
            <Icon className="h-4 w-4" strokeWidth={2.2} />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className={`font-semibold leading-tight text-foreground ${titleCls}`}>
              {t(entry.titleKey as any)}
            </h4>
            <p className={`mt-1 leading-relaxed text-foreground/70 ${bodyCls}`}>
              {t(entry.bodyKey as any)}
            </p>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss tip"
            className="shrink-0 rounded-full p-1 text-foreground/40 transition hover:bg-foreground/10 hover:text-foreground/80"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
