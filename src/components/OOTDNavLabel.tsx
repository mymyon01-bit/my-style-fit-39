import { CSSProperties } from "react";

/**
 * OOTD nav label — plain "OOTD" text matching other nav labels,
 * with a small golden crown floating top-right.
 */
interface OOTDNavLabelProps {
  className?: string;
  /** Crown size in px. Default 11. */
  crownSize?: number;
  style?: CSSProperties;
}

const GOLD = "#F5C24A";
const GOLD_DEEP = "#B8860B";

export default function OOTDNavLabel({
  className = "",
  crownSize = 11,
  style,
}: OOTDNavLabelProps) {
  const crownH = Math.round((crownSize * 28) / 36);
  return (
    <span
      className={`relative inline-flex items-center ${className}`}
      style={style}
    >
      <span>OOTD</span>

      {/* Golden crown — top-right */}
      <svg
        aria-hidden="true"
        viewBox="0 0 36 28"
        width={crownSize + 2}
        height={crownH}
        className="absolute -right-[8px] -top-[7px] rotate-[14deg]"
        style={{ overflow: "visible" }}
      >
        {/* Soft gold glow */}
        <ellipse
          cx="18"
          cy="14"
          rx="13"
          ry="8"
          fill={GOLD}
          opacity="0.35"
          style={{ filter: "blur(2px)" }}
        />
        {/* Crown body */}
        <path
          d="M2.5 10 L7 4 Q7.6 3.2 8.3 4 L12 10 L17 2.5 Q18 1.5 19 2.5 L24 10 L27.7 4 Q28.4 3.2 29 4 L33.5 10 L31.4 22 Q31 24 28.6 24 L7.4 24 Q5 24 4.6 22 Z"
          fill={GOLD}
          stroke={GOLD_DEEP}
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        {/* Inner band */}
        <path
          d="M5.5 17 L30.5 17"
          stroke={GOLD_DEEP}
          strokeWidth="0.8"
          strokeLinecap="round"
          opacity="0.7"
        />
        {/* Jewels */}
        <circle cx="8" cy="7" r="1.3" fill="hsl(var(--background))" />
        <circle cx="8" cy="7" r="0.65" fill={GOLD_DEEP} />
        <circle cx="18" cy="5.5" r="1.6" fill="hsl(var(--background))" />
        <circle cx="18" cy="5.5" r="0.85" fill={GOLD_DEEP} />
        <circle cx="28" cy="7" r="1.3" fill="hsl(var(--background))" />
        <circle cx="28" cy="7" r="0.65" fill={GOLD_DEEP} />
      </svg>
    </span>
  );
}
