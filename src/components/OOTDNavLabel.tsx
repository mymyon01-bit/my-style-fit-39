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

export default function OOTDNavLabel({
  className = "",
  crownSize = 16,
  style,
}: OOTDNavLabelProps) {
  const crownH = Math.round((crownSize * 30) / 42);
  return (
    <span
      className={`relative inline-flex items-center pr-2 ${className}`}
      style={style}
    >
      <span>OOTD</span>

      {/* Golden crown — top-right */}
      <svg
        aria-hidden="true"
        viewBox="0 0 42 30"
        width={crownSize + 5}
        height={crownH}
        className="absolute -right-[10px] -top-[12px] rotate-[12deg] drop-shadow-[0_2px_4px_hsl(var(--gold-dark)/0.35)]"
        style={{ overflow: "visible" }}
      >
        <defs>
          <linearGradient id="ootd-crown-gold" x1="5" y1="2" x2="34" y2="27" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="hsl(var(--gold-light))" />
            <stop offset="0.52" stopColor="hsl(var(--gold))" />
            <stop offset="1" stopColor="hsl(var(--gold-dark))" />
          </linearGradient>
        </defs>
        <path d="M6 24.5h30" stroke="hsl(var(--gold-dark))" strokeWidth="3" strokeLinecap="round" opacity="0.45" />
        <path
          d="M4.5 9.5 12 15.5 19.4 4.5c.7-1.05 2.1-1.05 2.8 0l7.4 11 7.9-6-3.2 15.1c-.25 1.25-1.3 2.1-2.58 2.1H10.28c-1.28 0-2.33-.85-2.58-2.1L4.5 9.5Z"
          fill="url(#ootd-crown-gold)"
          stroke="hsl(var(--gold-dark))"
          strokeWidth="1.45"
          strokeLinejoin="round"
        />
        <path d="M9 20.5h24" stroke="hsl(var(--gold-light))" strokeWidth="1.6" strokeLinecap="round" opacity="0.85" />
        <circle cx="12" cy="14.8" r="2.1" fill="hsl(var(--background))" opacity="0.92" />
        <circle cx="21" cy="9.8" r="2.4" fill="hsl(var(--background))" opacity="0.92" />
        <circle cx="30" cy="14.8" r="2.1" fill="hsl(var(--background))" opacity="0.92" />
        <path d="M35.5 2.5l1.2 2.5 2.8.42-2.05 1.95.48 2.75-2.43-1.32-2.43 1.32.48-2.75-2.05-1.95 2.8-.42 1.2-2.5Z" fill="hsl(var(--accent))" />
      </svg>
    </span>
  );
}
