/**
 * Brandmark — my'myon logo (new gradient mark + wordmark).
 *
 * Uses the official mymyon icon. Variants:
 * - compact: icon only (nav bars)
 * - inline:  icon + small wordmark (mobile hero top-bar)
 * - stacked: large centered icon with optional tagline
 */
import { cn } from "@/lib/utils";
import logo from "@/assets/mymyon-logo.png";

type Variant = "compact" | "stacked" | "inline";

interface BrandmarkProps {
  variant?: Variant;
  className?: string;
  tagline?: string;
  asHeading?: boolean;
  /** Visible glyph height in px. */
  size?: number;
}

const Brandmark = ({
  variant = "compact",
  className,
  tagline,
  asHeading = false,
  size,
}: BrandmarkProps) => {
  if (variant === "stacked") {
    const Tag = asHeading ? "h1" : "div";
    const s = size ?? 120;
    return (
      <Tag className={cn("flex flex-col items-center gap-3", className)}>
        <img
          src={logo}
          alt="my'myon"
          style={{ height: s, width: s }}
          className="rounded-3xl object-contain"
          draggable={false}
        />
        {tagline ? (
          <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.42em] text-foreground/50">
            {tagline}
          </span>
        ) : null}
      </Tag>
    );
  }

  if (variant === "inline") {
    const s = size ?? 28;
    return (
      <span
        className={cn("inline-flex items-center gap-2 leading-none", className)}
        aria-label="my'myon"
      >
        <img
          src={logo}
          alt=""
          style={{ height: s, width: s }}
          className="rounded-[22%] object-contain"
          draggable={false}
        />
      </span>
    );
  }

  // compact (default) — nav bars
  const s = size ?? 40;
  return (
    <img
      src={logo}
      alt="my'myon"
      style={{ height: s, width: s }}
      className={cn("rounded-[22%] object-contain", className)}
      draggable={false}
    />
  );
};

export default Brandmark;
