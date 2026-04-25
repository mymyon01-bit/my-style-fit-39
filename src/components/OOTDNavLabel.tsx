import { CSSProperties } from "react";

/**
 * OOTD nav label — Banksy-style graffiti tag.
 *
 * - A spray-painted, hand-scrawled `#` sits LEFT of the wordmark, fused into
 *   the baseline like stencil graffiti on a wall, with drips and a slight
 *   spray-bleed shadow.
 * - A detailed, sparkling crown sits TOP-RIGHT of the wordmark, tilted the
 *   other way, with multi-point sparkles and a soft glow so it reads as
 *   "shiny / hero".
 *
 * Color inherits from parent (`currentColor`) for the wordmark; the crown
 * uses the accent token for a consistent pop in active/inactive states.
 */
interface OOTDNavLabelProps {
  className?: string;
  /** Crown size in px relative to the wordmark height. Default 14. */
  crownSize?: number;
  style?: CSSProperties;
}

export default function OOTDNavLabel({
  className = "",
  crownSize = 14,
  style,
}: OOTDNavLabelProps) {
  const crownH = Math.round((crownSize * 28) / 36);
  return (
    <span
      className={`relative inline-flex items-center ${className}`}
      style={style}
    >
      {/* Banksy-style graffiti `#` — stencil + spray drips, fused with wordmark */}
      <span
        aria-hidden="true"
        className="relative inline-block leading-none"
        style={{
          fontSize: "1.32em",
          marginRight: "1px",
          transform: "skewX(-12deg) rotate(-4deg) translateY(-1px)",
          fontFamily: '"Permanent Marker", "Bebas Neue", Impact, sans-serif',
          fontWeight: 900,
          color: "hsl(var(--accent))",
          // Spray-bleed: soft halo + hard stencil edge + tiny drip shadow
          textShadow: [
            "0 0 0.6px hsl(var(--background))",
            "0 0 2.2px hsl(var(--accent) / 0.55)",
            "0.4px 0.4px 0 hsl(var(--background))",
            "-0.4px 0 0 hsl(var(--background))",
            "0 1.4px 0 hsl(var(--accent) / 0.35)",
            "0 2.6px 1.2px hsl(0 0% 0% / 0.35)",
          ].join(", "),
          WebkitTextStroke: "0.35px hsl(var(--background))",
        }}
      >
        #
        {/* Tiny drip running off the bottom-left of the # */}
        <span
          aria-hidden="true"
          className="absolute"
          style={{
            left: "12%",
            bottom: "-0.35em",
            width: "1.2px",
            height: "0.45em",
            background: "hsl(var(--accent))",
            borderBottomLeftRadius: "1px",
            borderBottomRightRadius: "1px",
            opacity: 0.85,
            boxShadow: "0 1px 0 hsl(var(--background))",
          }}
        />
        {/* Second tiny drip off the right leg */}
        <span
          aria-hidden="true"
          className="absolute"
          style={{
            right: "18%",
            bottom: "-0.22em",
            width: "1px",
            height: "0.3em",
            background: "hsl(var(--accent))",
            opacity: 0.7,
          }}
        />
      </span>

      <span>OOTD</span>

      {/* Detailed sparkling crown — top-right, tilted opposite direction */}
      <svg
        aria-hidden="true"
        viewBox="0 0 36 28"
        width={crownSize + 2}
        height={crownH}
        className="absolute -right-[10px] -top-[10px] rotate-[16deg]"
        style={{ color: "hsl(var(--accent))", overflow: "visible" }}
      >
        {/* Soft glow halo behind the crown */}
        <ellipse
          cx="18"
          cy="14"
          rx="14"
          ry="9"
          fill="hsl(var(--accent) / 0.25)"
          style={{ filter: "blur(2.5px)" }}
        />
        {/* Crown body — five points, with jewel sockets */}
        <path
          d="M2.5 10 L7 4 Q7.6 3.2 8.3 4 L12 10 L17 2.5 Q18 1.5 19 2.5 L24 10 L27.7 4 Q28.4 3.2 29 4 L33.5 10 L31.4 22 Q31 24 28.6 24 L7.4 24 Q5 24 4.6 22 Z"
          fill="currentColor"
          stroke="hsl(var(--background))"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
        {/* Inner band detail */}
        <path
          d="M5.5 17 L30.5 17"
          stroke="hsl(var(--background))"
          strokeWidth="0.9"
          strokeLinecap="round"
          opacity="0.7"
        />
        {/* Jewels on the three main points */}
        <circle cx="8" cy="7" r="1.4" fill="hsl(var(--background))" />
        <circle cx="8" cy="7" r="0.7" fill="hsl(var(--accent))" />
        <circle cx="18" cy="5.5" r="1.7" fill="hsl(var(--background))" />
        <circle cx="18" cy="5.5" r="0.9" fill="hsl(var(--accent))" />
        <circle cx="28" cy="7" r="1.4" fill="hsl(var(--background))" />
        <circle cx="28" cy="7" r="0.7" fill="hsl(var(--accent))" />
        {/* Center band gem */}
        <rect
          x="16.5"
          y="19"
          width="3"
          height="3"
          rx="0.6"
          fill="hsl(var(--background))"
          transform="rotate(45 18 20.5)"
        />

        {/* Multi-point sparkles around the crown */}
        <g fill="hsl(var(--background))">
          {/* Big 4-point sparkle, top-right */}
          <path d="M33 2 L33.6 4 L35.6 4.6 L33.6 5.2 L33 7.2 L32.4 5.2 L30.4 4.6 L32.4 4 Z" />
          {/* Small sparkle, top-left */}
          <path d="M2 5 L2.4 6.2 L3.6 6.6 L2.4 7 L2 8.2 L1.6 7 L0.4 6.6 L1.6 6.2 Z" />
          {/* Tiny dot sparkles */}
          <circle cx="34" cy="11" r="0.7" />
          <circle cx="1.5" cy="13" r="0.6" />
          <circle cx="30" cy="0.8" r="0.5" />
        </g>
      </svg>
    </span>
  );
}
