/**
 * OOTDDiaryButton — a single tappable "diary book" that opens like a
 * real journal when hovered/tapped. Cover shows only `#OOTD`.
 *
 * Behavior
 *   • At rest the cover is slightly ajar so the book metaphor reads.
 *   • On hover (desktop) or tap (mobile) the cover swings open ~135°,
 *     revealing soft inner pages with handwritten ruling lines.
 *   • Click navigates to /ootd.
 *
 * Works identically on web + mobile — the book scales up on small
 * screens for thumb-friendly tapping. No extra labels, badges, or
 * ribbons — just the book and the title.
 */
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

interface Props {
  className?: string;
}

export default function OOTDDiaryButton({ className = "" }: Props) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  return (
    <div className={`relative flex flex-col items-center ${className}`}>
      {/* Soft halo glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 mx-auto my-auto h-40 w-40 rounded-full bg-gradient-to-br from-primary/30 via-accent/25 to-edge-cyan/20 blur-3xl opacity-70 sm:h-32 sm:w-32"
      />

      {/* Floating sparkle dots */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {[
          { x: -56, y: -22, c: "bg-primary", d: 0 },
          { x: 58, y: -28, c: "bg-accent", d: 0.5 },
          { x: -60, y: 42, c: "bg-edge-cyan", d: 1.0 },
          { x: 56, y: 48, c: "bg-[hsl(var(--star))]", d: 1.5 },
          { x: 0, y: -50, c: "bg-primary", d: 2.0 },
        ].map((d, i) => (
          <motion.span
            key={i}
            className={`absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full ${d.c}`}
            style={{ x: d.x, y: d.y }}
            animate={{
              y: [d.y, d.y - 6, d.y],
              opacity: [0.4, 1, 0.4],
              scale: [1, 1.4, 1],
            }}
            transition={{
              duration: 2.6,
              repeat: Infinity,
              delay: d.d,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>

      <motion.button
        onClick={() => navigate("/ootd")}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onTouchStart={() => setOpen(true)}
        whileTap={{ scale: 0.95 }}
        aria-label="Open my OOTD diary"
        className="group relative inline-flex items-center justify-center rounded-2xl p-2 outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
        style={{ perspective: 900 }}
      >
        {/* The book — large on mobile, slightly smaller on desktop */}
        <span
          className="relative inline-block h-32 w-24 sm:h-28 sm:w-[88px]"
          style={{ transformStyle: "preserve-3d" }}
        >
          {/* Back cover (depth) */}
          <span className="absolute inset-0 translate-x-[3px] translate-y-[3px] rounded-r-md rounded-l-sm bg-foreground/85 shadow-[4px_4px_0_hsl(var(--foreground)/0.25)]" />

          {/* Inner pages */}
          <span className="absolute inset-[2px] left-[3px] rounded-r-md rounded-l-sm bg-gradient-to-br from-background to-foreground/[0.05] shadow-inner overflow-hidden">
            {/* Handwritten-style ruling */}
            <span className="absolute left-3 top-4 h-px w-12 rounded-full bg-foreground/25 sm:w-10" />
            <span className="absolute left-3 top-7 h-px w-14 rounded-full bg-foreground/20 sm:w-12" />
            <span className="absolute left-3 top-10 h-px w-10 rounded-full bg-foreground/20 sm:w-9" />
            <span className="absolute left-3 top-[52px] h-px w-12 rounded-full bg-foreground/15 sm:w-10" />
            <span className="absolute left-3 top-[64px] h-px w-9 rounded-full bg-foreground/15 sm:w-8" />
            {/* tiny heart on the page */}
            <span className="absolute bottom-3 right-3 text-[14px] leading-none text-primary/70">♡</span>
          </span>

          {/* Cover (opens) */}
          <motion.span
            className="absolute inset-0 origin-left rounded-r-md rounded-l-sm bg-gradient-to-br from-primary via-accent to-primary shadow-[3px_3px_0_hsl(var(--foreground)/0.85)]"
            animate={{ rotateY: open ? -135 : -14 }}
            transition={{ type: "spring", stiffness: 180, damping: 18 }}
            style={{ transformStyle: "preserve-3d", backfaceVisibility: "hidden" }}
          >
            {/* Spine line */}
            <span className="absolute left-1 top-2 bottom-2 w-px rounded-full bg-background/30" />

            {/* Title — only #OOTD, italic display */}
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="font-display text-[22px] font-black italic tracking-tight text-background drop-shadow-[1px_1px_0_hsl(var(--foreground)/0.4)] sm:text-[20px]">
                #OOTD
              </span>
            </span>
          </motion.span>
        </span>
      </motion.button>
    </div>
  );
}
