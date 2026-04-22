// ─── INFERRED MEASUREMENTS BANNER ───────────────────────────────────────────
// Honest prompt shown when one or more body measurements were estimated
// from height/weight rather than provided directly.

import { Info } from "lucide-react";

interface Props {
  inferredFields: string[];
  onAddMeasurements?: () => void;
}

export default function InferredMeasurementsBanner({ inferredFields, onAddMeasurements }: Props) {
  if (!inferredFields.length) return null;
  const list = inferredFields.slice(0, 4).join(", ");
  const more = inferredFields.length > 4 ? ` +${inferredFields.length - 4} more` : "";
  return (
    <div className="rounded-xl border border-accent/20 bg-accent/[0.06] p-3 flex items-start gap-2">
      <Info className="h-3.5 w-3.5 text-accent mt-0.5 shrink-0" />
      <div className="flex-1 space-y-1">
        <p className="text-[11px] font-semibold text-foreground">
          Some measurements are inferred ({list}{more}).
        </p>
        <p className="text-[10px] text-foreground/60 leading-relaxed">
          Add real numbers in <span className="text-foreground/80">Body</span> for higher-accuracy size recommendations.
        </p>
        {onAddMeasurements && (
          <button
            onClick={onAddMeasurements}
            className="mt-1 text-[10px] font-bold tracking-[0.18em] text-accent hover:underline"
          >
            ADD MEASUREMENTS →
          </button>
        )}
      </div>
    </div>
  );
}
