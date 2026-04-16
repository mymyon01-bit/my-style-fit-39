import { RegionFit } from "@/lib/fitEngine";

interface Props {
  regions: RegionFit[];
  category: "tops" | "bottoms" | string;
}

const fitColorHex = (fit: string) => {
  if (fit.includes("tight")) return "hsl(var(--destructive))";
  if (fit.includes("short")) return "hsl(25 95% 53%)";
  if (fit === "fitted" || fit === "balanced" || fit === "good-length") return "hsl(142 71% 45%)";
  if (fit === "relaxed") return "hsl(217 91% 60%)";
  if (fit.includes("loose") || fit === "oversized") return "hsl(217 91% 60%)";
  if (fit.includes("long")) return "hsl(25 95% 53%)";
  return "hsl(var(--foreground) / 0.3)";
};

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

export default function BodySilhouette({ regions, category }: Props) {
  return (
    <div className="relative w-full flex justify-center">
      <svg
        viewBox="0 0 300 340"
        className="w-full max-w-[280px] h-auto"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Minimal mannequin silhouette */}
        <g opacity="0.15">
          {/* Head */}
          <ellipse cx="150" cy="45" rx="18" ry="22" fill="hsl(var(--foreground))" />
          {/* Neck */}
          <rect x="143" y="65" width="14" height="12" rx="4" fill="hsl(var(--foreground))" />
          {/* Torso */}
          <path
            d="M115 77 C115 77 108 82 105 100 C102 120 104 150 106 165 C108 180 112 195 118 200 L182 200 C188 195 192 180 194 165 C196 150 198 120 195 100 C192 82 185 77 185 77 Z"
            fill="hsl(var(--foreground))"
          />
          {/* Left arm */}
          <path
            d="M115 82 C108 85 95 100 88 130 C84 148 82 155 84 160"
            stroke="hsl(var(--foreground))"
            strokeWidth="12"
            strokeLinecap="round"
          />
          {/* Right arm */}
          <path
            d="M185 82 C192 85 205 100 212 130 C216 148 218 155 216 160"
            stroke="hsl(var(--foreground))"
            strokeWidth="12"
            strokeLinecap="round"
          />
          {/* Left leg */}
          <path
            d="M125 200 C122 220 120 250 118 280 C117 295 116 310 118 320"
            stroke="hsl(var(--foreground))"
            strokeWidth="16"
            strokeLinecap="round"
          />
          {/* Right leg */}
          <path
            d="M175 200 C178 220 180 250 182 280 C183 295 184 310 182 320"
            stroke="hsl(var(--foreground))"
            strokeWidth="16"
            strokeLinecap="round"
          />
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
              {/* Connection line */}
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
              {/* Indicator dot */}
              <circle cx={dotX} cy={y} r="5" fill={color} opacity="0.9" />
              {/* Label */}
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
    </div>
  );
}
