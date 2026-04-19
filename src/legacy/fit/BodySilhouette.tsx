import { RegionFit } from "@/lib/fitEngine";

interface Props {
  regions: RegionFit[];
  category: "tops" | "bottoms" | string;
  showLegend?: boolean;
  compact?: boolean;
}

/* 4-bucket color rule (per spec):
   red       = tight (too-tight)
   orange    = slightly tight / off length
   green     = balanced (fitted/balanced/good-length/relaxed)
   blue      = loose (oversized/too-loose) */
export const fitBucket = (fit: string): "tight" | "slightly" | "balanced" | "loose" => {
  if (fit === "too-tight" || fit === "too-short") return "tight";
  if (fit.includes("tight") || fit.includes("short") || fit.includes("long")) return "slightly";
  if (fit === "fitted" || fit === "balanced" || fit === "good-length" || fit === "relaxed") return "balanced";
  return "loose";
};

export const bucketColor = (b: ReturnType<typeof fitBucket>) => {
  switch (b) {
    case "tight": return "hsl(0 84% 60%)";        // red
    case "slightly": return "hsl(25 95% 53%)";    // orange
    case "balanced": return "hsl(142 71% 45%)";   // green
    case "loose": return "hsl(217 91% 60%)";      // blue
  }
};

const fitColorHex = (fit: string) => bucketColor(fitBucket(fit));

const regionToY: Record<string, number> = {
  Shoulder: 85,
  Chest: 120,
  Waist: 160,
  Hip: 190,
  Thigh: 230,
  Inseam: 270,
  Rise: 200,
  Sleeve: 140,
  Length: 180,
};

const regionSide: Record<string, "left" | "right"> = {
  Shoulder: "right",
  Chest: "left",
  Waist: "right",
  Hip: "left",
  Thigh: "right",
  Inseam: "left",
  Rise: "right",
  Sleeve: "left",
  Length: "right",
};

const LEGEND: Array<{ key: ReturnType<typeof fitBucket>; label: string }> = [
  { key: "tight", label: "Tight" },
  { key: "slightly", label: "Slightly" },
  { key: "balanced", label: "Balanced" },
  { key: "loose", label: "Loose" },
];

export default function BodySilhouette({ regions, category, showLegend = false, compact = false }: Props) {
  return (
    <div className="relative w-full flex flex-col items-center gap-3">
      <svg
        viewBox="0 0 300 340"
        className={`w-full ${compact ? "max-w-[220px]" : "max-w-[280px]"} h-auto`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Soft body-region tint zones — make heatmap feel "on body", not just dots */}
        {regions.map((r) => {
          const y = regionToY[r.region] ?? 150;
          const color = fitColorHex(r.fit);
          // Region tint band on the torso/legs
          const w = r.region === "Shoulder" ? 90 : r.region === "Inseam" ? 70 : 95;
          const h = r.region === "Sleeve" ? 18 : 22;
          return (
            <rect
              key={`tint-${r.region}`}
              x={150 - w / 2}
              y={y - h / 2}
              width={w}
              height={h}
              rx={10}
              fill={color}
              opacity={0.18}
            />
          );
        })}

        {/* Mannequin silhouette */}
        <g opacity="0.22">
          <ellipse cx="150" cy="45" rx="18" ry="22" fill="hsl(var(--foreground))" />
          <rect x="143" y="65" width="14" height="12" rx="4" fill="hsl(var(--foreground))" />
          <path
            d="M115 77 C115 77 108 82 105 100 C102 120 104 150 106 165 C108 180 112 195 118 200 L182 200 C188 195 192 180 194 165 C196 150 198 120 195 100 C192 82 185 77 185 77 Z"
            fill="hsl(var(--foreground))"
          />
          <path d="M115 82 C108 85 95 100 88 130 C84 148 82 155 84 160" stroke="hsl(var(--foreground))" strokeWidth="12" strokeLinecap="round" />
          <path d="M185 82 C192 85 205 100 212 130 C216 148 218 155 216 160" stroke="hsl(var(--foreground))" strokeWidth="12" strokeLinecap="round" />
          <path d="M125 200 C122 220 120 250 118 280 C117 295 116 310 118 320" stroke="hsl(var(--foreground))" strokeWidth="16" strokeLinecap="round" />
          <path d="M175 200 C178 220 180 250 182 280 C183 295 184 310 182 320" stroke="hsl(var(--foreground))" strokeWidth="16" strokeLinecap="round" />
        </g>

        {/* Region indicators */}
        {regions.map((r) => {
          const y = regionToY[r.region] ?? 150;
          const side = regionSide[r.region] ?? "right";
          const dotX = side === "left" ? 60 : 240;
          const lineStartX = side === "left" ? 90 : 210;
          const color = fitColorHex(r.fit);

          return (
            <g key={r.region}>
              <line
                x1={lineStartX}
                y1={y}
                x2={dotX + (side === "left" ? 12 : -12)}
                y2={y}
                stroke={color}
                strokeWidth="1"
                strokeDasharray="3 2"
                opacity="0.6"
              />
              <circle cx={dotX} cy={y} r="5" fill={color} opacity="0.95" />
              <text
                x={side === "left" ? dotX - 12 : dotX + 12}
                y={y - 6}
                textAnchor={side === "left" ? "end" : "start"}
                className="text-[9px] font-semibold"
                fill="hsl(var(--foreground))"
                opacity="0.7"
              >
                {r.region}
              </text>
              <text
                x={side === "left" ? dotX - 12 : dotX + 12}
                y={y + 7}
                textAnchor={side === "left" ? "end" : "start"}
                className="text-[8px] font-medium"
                fill={color}
              >
                {r.fit.replace(/-/g, " ")}
              </text>
            </g>
          );
        })}
      </svg>

      {showLegend && (
        <div className="flex items-center justify-center gap-2.5 pt-1">
          {LEGEND.map((l) => (
            <div key={l.key} className="flex items-center gap-1.5">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: bucketColor(l.key) }}
              />
              <span className="text-[9px] font-semibold tracking-[0.1em] uppercase text-foreground/55">
                {l.label}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
