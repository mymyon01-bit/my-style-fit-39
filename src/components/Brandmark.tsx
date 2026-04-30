/**
 * Brandmark — my'myon graffiti wordmark.
 *
 * Matches the OOTD #OOTD graffiti tag aesthetic exactly:
 * - Hand-tagged spray paint feel via SVG turbulence + displacement
 * - Pink fill on top of black outline
 * - Animated spray-tip dot that "writes" along the path on a 15s loop
 * - Drip details
 *
 * Sizes scale via a single `size` (height in px). Width auto-scales.
 */
import { cn } from "@/lib/utils";

type Variant = "compact" | "stacked" | "inline";

interface BrandmarkProps {
  variant?: Variant;
  className?: string;
  tagline?: string;
  asHeading?: boolean;
  /** Visible glyph height in px. */
  size?: number;
}

// Path commands for the wordmark "my'myon" — used both for stroke rendering
// and the writing animation (joined with M moves to skip between glyphs).
const PATHS = {
  // m  (left vertical, hump1, hump2)
  m1a: "M10 22 L8 52",
  m1b: "M10 26 C16 18 26 18 28 26 L28 52",
  m1c: "M28 26 C34 18 44 18 46 26 L46 52",
  // y  (V + tail)
  y1: "M52 26 L60 50 L68 26",
  y2: "M64 38 L58 62",
  // '  apostrophe
  apos: "M76 22 L74 30",
  // m  (second m)
  m2a: "M86 22 L84 52",
  m2b: "M86 26 C92 18 102 18 104 26 L104 52",
  m2c: "M104 26 C110 18 120 18 122 26 L122 52",
  // y
  y3: "M128 26 L136 50 L144 26",
  y4: "M140 38 L134 62",
  // o
  o1: "M156 28 C148 30 146 48 156 50 C166 52 172 40 168 30 C165 23 159 26 156 28 Z",
  // n
  n1: "M180 26 L178 52",
  n2: "M180 30 C188 22 200 24 200 32 L200 52",
};

const ALL_PATHS = Object.values(PATHS).join(" ");

const Wordmark = ({
  size,
  className,
}: {
  size: number;
  className?: string;
}) => {
  // viewBox is 210 x 70 → aspect ≈ 3:1
  const width = (size * 210) / 70;

  return (
    <span
      className={cn("ootd-graffiti-tag inline-block leading-none", className)}
      style={{ height: size, width }}
      aria-label="my'myon"
    >
      <svg
        viewBox="0 0 210 70"
        className="ootd-graffiti-svg block h-full w-full"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <filter id="mymyon-spray" x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="1" seed="5" />
            <feDisplacementMap in="SourceGraphic" scale="1.2" />
          </filter>
        </defs>
        <g
          filter="url(#mymyon-spray)"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* BLACK OUTLINE LAYER — drawn first, slightly thicker */}
          {Object.entries(PATHS).map(([k, d], i) => (
            <path
              key={`out-${k}`}
              d={d}
              stroke="hsl(0 0% 6%)"
              strokeWidth={k === "apos" ? 5 : 8}
              className={`ootd-stroke s${(i % 12) + 1}`}
            />
          ))}

          {/* PINK FILL LAYER — on top, thinner */}
          {Object.entries(PATHS).map(([k, d], i) => (
            <path
              key={`fill-${k}`}
              d={d}
              stroke="hsl(330 95% 60%)"
              strokeWidth={k === "apos" ? 2.5 : 4.5}
              className={`ootd-stroke s${(i % 12) + 1}`}
            />
          ))}

          {/* Drip details — also wipe + redraw with the rest */}
          <path d="M10 52 L9 60" stroke="hsl(330 95% 60%)" strokeWidth="2.2" className="ootd-stroke s11" />
          <path d="M104 52 L103 58" stroke="hsl(0 0% 8%)" strokeWidth="2" className="ootd-stroke s12" />
          <path d="M178 52 L177 60" stroke="hsl(330 95% 60%)" strokeWidth="2" className="ootd-stroke s12" />

          {/* Moving spray-tip dot that "writes" along the path */}
          <circle r="2" fill="hsl(330 100% 70%)" className="ootd-spray-tip" opacity="0">
            <animateMotion
              dur="15s"
              begin="0.05s"
              repeatCount="indefinite"
              rotate="auto"
              keyTimes="0;0.17;1"
              keyPoints="0;1;1"
              calcMode="linear"
              path={ALL_PATHS}
            />
            <animate
              attributeName="opacity"
              values="0;1;1;0;0"
              keyTimes="0;0.01;0.16;0.18;1"
              dur="15s"
              begin="0.05s"
              repeatCount="indefinite"
            />
          </circle>
        </g>
      </svg>
    </span>
  );
};

const Brandmark = ({
  variant = "compact",
  className,
  tagline,
  asHeading = false,
  size,
}: BrandmarkProps) => {
  if (variant === "stacked") {
    const Tag = asHeading ? "h1" : "div";
    return (
      <Tag className={cn("flex flex-col items-center gap-3", className)}>
        <Wordmark size={size ?? 110} />
        {tagline ? (
          <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.42em] text-foreground/50">
            {tagline}
          </span>
        ) : null}
      </Tag>
    );
  }

  if (variant === "inline") {
    // Mobile hero top-bar
    return <Wordmark size={size ?? 26} className={className} />;
  }

  // compact (default) — used in nav bars
  return <Wordmark size={size ?? 46} className={className} />;
};

export default Brandmark;
