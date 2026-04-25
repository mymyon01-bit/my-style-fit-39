import { CSSProperties } from "react";

/**
 * OOTD label with a graffiti-style crown sticker top-left and a graffiti `#`
 * fused into the wordmark — signals "OOTD is our hero feature".
 *
 * Used in DesktopNav + BottomNav. Color inherits from parent (`currentColor`)
 * so it adapts to active/inactive states automatically. The crown uses the
 * accent token for a subtle pop regardless of active state.
 */
interface OOTDNavLabelProps {
  /** Tailwind text-size classes for the OOTD wordmark (e.g. `text-[10px]`). */
  className?: string;
  /** Crown size in px relative to the wordmark height. Default 14. */
  crownSize?: number;
  /** Optional style overrides. */
  style?: CSSProperties;
}

export default function OOTDNavLabel({
  className = "",
  crownSize = 14,
  style,
}: OOTDNavLabelProps) {
  return (
    <span
      className={`relative inline-flex items-center ${className}`}
      style={style}
    >
      {/* Graffiti-style crown sticker, top-left, slightly tilted */}
      <svg
        aria-hidden="true"
        viewBox="0 0 32 26"
        width={crownSize}
        height={Math.round((crownSize * 26) / 32)}
        className="absolute -left-[6px] -top-[9px] -rotate-[18deg] drop-shadow-[0_1px_0_rgba(0,0,0,0.35)]"
        style={{ color: "hsl(var(--accent))" }}
      >
        {/* Drippy graffiti crown — chunky outline + hand-drawn fill */}
        <path
          d="M2.5 9 L7 4 L11.5 10 L16 2.5 L20.5 10 L25 4 L29.5 9 L27.5 21 Q27 23 24.5 23 L7.5 23 Q5 23 4.5 21 Z"
          fill="currentColor"
          stroke="hsl(var(--background))"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        {/* Drip under crown */}
        <path
          d="M11 23 L11 25.2 Q11 26 11.7 26 Q12.4 26 12.4 25.2 L12.4 23 Z"
          fill="currentColor"
          stroke="hsl(var(--background))"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        {/* Sparkle dots */}
        <circle cx="7" cy="6.5" r="1.1" fill="hsl(var(--background))" />
        <circle cx="25" cy="6.5" r="1.1" fill="hsl(var(--background))" />
      </svg>

      {/* Graffiti `#` fused with OOTD wordmark */}
      <span
        aria-hidden="true"
        className="font-display italic font-black leading-none -mr-[1px] text-accent"
        style={{
          fontSize: "1.18em",
          transform: "skewX(-10deg) translateY(-1px)",
          textShadow:
            "1px 0 0 hsl(var(--background)), -1px 0 0 hsl(var(--background)), 0 1px 0 hsl(var(--background))",
        }}
      >
        #
      </span>
      <span>OOTD</span>
    </span>
  );
}
