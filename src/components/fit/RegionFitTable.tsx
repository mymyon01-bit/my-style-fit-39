// ─── REGION FIT TABLE ───────────────────────────────────────────────────────
// Honest, region-by-region fit breakdown surfaced in FitResults.
// Always renders selected size, overall label, confidence, and a per-region
// list. When exact size data is missing it shows the explicit warning the
// product spec requires.

import { AlertTriangle, Loader2, ShieldCheck } from "lucide-react";
import type { RegionFitComputation, RegionFitResult } from "@/lib/fit/regionFitEngine";

const TONE_CLASS: Record<RegionFitResult["tone"], string> = {
  tight: "text-orange-500",
  regular: "text-green-500",
  loose: "text-blue-400",
};

function humanizeLabel(label: string): string {
  return label.replace(/-/g, " ").toUpperCase();
}

interface Props {
  fit: RegionFitComputation | null;
  loading?: boolean;
  fetching?: boolean;
  selectedSize: string;
}

export default function RegionFitTable({ fit, loading, fetching, selectedSize }: Props) {
  if (loading && !fit) {
    return (
      <div className="rounded-2xl border border-foreground/[0.06] bg-card/40 p-5 space-y-3">
        <div className="h-3 w-40 rounded bg-foreground/[0.06] animate-pulse" />
        <div className="h-3 w-full rounded bg-foreground/[0.04] animate-pulse" />
        <div className="h-3 w-3/4 rounded bg-foreground/[0.04] animate-pulse" />
      </div>
    );
  }

  if (!fit) return null;

  const confColor =
    fit.confidence === "high"   ? "text-green-500 bg-green-500/10"
  : fit.confidence === "medium" ? "text-accent bg-accent/10"
  :                                "text-orange-500 bg-orange-500/10";

  return (
    <div className="rounded-2xl border border-foreground/[0.08] bg-card/40 p-5 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <p className="text-[10px] font-bold tracking-[0.25em] text-foreground/55">
            REGION FIT · SIZE {selectedSize.toUpperCase()}
          </p>
          {fit.exactSizeDataAvailable && (
            <ShieldCheck className="h-3 w-3 text-green-500/70" aria-label="Exact brand measurements" />
          )}
        </div>
        <span className={`text-[10px] font-bold tracking-[0.18em] px-2.5 py-1 rounded-full ${confColor}`}>
          {fit.confidence.toUpperCase()} CONFIDENCE
        </span>
      </div>

      {/* Approximate / missing-data warnings — honest, never hidden */}
      {fit.warnings.length > 0 && (
        <div className="space-y-2">
          {fit.warnings.map((w, i) => (
            <div
              key={i}
              className="flex items-start gap-2 rounded-xl border border-orange-500/20 bg-orange-500/5 px-3 py-2"
            >
              <AlertTriangle className="h-3.5 w-3.5 text-orange-500 mt-0.5 shrink-0" />
              <p className="text-[11px] leading-relaxed text-orange-400/90">{w}</p>
            </div>
          ))}
          {fetching && (
            <div className="flex items-center gap-2 px-1 text-[10px] text-foreground/50">
              <Loader2 className="h-3 w-3 animate-spin" />
              Fetching official size chart…
            </div>
          )}
        </div>
      )}

      {/* Region list */}
      {fit.regions.length === 0 ? (
        <p className="text-[12px] text-foreground/55">
          Not enough garment measurements to produce a region-by-region fit yet.
        </p>
      ) : (
        <div className="space-y-1.5">
          {fit.regions.map((r) => (
            <div
              key={r.region}
              className="flex items-center justify-between border-b border-foreground/[0.04] py-1.5 last:border-b-0"
            >
              <div className="flex items-center gap-2">
                <span className="text-[12px] text-foreground/75">{r.region}</span>
                {typeof r.bodyValueCm === "number" && typeof r.garmentValueCm === "number" && (
                  <span className="text-[10px] text-foreground/40">
                    body {r.bodyValueCm}cm · garment {r.garmentValueCm}cm
                  </span>
                )}
              </div>
              <span className={`text-[10px] font-bold tracking-wider ${TONE_CLASS[r.tone]}`}>
                {humanizeLabel(r.label)}
              </span>
            </div>
          ))}
        </div>
      )}

      <p className="text-[12px] leading-relaxed text-foreground/70 pt-1 border-t border-foreground/[0.04]">
        {fit.summary}
      </p>
    </div>
  );
}
