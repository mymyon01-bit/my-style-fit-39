import { RegionFit } from "@/lib/fitEngine";
import BodySilhouette, { fitBucket, bucketColor } from "@/components/fit/BodySilhouette";

interface Props {
  regions: RegionFit[];
  category: string;
  activeSize: string;
  fitScore: number;
}

const bucketLabel: Record<ReturnType<typeof fitBucket>, string> = {
  tight: "Tight",
  slightly: "Slightly",
  balanced: "Balanced",
  loose: "Loose",
};

/**
 * VisualFitPreviewCard
 * Hardcoded two-column layout:
 * - Left: mannequin heatmap (BodySilhouette)
 * - Right: legend + region summary list
 * Renders instantly from fit engine output. Re-renders on size switch.
 */
export default function VisualFitPreviewCard({ regions, category, activeSize, fitScore }: Props) {
  // Bucket counts power the legend chips
  const counts = regions.reduce(
    (acc, r) => {
      const b = fitBucket(r.fit);
      acc[b] = (acc[b] || 0) + 1;
      return acc;
    },
    { tight: 0, slightly: 0, balanced: 0, loose: 0 } as Record<ReturnType<typeof fitBucket>, number>
  );

  return (
    <div className="rounded-2xl border border-foreground/[0.06] bg-card/40 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <p className="text-[10px] font-bold tracking-[0.25em] text-foreground/50">VISUAL FIT</p>
        <div className="flex items-center gap-2">
          <span className="text-[9px] tracking-[0.2em] text-foreground/40">SIZE {activeSize}</span>
          <span className="text-[9px] tracking-[0.2em] text-foreground/40">·</span>
          <span className="text-[10px] font-bold text-foreground/70">{fitScore}/100</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[1fr,1fr] gap-2 p-3">
        {/* LEFT — mannequin heatmap */}
        <div className="rounded-xl bg-foreground/[0.02] p-3 flex items-center justify-center min-h-[280px]">
          <BodySilhouette regions={regions} category={category} compact />
        </div>

        {/* RIGHT — legend + region summary */}
        <div className="rounded-xl bg-foreground/[0.02] p-3 flex flex-col gap-3">
          {/* Legend strip */}
          <div className="grid grid-cols-2 gap-1.5">
            {(Object.keys(counts) as Array<keyof typeof counts>).map((k) => (
              <div
                key={k}
                className="flex items-center gap-1.5 rounded-lg bg-foreground/[0.03] px-2 py-1.5"
              >
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: bucketColor(k) }}
                />
                <span className="text-[9px] font-semibold tracking-[0.1em] uppercase text-foreground/65">
                  {bucketLabel[k]}
                </span>
                <span className="ml-auto text-[10px] font-bold text-foreground/80">{counts[k]}</span>
              </div>
            ))}
          </div>

          {/* Region summary list */}
          <div className="flex-1 space-y-1.5">
            {regions.map((r) => {
              const b = fitBucket(r.fit);
              const color = bucketColor(b);
              return (
                <div
                  key={r.region}
                  className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5"
                  style={{ backgroundColor: `${color.replace("hsl(", "hsla(").replace(")", ", 0.08)")}` }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    <span className="text-[11px] font-semibold text-foreground/80 truncate">{r.region}</span>
                  </div>
                  <span
                    className="text-[10px] font-bold uppercase tracking-wide"
                    style={{ color }}
                  >
                    {r.fit.replace(/-/g, " ")}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
