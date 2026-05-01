/**
 * OOTDDiaryIcon — nav-sized animated diary book.
 *
 * Mirrors the homepage OOTDDiaryButton aesthetic: gradient cover with #OOTD
 * branding, breathing motion when idle, opens halfway when active/hovered,
 * and bursts open with a light beam when `tapped` (parent triggers this
 * just before navigating).
 */
import { AnimatePresence, motion } from "framer-motion";

interface Props {
  /** Outer height in px. The book is ~3:4. Default 22. */
  size?: number;
  /** Currently selected nav tab. Cover opens further. */
  active?: boolean;
  /** Set true on click to fire the burst-open + light beam animation. */
  tapped?: boolean;
  className?: string;
}

export default function OOTDDiaryIcon({
  size = 22,
  active = false,
  tapped = false,
  className = "",
}: Props) {
  const w = Math.round(size * 0.78);
  const h = size;
  const labelSize = Math.max(5, Math.round(size * 0.34));
  const subSize = Math.max(3, Math.round(size * 0.13));

  return (
    <span
      className={`relative inline-block ${className}`}
      style={{ width: w, height: h, perspective: 600 }}
      aria-hidden
    >
      <motion.span
        className="relative inline-block h-full w-full"
        style={{ transformStyle: "preserve-3d" }}
        animate={!active && !tapped ? { rotateZ: [-1.5, 1.5, -1.5] } : { rotateZ: 0 }}
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

        {/* Light beam when tapped */}
        <AnimatePresence>
          {tapped && (
            <motion.span
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-r-[3px] rounded-l-[1px]"
              style={{
                background:
                  "radial-gradient(ellipse at center, hsl(var(--star) / 0.95) 0%, hsl(var(--accent) / 0.7) 35%, hsl(var(--primary) / 0.4) 65%, transparent 100%)",
                filter: "blur(3px)",
                mixBlendMode: "screen",
              }}
              initial={{ opacity: 0, scale: 0.3 }}
              animate={{ opacity: [0, 1, 1, 0.9], scale: [0.3, 1.4, 2.2, 3.2] }}
              transition={{ duration: 0.9, ease: "easeOut", times: [0, 0.3, 0.7, 1] }}
            />
          )}
        </AnimatePresence>

        {/* Cover (gradient + #OOTD label) — black outline for light-mode legibility */}
        <motion.span
          className="absolute inset-0 origin-left rounded-r-[3px] rounded-l-[1px] bg-gradient-to-br from-primary via-accent to-primary ring-[1.2px] ring-black/85 shadow-[0_0_0_0.5px_rgba(0,0,0,0.6)]"
          animate={{ rotateY: tapped ? -178 : active ? -65 : [-12, -22, -12] }}
          transition={
            tapped
              ? { duration: 0.55, ease: [0.22, 1, 0.36, 1] }
              : active
                ? { type: "spring", stiffness: 170, damping: 18 }
                : { duration: 3.6, repeat: Infinity, ease: "easeInOut" }
          }
          style={{ transformStyle: "preserve-3d", backfaceVisibility: "hidden" }}
        >
          {/* Spine highlight */}
          <span className="absolute left-[1px] top-[2px] bottom-[2px] w-px rounded-full bg-background/40" />

          {/* #OOTD label */}
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-[1px]">
            <span
              className="font-display font-black italic text-background"
              style={{
                fontSize: labelSize,
                lineHeight: 1,
                letterSpacing: "-0.02em",
                WebkitTextStroke: "0.6px #000",
                textShadow:
                  "0.5px 0.5px 0 #000, -0.5px 0.5px 0 #000, 0.5px -0.5px 0 #000, -0.5px -0.5px 0 #000",
              }}
            >
              #OOTD
            </span>
            {size >= 20 && (
              <span
                className="font-bold tracking-[0.28em] text-background/90"
                style={{
                  fontSize: subSize,
                  lineHeight: 1,
                  WebkitTextStroke: "0.4px #000",
                }}
              >
                DIARY
              </span>
            )}
          </span>
        </motion.span>
      </motion.span>
    </span>
  );
}
