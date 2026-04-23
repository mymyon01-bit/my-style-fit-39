/**
 * OOTDDiaryButton — the HERO centerpiece of the homepage.
 *
 * A large, continuously-breathing diary book. The cover stays subtly ajar
 * and gently sways to invite a tap. On hover/focus it swings fully open
 * (~135°) revealing handwritten ruling lines and a tiny heart on the page.
 * Surrounded by a soft animated halo and orbiting sparkle dots.
 *
 * Click navigates to /ootd. Works the same on web + mobile (scaled up on
 * small screens for thumb-friendly tapping).
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
      {/* Pulsing halo */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-72 w-72 rounded-full bg-gradient-to-br from-primary/35 via-accent/30 to-edge-cyan/25 blur-3xl sm:h-64 sm:w-64"
        animate={{ scale: [1, 1.08, 1], opacity: [0.55, 0.85, 0.55] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Soft inner ring */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-44 w-44 rounded-full border border-primary/25 sm:h-40 sm:w-40"
        animate={{ rotate: 360 }}
        transition={{ duration: 28, repeat: Infinity, ease: "linear" }}
      />

      {/* Orbiting sparkle dots */}
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 h-0 w-0">
        {[
          { x: -90, y: -34, c: "bg-primary", d: 0 },
          { x: 92, y: -42, c: "bg-accent", d: 0.5 },
          { x: -94, y: 64, c: "bg-edge-cyan", d: 1.0 },
          { x: 88, y: 70, c: "bg-[hsl(var(--star))]", d: 1.5 },
          { x: 0, y: -78, c: "bg-primary", d: 2.0 },
          { x: 0, y: 92, c: "bg-accent", d: 2.5 },
        ].map((d, i) => (
          <motion.span
            key={i}
            className={`absolute h-2 w-2 rounded-full ${d.c} shadow-[0_0_10px_currentColor]`}
            style={{ x: d.x, y: d.y, color: "currentColor" }}
            animate={{
              y: [d.y, d.y - 10, d.y],
              opacity: [0.35, 1, 0.35],
              scale: [1, 1.5, 1],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              delay: d.d,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>

      {/* Floating + breathing wrapper */}
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      >
        <motion.button
          onClick={() => navigate("/ootd")}
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onTouchStart={() => setOpen(true)}
          whileTap={{ scale: 0.94 }}
          aria-label="Open my OOTD diary"
          className="group relative inline-flex items-center justify-center rounded-3xl p-3 outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
          style={{ perspective: 1100 }}
        >
          {/* The book — much larger now */}
          <motion.span
            className="relative inline-block h-52 w-40 sm:h-48 sm:w-36"
            style={{ transformStyle: "preserve-3d" }}
            animate={!open ? { rotateZ: [-1.5, 1.5, -1.5] } : { rotateZ: 0 }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          >
            {/* Back cover (depth) */}
            <span className="absolute inset-0 translate-x-[5px] translate-y-[5px] rounded-r-lg rounded-l-sm bg-foreground/85 shadow-[6px_6px_0_hsl(var(--foreground)/0.25)]" />

            {/* Inner pages */}
            <span className="absolute inset-[3px] left-[5px] rounded-r-lg rounded-l-sm bg-gradient-to-br from-background to-foreground/[0.05] shadow-inner overflow-hidden">
              {/* Handwritten-style ruling */}
              <span className="absolute left-5 top-7 h-px w-20 rounded-full bg-foreground/25" />
              <span className="absolute left-5 top-12 h-px w-24 rounded-full bg-foreground/22" />
              <span className="absolute left-5 top-[68px] h-px w-16 rounded-full bg-foreground/20" />
              <span className="absolute left-5 top-[88px] h-px w-20 rounded-full bg-foreground/18" />
              <span className="absolute left-5 top-[108px] h-px w-14 rounded-full bg-foreground/15" />
              <span className="absolute left-5 top-[128px] h-px w-18 rounded-full bg-foreground/15" />
              {/* tiny heart on the page */}
              <motion.span
                className="absolute bottom-4 right-4 text-[20px] leading-none text-primary/80"
                animate={{ scale: [1, 1.25, 1] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
              >
                ♡
              </motion.span>
            </span>

            {/* Cover (opens) */}
            <motion.span
              className="absolute inset-0 origin-left rounded-r-lg rounded-l-sm bg-gradient-to-br from-primary via-accent to-primary shadow-[5px_5px_0_hsl(var(--foreground)/0.85)]"
              animate={{ rotateY: open ? -135 : -14 }}
              transition={{ type: "spring", stiffness: 170, damping: 18 }}
              style={{ transformStyle: "preserve-3d", backfaceVisibility: "hidden" }}
            >
              {/* Spine line */}
              <span className="absolute left-1.5 top-3 bottom-3 w-px rounded-full bg-background/35" />

              {/* Title — only #OOTD, italic display, much bigger */}
              <span className="absolute inset-0 flex flex-col items-center justify-center gap-1.5">
                <span className="font-display text-[36px] font-black italic tracking-tight text-background drop-shadow-[2px_2px_0_hsl(var(--foreground)/0.5)] sm:text-[34px]">
                  #OOTD
                </span>
                <span className="text-[8px] font-bold tracking-[0.32em] text-background/75">
                  MY DIARY
                </span>
              </span>
            </motion.span>
          </motion.span>
        </motion.button>
      </motion.div>

      {/* "Tap to open" cue underneath */}
      <motion.p
        aria-hidden
        className="mt-3 text-[10px] font-semibold uppercase tracking-[0.3em] text-foreground/55"
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
      >
        ✦ Tap to open ✦
      </motion.p>
    </div>
  );
}
