// ─── SELECTED SIZE FIT CARD ─────────────────────────────────────────────────
// Explains the user's CURRENTLY SELECTED size first (per spec §6) — then
// surfaces the recommended size as an alternative if it differs. Reads
// directly from the measurement-driven SizeRecommendation; no extra calc.
import { motion } from "framer-motion";
import { ArrowRight, Gauge } from "lucide-react";
import {
  REGION_STATUS_LABEL,
  overallLabelText,
  type RegionStatus,
  type SizeRecommendation,
} from "@/lib/sizing";

interface Props {
  recommendation: SizeRecommendation | null;
  activeSize: string;
  onPickRecommended?: (size: string) => void;
}

const STATUS_TONE: Record<RegionStatus, string> = {
  tooTight: "text-orange-500",
  slightlyTight: "text-orange-400",
  regular: "text-green-500",
  slightlyLoose: "text-blue-400",
  loose: "text-blue-500",
  oversized: "text-blue-500",
};

const STATUS_DOT: Record<RegionStatus, string> = {
  tooTight: "bg-orange-500",
  slightlyTight: "bg-orange-400",
  regular: "bg-green-500",
  slightlyLoose: "bg-blue-400",
  loose: "bg-blue-500",
  oversized: "bg-blue-500",
};

export default function SelectedSizeFitCard({
  recommendation,
  activeSize,
  onPickRecommended,
}: Props) {
  if (!recommendation) return null;
  const selected = recommendation.sizes.find((s) => s.size === activeSize);
  if (!selected) return null;

  const recommended = recommendation.primarySize;
  const isRecommended = recommended === activeSize;
  const altTone =
    selected.score >= 80
      ? "text-green-500"
      : selected.score >= 65
      ? "text-accent"
      : selected.score >= 50
      ? "text-orange-400"
      : "text-orange-500";

  return (
    <motion.div
      key={activeSize}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-2xl border border-foreground/[0.08] bg-card/40 p-5 space-y-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Gauge className="h-3.5 w-3.5 text-accent" />
          <p className="text-[10px] font-bold tracking-[0.25em] text-foreground/55">
            SELECTED SIZE · {activeSize}
          </p>
        </div>
        <span className={`font-display text-xl font-bold tabular-nums ${altTone}`}>
          {selected.score}
        </span>
      </div>

      <div className="space-y-1.5">
        <p className="text-[12px] font-semibold tracking-tight text-foreground">
          {overallLabelText(selected.overall)}
        </p>
        <p className="text-[12px] leading-relaxed text-foreground/70">
          {selected.summary}
        </p>
      </div>

      {selected.regions.length > 0 && (
        <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 border-t border-foreground/[0.05] pt-3">
          {selected.regions.map((r) => (
            <li key={r.region} className="flex items-center gap-2 text-[11px]">
              <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[r.status]}`} />
              <span className="capitalize text-foreground/60">{r.region}</span>
              <span className={`ml-auto font-bold uppercase tracking-[0.08em] text-[10px] ${STATUS_TONE[r.status]}`}>
                {REGION_STATUS_LABEL[r.status]}
              </span>
            </li>
          ))}
        </ul>
      )}

      {!isRecommended && recommended && (
        <button
          onClick={() => onPickRecommended?.(recommended)}
          className="group flex w-full items-center justify-between gap-3 rounded-xl border border-accent/30 bg-accent/[0.06] px-4 py-3 text-left transition-colors hover:bg-accent/[0.12]"
        >
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-bold tracking-[0.22em] text-accent/80">
              BETTER MATCH FOR YOUR BODY
            </p>
            <p className="mt-0.5 text-[12px] leading-snug text-foreground/85">
              Try size <span className="font-bold">{recommended}</span> — {recommendation.primaryReason}
            </p>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-accent transition-transform group-hover:translate-x-0.5" />
        </button>
      )}

      {isRecommended && (
        <p className="rounded-xl border border-green-500/20 bg-green-500/[0.06] px-3 py-2 text-[11px] text-green-500/90">
          ✓ This is the best size for your measurements.
        </p>
      )}
    </motion.div>
  );
}
