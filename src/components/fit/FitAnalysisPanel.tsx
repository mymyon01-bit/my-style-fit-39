// ─── FitAnalysisPanel — V3.8 ───────────────────────────────────────────────
// Numeric size-correlation surface. Renders S/M/L/XL chips with score +
// label + warning, the selected-size copy line, and the source-confidence
// label. Pure presentation — driven by the CorrelationResult prop.

import { AlertTriangle, Info } from "lucide-react";
import type { CorrelationResult, SizeAnalysis, WarningLevel } from "@/lib/fit/sizeCorrelationEngine";

interface Props {
  correlation: CorrelationResult;
  activeSize: string;
  onPickSize?: (size: string) => void;
}

const WARNING_TONE: Record<WarningLevel, string> = {
  none:    "text-foreground/60",
  info:    "text-foreground/55",
  caution: "text-orange-400/85",
  high:    "text-orange-500",
};

function shortLabel(s: SizeAnalysis): string {
  // "Best", "Good", "Tight", "Relaxed", "Oversized", "Risky", "—"
  return s.fitLabel.replace(" Fit", "").replace("Not Recommended", "Risky");
}

export default function FitAnalysisPanel({ correlation, activeSize, onPickSize }: Props) {
  const selected = correlation.selectedAnalysis;
  return (
    <div className="rounded-2xl border border-foreground/[0.06] bg-card/40 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold tracking-[0.25em] text-foreground/55">SIZE CORRELATION</p>
        <span className="text-[10px] uppercase tracking-[0.18em] text-foreground/40">
          {correlation.confidenceLabel}
        </span>
      </div>

      {/* per-size chips */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {correlation.allSizes.map((s) => {
          const active = s.size === activeSize;
          const recommended = s.size === correlation.recommendedSize;
          return (
            <button
              key={s.size}
              onClick={() => onPickSize?.(s.size)}
              className={`flex flex-col items-start gap-1 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                active
                  ? "border-foreground/40 bg-foreground/[0.05]"
                  : "border-foreground/[0.08] bg-card/30 hover:bg-foreground/[0.03]"
              }`}
            >
              <div className="flex w-full items-center justify-between">
                <span className="font-display text-base font-bold text-foreground">{s.size}</span>
                <span className={`text-[10px] font-bold tracking-[0.12em] ${WARNING_TONE[s.warningLevel]}`}>
                  {s.fitScore}
                </span>
              </div>
              <span className="text-[10px] uppercase tracking-[0.14em] text-foreground/55">
                {shortLabel(s)}
              </span>
              {recommended && (
                <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-accent">Recommended</span>
              )}
            </button>
          );
        })}
      </div>

      {/* selected size copy */}
      <div className="space-y-2 rounded-xl border border-foreground/[0.05] bg-background/40 p-3.5">
        <p className="text-[13px] leading-relaxed text-foreground/85">{selected.copy}</p>
        {selected.warningLevel === "high" && (
          <div className="flex items-start gap-2 text-[11px] text-orange-400/90">
            <AlertTriangle className="mt-[1px] h-3.5 w-3.5 shrink-0" />
            <span>High risk: this size is likely too tight for your measurements.</span>
          </div>
        )}
        {selected.warningLevel === "caution" && (
          <div className="flex items-start gap-2 text-[11px] text-foreground/55">
            <Info className="mt-[1px] h-3.5 w-3.5 shrink-0" />
            <span>{correlation.recommendationReason}</span>
          </div>
        )}
        {selected.warningLevel === "info" && correlation.recommendedSize !== selected.size && (
          <p className="text-[11px] text-foreground/50">{correlation.recommendationReason}</p>
        )}
      </div>

      {/* per-region delta table */}
      <div className="space-y-1">
        {selected.regionComparisons
          .filter((r) => r.deltaCm != null)
          .slice(0, 6)
          .map((r) => (
            <div key={r.region} className="flex items-center justify-between border-b border-foreground/[0.04] py-1.5 last:border-b-0">
              <span className="text-[11px] uppercase tracking-[0.14em] text-foreground/55">{r.region}</span>
              <span className="text-[11px] tabular-nums text-foreground/70">
                {r.deltaCm! > 0 ? "+" : ""}{r.deltaCm} cm
              </span>
            </div>
          ))}
      </div>
    </div>
  );
}
