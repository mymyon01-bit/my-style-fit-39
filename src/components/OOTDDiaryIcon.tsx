/**
 * OOTDDiaryIcon — tiny icon-sized animated diary book for nav bars.
 * Continuously breathes; cover sits ajar. Active state opens it more.
 */
import { motion } from "framer-motion";

interface Props {
  size?: number;
  active?: boolean;
  className?: string;
}

export default function OOTDDiaryIcon({ size = 22, active = false, className = "" }: Props) {
  // The book is roughly 3:4. Use width = size * 0.78, height = size.
  const w = Math.round(size * 0.78);
  const h = size;
  return (
    <span
      className={`relative inline-block ${className}`}
      style={{ width: w, height: h, perspective: 600 }}
      aria-hidden
    >
      <motion.span
        className="relative inline-block h-full w-full"
        style={{ transformStyle: "preserve-3d" }}
        animate={!active ? { rotateZ: [-1.5, 1.5, -1.5] } : { rotateZ: 0 }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
      >
        {/* Back cover */}
        <span className="absolute inset-0 translate-x-[1.5px] translate-y-[1.5px] rounded-r-[3px] rounded-l-[1px] bg-foreground/85" />

        {/* Inner pages */}
        <span className="absolute inset-[1px] left-[1.5px] rounded-r-[3px] rounded-l-[1px] bg-gradient-to-br from-background to-foreground/10 overflow-hidden">
          <span className="absolute left-[2px] top-[3px] h-px w-[60%] rounded-full bg-foreground/30" />
          <span className="absolute left-[2px] top-[6px] h-px w-[70%] rounded-full bg-foreground/25" />
          <span className="absolute left-[2px] top-[9px] h-px w-[50%] rounded-full bg-foreground/20" />
        </span>

        {/* Cover (slightly open, breathing) */}
        <motion.span
          className="absolute inset-0 origin-left rounded-r-[3px] rounded-l-[1px] bg-gradient-to-br from-primary via-accent to-primary"
          animate={{ rotateY: active ? -65 : [-12, -22, -12] }}
          transition={
            active
              ? { type: "spring", stiffness: 170, damping: 18 }
              : { duration: 3.6, repeat: Infinity, ease: "easeInOut" }
          }
          style={{ transformStyle: "preserve-3d", backfaceVisibility: "hidden" }}
        >
          <span className="absolute left-[1px] top-[2px] bottom-[2px] w-px rounded-full bg-background/40" />
          <span className="absolute inset-0 flex items-center justify-center">
            <span
              className="font-display font-black italic text-background"
              style={{
                fontSize: Math.max(5, Math.round(size * 0.32)),
                lineHeight: 1,
                letterSpacing: "-0.02em",
                textShadow: "0.5px 0.5px 0 hsl(var(--foreground) / 0.5)",
              }}
            >
              #
            </span>
          </span>
        </motion.span>
      </motion.span>
    </span>
  );
}
