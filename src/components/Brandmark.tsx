/**
 * Brandmark — my'myon wordmark.
 *
 * Matches the landing page aesthetic: italic display type, with the second
 * "myon" rendered in the primary→accent gradient (`text-gradient`) — the same
 * treatment used for the rotating ticker word on the homepage.
 */
import { cn } from "@/lib/utils";

type Variant = "compact" | "stacked" | "inline";

interface BrandmarkProps {
  variant?: Variant;
  className?: string;
  tagline?: string;
  asHeading?: boolean;
}

const Wordmark = ({ className }: { className?: string }) => (
  <span
    className={cn(
      "font-display italic font-medium tracking-[-0.04em] leading-none text-foreground",
      className
    )}
  >
    my
    <span aria-hidden className="mx-[0.02em] text-foreground/40">’</span>
    <span className="text-gradient not-italic font-semibold italic">myon</span>
  </span>
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
        <Wordmark className="text-[34px] md:text-[42px] lg:text-[52px]" />
        {tagline ? (
          <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.42em] text-foreground/50">
            {tagline}
          </span>
        ) : null}
      </Tag>
    );
  }

  if (variant === "inline") {
    return <Wordmark className={cn("text-[15px]", className)} />;
  }

  // compact (default)
  return <Wordmark className={cn("text-[18px] md:text-[20px]", className)} />;
};

export default Brandmark;
