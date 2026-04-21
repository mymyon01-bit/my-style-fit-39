import { motion } from "framer-motion";
import { Sparkles, ShieldCheck } from "lucide-react";
import type { SizeFitResult } from "@/lib/fitEngine";

interface Props {
  size: string;
  score: number;
  fitTypeLabel: string;
  silhouette?: string;
  confidence: "HIGH" | "MEDIUM" | "LIMITED";
  regions: SizeFitResult["regions"];
}

const FRIENDLY: Record<string, string> = {
  "balanced": "Ideal",
  "fitted": "Fitted",
  "relaxed": "Relaxed",
  "oversized": "Loose",
  "slightly-tight": "Snug",
  "too-tight": "Tight",
  "too-loose": "Too loose",
  "good-length": "Right length",
  "slightly-short": "Short",
  "too-short": "Too short",
  "slightly-long": "Long",
  "too-long": "Too long",
};

const TONE: Record<string, { dot: string; text: string; bg: string; border: string }> = {
  good: { dot: "bg-emerald-500", text: "text-emerald-500", bg: "bg-emerald-500/[0.06]", border: "border-emerald-500/20" },
  warn: { dot: "bg-orange-500", text: "text-orange-500", bg: "bg-orange-500/[0.06]", border: "border-orange-500/20" },
  cool: { dot: "bg-sky-500", text: "text-sky-500", bg: "bg-sky-500/[0.06]", border: "border-sky-500/20" },
  neutral: { dot: "bg-foreground/40", text: "text-foreground/70", bg: "bg-foreground/[0.04]", border: "border-foreground/10" },
};

function toneOf(fit: string) {
  if (fit === "balanced" || fit === "fitted" || fit === "good-length") return TONE.good;
  if (fit.includes("tight") || fit.includes("short")) return TONE.warn;
  if (fit === "relaxed" || fit === "oversized" || fit.includes("loose") || fit.includes("long")) return TONE.cool;
  return TONE.neutral;
}

const CONF_TONE: Record<Props["confidence"], { text: string; bg: string; ring: string }> = {
  HIGH: { text: "text-emerald-500", bg: "bg-emerald-500/10", ring: "ring-emerald-500/30" },
  MEDIUM: { text: "text-accent", bg: "bg-accent/10", ring: "ring-accent/30" },
  LIMITED: { text: "text-orange-500", bg: "bg-orange-500/10", ring: "ring-orange-500/30" },
};

/**
 * FIT RESULT panel — rendered BEFORE image generation completes so the user
 * always sees something. Shows overall fit, confidence, and region chips.
 */
export default function FitSummaryPanel({
  size,
  score,
  fitTypeLabel,
  silhouette,
  confidence,
  regions,
}: Props) {
  const conf = CONF_TONE[confidence];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-3xl border border-foreground/[0.08] bg-gradient-to-br from-card/80 to-card/30 p-5 shadow-[0_4px_24px_-12px_hsl(var(--accent)/0.18)] backdrop-blur-sm"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3 w-3 text-accent" />
          <p className="text-[10px] font-bold tracking-[0.25em] text-foreground/55">FIT RESULT</p>
        </div>
        <span
          className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[9px] font-bold tracking-[0.18em] ring-1 ${conf.bg} ${conf.text} ${conf.ring}`}
        >
          <ShieldCheck className="h-2.5 w-2.5" />
          {confidence}
        </span>
      </div>

      {/* Hero row */}
      <div className="mt-4 flex items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="text-[10px] font-bold tracking-[0.22em] text-foreground/45">OVERALL</p>
          <p className="font-display text-2xl font-bold text-foreground leading-tight">
            {fitTypeLabel}
          </p>
          {silhouette && (
            <p className="text-[10px] tracking-[0.15em] text-foreground/55">
              · {silhouette.toUpperCase()}
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold tracking-[0.22em] text-foreground/45">SIZE</p>
          <p className="font-display text-3xl font-bold text-foreground leading-tight">
            {size}
          </p>
          <p className="text-[10px] text-foreground/55 mt-0.5">{score}/100</p>
        </div>
      </div>

      {/* Region chips */}
      {regions.length > 0 && (
        <div className="mt-4 border-t border-foreground/[0.06] pt-4">
          <p className="text-[10px] font-bold tracking-[0.22em] text-foreground/45 mb-2.5">
            REGION BREAKDOWN
          </p>
          <div className="flex flex-wrap gap-1.5">
            {regions.map((r, i) => {
              const tone = toneOf(r.fit);
              const label = FRIENDLY[r.fit] ?? r.fit.replace(/-/g, " ");
              return (
                <motion.div
                  key={r.region}
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.04 * i, duration: 0.2 }}
                  className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${tone.bg} ${tone.border}`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
                  <span className="text-[10px] font-semibold tracking-[0.12em] text-foreground/70">
                    {r.region}
                  </span>
                  <span className={`text-[10px] font-bold tracking-[0.12em] ${tone.text}`}>
                    {label}
                  </span>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}
    </motion.div>
  );
}
