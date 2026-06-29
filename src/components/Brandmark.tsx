/**
 * Brandmark — MYMYON luxury cursive "my" signature mark.
 * Gold script floating on an organic black ink-blot splash, used across all in-app surfaces.
 */
import { cn } from "@/lib/utils";
import signature from "@/assets/mymyon-logo-ink-exact.png.asset.json";

type Variant = "compact" | "stacked" | "inline";

interface BrandmarkProps {
  variant?: Variant;
  className?: string;
  tagline?: string;
  asHeading?: boolean;
  size?: number;
}

const Wordmark = ({ size, className }: { size: number; className?: string }) => {
  // The signature artwork is roughly 2:1 (wide). Keep aspect by setting height only.
  return (
    <span
      className={cn("inline-block leading-none", className)}
      style={{ height: size }}
      aria-label="mymyon"
    >
      <img
        src={signature.url}
        alt="mymyon"
        className="block h-full w-auto select-none"
        draggable={false}
      />
    </span>
  );
};

const Brandmark = ({ variant = "compact", className, tagline, asHeading = false, size }: BrandmarkProps) => {
  if (variant === "stacked") {
    const Tag = asHeading ? "h1" : "div";
    return (
      <Tag className={cn("flex flex-col items-center gap-3", className)}>
        <Wordmark size={size ?? 72} />
        {tagline ? (
          <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.42em] text-foreground/50">{tagline}</span>
        ) : null}
      </Tag>
    );
  }
  if (variant === "inline") return <Wordmark size={size ?? 22} className={className} />;
  return <Wordmark size={size ?? 36} className={className} />;
};

export default Brandmark;
