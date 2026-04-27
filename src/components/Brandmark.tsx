/**
 * Brandmark — my'myon graffiti wordmark.
 *
 * Now rendered as an image: hand-tagged neon spray-paint lettering with drips.
 * Heights are tuned so that the visible glyph cap-height roughly matches what
 * the previous text wordmark occupied at each variant size.
 */
import { cn } from "@/lib/utils";
import brandGraffiti from "@/assets/brand-graffiti.png";

type Variant = "compact" | "stacked" | "inline";

interface BrandmarkProps {
  variant?: Variant;
  className?: string;
  tagline?: string;
  asHeading?: boolean;
}

const Wordmark = ({ className }: { className?: string }) => (
  <img
    src={brandGraffiti}
    alt="my'myon"
    draggable={false}
    className={cn("block h-auto w-auto select-none", className)}
    style={{ filter: "drop-shadow(0 2px 6px hsl(var(--accent) / 0.25))" }}
  />
);

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
        <Wordmark className="h-[140px] md:h-[180px] lg:h-[220px]" />
        {tagline ? (
          <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.42em] text-foreground/50">
            {tagline}
          </span>
        ) : null}
      </Tag>
    );
  }

  if (variant === "inline") {
    return <Wordmark className={cn("h-[56px]", className)} />;
  }

  // compact (default) — used in nav bars and hero captions
  return <Wordmark className={cn("h-[68px] md:h-[80px]", className)} />;
};

export default Brandmark;
