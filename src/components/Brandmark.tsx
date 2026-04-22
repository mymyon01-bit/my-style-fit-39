/**
 * Brandmark — the sophisticated mymyon wordmark.
 *
 * One source of truth for the app's logo. Replaces the previous
 * uppercase "WARDROBE" treatment with a refined lowercase serif
 * wordmark inspired by editorial mastheads (Aesop, Acne, Études).
 *
 * Anatomy:
 *   m y · m y o n
 *   └── display serif, lowercase, optical italic ligature on the dot
 *
 * Variants:
 *   - "compact": for nav bars, mobile page headers (default)
 *   - "stacked": for splash / auth / hero with ALL ONE THING tagline
 *   - "inline":  small inline mark for footers / admin
 *
 * Tone: do NOT uppercase. Lowercase + serif is the signature.
 */
import { cn } from "@/lib/utils";

type Variant = "compact" | "stacked" | "inline";

interface BrandmarkProps {
  variant?: Variant;
  className?: string;
  /** Optional muted micro-tagline beneath the mark (stacked only). */
  tagline?: string;
  /** When true, renders as an h1 instead of a span. */
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
      <Tag className={cn("flex flex-col items-center gap-2", className)}>
        <span className="flex items-baseline font-display text-[28px] font-light leading-none text-foreground md:text-[34px] lg:text-[38px]">
          <span className="tracking-[0.04em]">my</span>
          <span
            aria-hidden
            className="mx-[0.18em] inline-block h-[3px] w-[3px] translate-y-[-0.55em] rounded-full bg-accent/70"
          />
          <span className="tracking-[0.04em]">myon</span>
        </span>
        {tagline ? (
          <span className="text-[9px] font-medium uppercase tracking-[0.45em] text-foreground/45">
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
          "inline-flex items-baseline font-display text-[12px] font-medium leading-none text-foreground/80",
          className
        )}
      >
        <span className="tracking-[0.06em]">my</span>
        <span
          aria-hidden
          className="mx-[0.16em] inline-block h-[2px] w-[2px] translate-y-[-0.5em] rounded-full bg-accent/65"
        />
        <span className="tracking-[0.06em]">myon</span>
      </span>
    );
  }

  // compact (default)
  return (
    <span
      className={cn(
        "inline-flex items-baseline font-display text-[15px] font-light leading-none text-foreground md:text-[16px]",
        className
      )}
    >
      <span className="tracking-[0.05em]">my</span>
      <span
        aria-hidden
        className="mx-[0.18em] inline-block h-[2.5px] w-[2.5px] translate-y-[-0.55em] rounded-full bg-accent/70"
      />
      <span className="tracking-[0.05em]">myon</span>
    </span>
  );
};

export default Brandmark;
