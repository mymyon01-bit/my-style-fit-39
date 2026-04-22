/**
 * Brandmark — refined mymyon wordmark.
 *
 * Identity: lowercase mono, wide tracking, gradient accent dot.
 * Inspired by Off-White, Acne Studios, A24 — luxury tech editorial.
 * NOT italic. Confident, geometric, modern.
 */
import { cn } from "@/lib/utils";

type Variant = "compact" | "stacked" | "inline";

interface BrandmarkProps {
  variant?: Variant;
  className?: string;
  tagline?: string;
  asHeading?: boolean;
}

const Brandmark = ({
  variant = "compact",
  className,
  tagline,
  asHeading = false,
}: BrandmarkProps) => {
  if (variant === "stacked") {
    const Tag = asHeading ? "h1" : "div";
    return (
      <Tag className={cn("flex flex-col items-center gap-3", className)}>
        <span className="flex items-baseline font-mono text-[24px] font-medium uppercase leading-none text-foreground md:text-[28px] lg:text-[32px]">
          <span className="tracking-[0.18em]">MY</span>
          <span
            aria-hidden
            className="mx-[0.28em] inline-block h-[6px] w-[6px] translate-y-[-0.45em] rounded-full bg-gradient-to-br from-primary to-accent"
          />
          <span className="tracking-[0.18em]">MYON</span>
        </span>
        {tagline ? (
          <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.42em] text-foreground/50">
            {tagline}
          </span>
        ) : null}
      </Tag>
    );
  }

  if (variant === "inline") {
    return (
      <span
        className={cn(
          "inline-flex items-baseline font-mono text-[11px] font-medium uppercase leading-none text-foreground/80",
          className
        )}
      >
        <span className="tracking-[0.22em]">MY</span>
        <span
          aria-hidden
          className="mx-[0.26em] inline-block h-[3px] w-[3px] translate-y-[-0.45em] rounded-full bg-accent"
        />
        <span className="tracking-[0.22em]">MYON</span>
      </span>
    );
  }

  // compact (default)
  return (
    <span
      className={cn(
        "inline-flex items-baseline font-mono text-[13px] font-medium uppercase leading-none text-foreground md:text-[14px]",
        className
      )}
    >
      <span className="tracking-[0.22em]">MY</span>
      <span
        aria-hidden
        className="mx-[0.28em] inline-block h-[4px] w-[4px] translate-y-[-0.45em] rounded-full bg-gradient-to-br from-primary to-accent"
      />
      <span className="tracking-[0.22em]">MYON</span>
    </span>
  );
};

export default Brandmark;
