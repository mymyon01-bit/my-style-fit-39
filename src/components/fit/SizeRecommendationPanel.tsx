// ─── SIZE RECOMMENDATION PANEL ──────────────────────────────────────────────
// Measurement-driven size recommendation UI. Shows:
//   • Recommended + alternate size with confidence badge
//   • Per-size collapsible table with region status chips
//   • "Why" explanation
//   • Fit-preference toggle (defaults to global, overrides per product)
//   • Honest banner when measurements are inferred / chart used defaults

import { useState } from "react";
import { ChevronDown, ShieldCheck, AlertTriangle, Sparkles, User } from "lucide-react";
import {
  REGION_STATUS_LABEL,
  overallLabelText,
  type FitPreference,
  type RecommendationConfidence,
  type RegionStatus,
  type SizeOutcome,
  type SizeRecommendation,
} from "@/lib/sizing";
import InferredMeasurementsBanner from "./InferredMeasurementsBanner";

interface Props {
  recommendation: SizeRecommendation | null;
  loading: boolean;
  inferredFields: string[];
  preference: FitPreference;
  onPreferenceChange: (p: FitPreference) => void;
  onAddMeasurements?: () => void;
  /** Optional: surface the active size selection back to the parent. */
  onSizeSelect?: (size: string) => void;
  activeSize?: string | null;
}

const PREF_OPTIONS: { value: FitPreference; label: string }[] = [
  { value: "fitted",    label: "Fitted" },
  { value: "regular",   label: "Regular" },
  { value: "relaxed",   label: "Relaxed" },
  { value: "oversized", label: "Oversized" },
];

const STATUS_TONE: Record<RegionStatus, string> = {
  tooTight:      "text-orange-500 bg-orange-500/10",
  slightlyTight: "text-orange-400 bg-orange-400/10",
  regular:       "text-green-500 bg-green-500/10",
  slightlyLoose: "text-blue-400 bg-blue-400/10",
  loose:         "text-blue-500 bg-blue-500/10",
  oversized:     "text-blue-500 bg-blue-500/15",
};

const CONF_BADGE: Record<RecommendationConfidence, { color: string; bg: string; label: string }> = {
  high:   { color: "text-green-500",  bg: "bg-green-500/10",  label: "HIGH CONFIDENCE" },
  medium: { color: "text-accent",     bg: "bg-accent/10",     label: "MEDIUM CONFIDENCE" },
  low:    { color: "text-orange-500", bg: "bg-orange-500/10", label: "LOW CONFIDENCE" },
};

function SizeRow({
  outcome,
  isPrimary,
  isAlternate,
  isActive,
  onClick,
}: {
  outcome: SizeOutcome;
  isPrimary: boolean;
  isAlternate: boolean;
  isActive: boolean;
  onClick: () => void;
}) {
  const [expanded, setExpanded] = useState(isPrimary);
  return (
    <div
      className={`rounded-2xl border transition-colors ${
        isActive
          ? "border-foreground/40 bg-foreground/[0.04]"
          : isPrimary
          ? "border-accent/30 bg-accent/[0.04]"
          : isAlternate
          ? "border-foreground/[0.08] bg-card/40"
          : "border-foreground/[0.04] bg-card/20"
      }`}
    >
      <button onClick={() => { setExpanded((e) => !e); onClick(); }} className="flex w-full items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <span className="font-display text-xl font-bold text-foreground">{outcome.size}</span>
          {isPrimary && (
            <span className="text-[10px] font-bold tracking-[0.12em] px-2.5 py-1 rounded-full bg-accent/15 text-accent">
              RECOMMENDED
            </span>
          )}
          {isAlternate && !isPrimary && (
            <span className="text-[10px] font-bold tracking-[0.12em] px-2.5 py-1 rounded-full bg-foreground/5 text-foreground/60">
              ALTERNATE
            </span>
          )}
          <span className="text-[11px] font-medium text-foreground/55">{overallLabelText(outcome.overall)}</span>
        </div>
        <ChevronDown className={`h-4 w-4 text-foreground/40 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>
      {expanded && (
        <div className="px-4 pb-4 space-y-1.5 border-t border-foreground/[0.04] pt-3">
          {outcome.regions.map((r) => (
            <div key={r.region} className="flex items-center justify-between py-1">
              <span className="text-[11px] capitalize text-foreground/65">{r.region}</span>
              <div className="flex items-center gap-2">
                {r.deltaCm != null && (
                  <span className="text-[10px] text-foreground/40 tabular-nums">
                    {r.deltaCm > 0 ? "+" : ""}{r.deltaCm}cm
                  </span>
                )}
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${STATUS_TONE[r.status]}`}>
                  {REGION_STATUS_LABEL[r.status]}
                </span>
              </div>
            </div>
          ))}
          <p className="text-[11px] text-foreground/55 pt-2 border-t border-foreground/[0.04]">
            {outcome.summary}
          </p>
        </div>
      )}
    </div>
  );
}

export default function SizeRecommendationPanel({
  recommendation,
  loading,
  inferredFields,
  preference,
  onPreferenceChange,
  onAddMeasurements,
  onSizeSelect,
  activeSize,
}: Props) {
  if (loading && !recommendation) {
    return (
      <div className="rounded-2xl border border-foreground/[0.06] bg-card/40 p-5 space-y-3">
        <div className="h-3 w-1/3 rounded bg-foreground/[0.06] animate-pulse" />
        <div className="h-24 w-full rounded bg-foreground/[0.04] animate-pulse" />
        <div className="h-24 w-full rounded bg-foreground/[0.04] animate-pulse" />
      </div>
    );
  }
  if (!recommendation) return null;

  const conf = CONF_BADGE[recommendation.confidence];
  const primary = recommendation.sizes.find((s) => s.size === recommendation.primarySize);
  const alternate = recommendation.sizes.find((s) => s.size === recommendation.alternateSize);

  return (
    <div className="space-y-4">
      {/* Header: confidence + gender + preference toggle */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <ShieldCheck className="h-3.5 w-3.5 text-foreground/45" />
          <span className={`text-[10px] font-bold tracking-[0.15em] px-2.5 py-1 rounded-full ${conf.bg} ${conf.color}`}>
            {conf.label}
          </span>
          {recommendation.bodyGender && recommendation.bodyGender !== "neutral" && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-[0.15em] px-2.5 py-1 rounded-full bg-foreground/[0.06] text-foreground/70">
              <User className="h-3 w-3" />
              {recommendation.bodyGender === "female" ? "WOMEN" : "MEN"}
              {recommendation.productGender && recommendation.productGender !== "neutral" && recommendation.productGender !== recommendation.bodyGender && (
                <span className="ml-1 text-foreground/40">→ {recommendation.productGender === "female" ? "W" : "M"}</span>
              )}
            </span>
          )}
        </div>
        <div className="inline-flex rounded-full border border-foreground/10 p-0.5 bg-card/40">
          {PREF_OPTIONS.map((o) => (
            <button
              key={o.value}
              onClick={() => onPreferenceChange(o.value)}
              className={`px-3 py-1 text-[10px] font-bold tracking-[0.12em] rounded-full transition-colors ${
                preference === o.value
                  ? "bg-foreground text-background"
                  : "text-foreground/60 hover:text-foreground"
              }`}
            >
              {o.label.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Gender mismatch warning */}
      {recommendation.genderMismatchWarning && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-3 flex items-start gap-2">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
          <span className="text-[11px] text-amber-400/90 leading-relaxed">
            {recommendation.genderMismatchWarning}
          </span>
        </div>
      )}

      {/* Inferred measurements warning */}
      <InferredMeasurementsBanner inferredFields={inferredFields} onAddMeasurements={onAddMeasurements} />

      {/* Out-of-range warning — most important: tells user product won't fit */}
      {recommendation.rangeWarning && (
        <div className={`rounded-xl border p-3 flex items-start gap-2 ${
          recommendation.rangeStatus === "tooSmall"
            ? "border-red-500/30 bg-red-500/[0.06]"
            : "border-blue-500/30 bg-blue-500/[0.06]"
        }`}>
          <AlertTriangle className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${
            recommendation.rangeStatus === "tooSmall" ? "text-red-500" : "text-blue-400"
          }`} />
          <span className={`text-[11px] leading-relaxed ${
            recommendation.rangeStatus === "tooSmall" ? "text-red-400/90" : "text-blue-300/90"
          }`}>
            {recommendation.rangeWarning}
          </span>
        </div>
      )}

      {/* Category-defaults warning */}
      {recommendation.usedCategoryDefaults && (
        <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-3 flex items-start gap-2">
          <AlertTriangle className="h-3.5 w-3.5 text-orange-500 mt-0.5 shrink-0" />
          <span className="text-[11px] text-orange-400/80">
            No detailed size chart for this product — using category averages. Treat individual cm values as approximate.
          </span>
        </div>
      )}

      {/* Recommended + alternate summary */}
      <div className="rounded-2xl border border-foreground/[0.06] bg-card/40 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-bold tracking-[0.25em] text-foreground/55">RECOMMENDATION</p>
          <Sparkles className="h-3.5 w-3.5 text-accent/60" />
        </div>
        <div className="flex items-baseline gap-4">
          <span className="font-display text-[44px] font-medium leading-none tracking-[-0.04em] text-foreground">
            {recommendation.primarySize ?? "—"}
          </span>
          {recommendation.alternateSize && recommendation.alternateSize !== recommendation.primarySize && (
            <span className="text-[11px] tracking-[0.18em] text-foreground/45">
              ALT · {recommendation.alternateSize}
            </span>
          )}
        </div>
        <p className="text-[13px] leading-relaxed text-foreground/80">{recommendation.primaryReason}</p>
        <p className="text-[10px] text-foreground/45">{recommendation.confidenceReason}</p>
      </div>

      {/* Per-size table */}
      <div className="space-y-2">
        <p className="text-[10px] font-bold tracking-[0.25em] text-foreground/50">SIZE-BY-SIZE FIT</p>
        {recommendation.sizes.map((s) => (
          <SizeRow
            key={s.size}
            outcome={s}
            isPrimary={s.size === recommendation.primarySize}
            isAlternate={s.size === recommendation.alternateSize}
            isActive={activeSize === s.size}
            onClick={() => onSizeSelect?.(s.size)}
          />
        ))}
      </div>
    </div>
  );
}
