/**
 * Brandmark — my'myon wordmark.
 *
 * Replaces the graffiti PNG with a clean, animated text wordmark that
 * shares the same vibe as the OOTD diary button: soft breathing, gradient
 * glow halo, italic display type. Crisp and readable at every size.
 */
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type Variant = "compact" | "stacked" | "inline";

interface BrandmarkProps {
  variant?: Variant;
  className?: string;
  tagline?: string;
  asHeading?: boolean;
  /** Override font-size (px). Useful when the parent constrains height. */
  size?: number;
}

const Wordmark = ({
  size,
  className,
}: {
  size: number;
  className?: string;
}) => {
  return (
    <span
      className={cn("relative inline-flex items-center", className)}
      style={{ height: size * 1.05 }}
    >
      {/* Soft animated gradient halo — same family as OOTD button */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 rounded-full blur-2xl"
        style={{
          background:
            "radial-gradient(ellipse at center, hsl(var(--primary) / 0.35), hsl(var(--accent) / 0.25) 55%, transparent 75%)",
        }}
        animate={{ opacity: [0.55, 0.9, 0.55], scale: [1, 1.06, 1] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* The wordmark itself — gradient fill, hand-drawn italic feel */}
      <motion.span
        className="relative font-display font-black italic tracking-[-0.04em] leading-none select-none whitespace-nowrap"
        style={{
          fontSize: size,
          backgroundImage:
            "linear-gradient(135deg, hsl(var(--foreground)) 0%, hsl(var(--primary)) 45%, hsl(var(--accent)) 100%)",
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          color: "transparent",
          WebkitTextStroke: "0.5px hsl(var(--foreground) / 0.15)",
          filter: "drop-shadow(0 1px 2px hsl(var(--foreground) / 0.18))",
        }}
        animate={{ y: [0, -1.5, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
      >
        my<span className="text-accent">'</span>myon
      </motion.span>
    </span>
  );
};

const Brandmark = ({
  variant = "compact",
  className,
  tagline,
  asHeading = false,
  size,
}: BrandmarkProps) => {
  if (variant === "stacked") {
    const Tag = asHeading ? "h1" : "div";
    return (
      <Tag className={cn("flex flex-col items-center gap-3", className)}>
        <Wordmark size={size ?? 96} />
        {tagline ? (
          <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.42em] text-foreground/50">
            {tagline}
          </span>
        ) : null}
      </Tag>
    );
  }

  if (variant === "inline") {
    // Mobile hero top-bar usage. Kept tight so it pairs with small icons.
    return <Wordmark size={size ?? 22} className={className} />;
  }

  // compact (default) — used in nav bars and hero captions.
  // Sized to fill the desktop nav header (h-20) as large as possible.
  return <Wordmark size={size ?? 36} className={className} />;
};

export default Brandmark;
