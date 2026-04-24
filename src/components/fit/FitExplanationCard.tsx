// ─── FIT EXPLANATION CARD ───────────────────────────────────────────────────
// Renders the parallel calculation + explanation layer ALONGSIDE the existing
// fit visual. Recomputes instantly on size/item change. Does NOT trigger any
// image regeneration.
import { useMemo } from "react";
import { motion } from "framer-motion";
import { Gauge, Sparkles } from "lucide-react";
import {
  computeFitExplanation,
  type FitLayerInput,
} from "@/lib/fit/fitExplanationLayer";

interface Props extends FitLayerInput {
  /** Shown above the score, e.g. "Size M". */
  sizeLabel?: string;
}

export default function FitExplanationCard(props: Props) {
  const out = useMemo(
    () =>
      computeFitExplanation({
        heightCm: props.heightCm,
        weightKg: props.weightKg ?? null,
        category: props.category,
        selectedSize: props.selectedSize,
        garment: props.garment ?? null,
        preference: props.preference ?? null,
      }),
    [
      props.heightCm,
      props.weightKg,
      props.category,
      props.selectedSize,
      props.garment,
      props.preference,
    ],
  );

  const tone =
    out.fit_score >= 85
      ? "text-green-500"
      : out.fit_score >= 70
      ? "text-accent"
      : out.fit_score >= 55
      ? "text-orange-400"
      : "text-orange-500";
  const ringTone =
    out.fit_score >= 85
      ? "ring-green-500/30"
      : out.fit_score >= 70
      ? "ring-accent/30"
      : out.fit_score >= 55
      ? "ring-orange-400/30"
      : "ring-orange-500/30";

  return (
    <motion.div
      key={`${props.selectedSize}-${out.fit_score}`}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-2xl border border-foreground/[0.08] bg-card/40 p-5 space-y-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Gauge className="h-3.5 w-3.5 text-accent" />
          <p className="text-[10px] font-bold tracking-[0.25em] text-foreground/55">
            FIT EXPLANATION
          </p>
        </div>
        {props.sizeLabel && (
          <span className="text-[10px] font-bold tracking-[0.18em] text-foreground/45">
            {props.sizeLabel}
          </span>
        )}
      </div>

      {/* Score + summary */}
      <div className="flex items-center gap-4">
        <div
          className={`flex h-16 w-16 items-center justify-center rounded-full ring-2 ${ringTone} bg-background/40`}
        >
          <span className={`font-display text-2xl font-bold ${tone}`}>
            {out.fit_score}
          </span>
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-[13px] leading-snug text-foreground/85">
            {out.fit_summary}
          </p>
          <p className="text-[11px] leading-relaxed text-foreground/55">
            {out.size_advice}
          </p>
        </div>
      </div>

      {/* Key feedback bullets */}
      {out.key_feedback.length > 0 && (
        <ul className="space-y-1.5 border-t border-foreground/[0.05] pt-3">
          {out.key_feedback.map((b, i) => (
            <li
              key={i}
              className="flex items-start gap-2 text-[12px] leading-relaxed text-foreground/75"
            >
              <span className="mt-1 text-accent">•</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Visual-consistency description (matches the existing image, no regen) */}
      <div className="rounded-xl border border-foreground/[0.06] bg-background/40 p-3">
        <div className="mb-1 flex items-center gap-1.5">
          <Sparkles className="h-3 w-3 text-foreground/45" />
          <p className="text-[9px] font-bold tracking-[0.22em] text-foreground/50">
            VISUAL DESCRIPTION
          </p>
        </div>
        <p className="text-[12px] leading-relaxed text-foreground/70">
          {out.visual_description}
        </p>
      </div>
    </motion.div>
  );
}
