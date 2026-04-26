/**
 * OOTDDiaryButton — compact homepage hero (≈50% smaller than before).
 *
 * Continuously breathing diary book. Hover/focus opens the cover ajar.
 * On click, a magical rainbow portal bursts outward — like stepping into
 * another world — before navigating to /ootd.
 */
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

interface Props {
  className?: string;
  /** When true, scale the whole hero down to match bottom-nav icon size. */
  compact?: boolean;
}

export default function OOTDDiaryButton({ className = "", compact = false }: Props) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [portal, setPortal] = useState(false);

  const handleClick = () => {
    if (portal) return;
    setPortal(true);
    setOpen(true);
    // Let the full open + light burst play, then navigate
    setTimeout(() => navigate("/ootd"), 1100);
  };

  return (
    <div
      className={`relative flex flex-col items-center ${className}`}
      style={compact ? { transform: "scale(0.42)", transformOrigin: "center top" } : undefined}
    >
      {/* Pulsing halo */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-24 w-24 rounded-full bg-gradient-to-br from-primary/35 via-accent/30 to-edge-cyan/25 blur-2xl"
        animate={{ scale: [1, 1.08, 1], opacity: [0.55, 0.85, 0.55] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Soft inner ring */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-14 w-14 rounded-full border border-primary/25"
        animate={{ rotate: 360 }}
        transition={{ duration: 28, repeat: Infinity, ease: "linear" }}
      />

      {/* Orbiting sparkle dots (scaled down) */}
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 h-0 w-0">
        {[
          { x: -30, y: -12, c: "bg-primary", d: 0 },
          { x: 31, y: -14, c: "bg-accent", d: 0.5 },
          { x: -31, y: 22, c: "bg-edge-cyan", d: 1.0 },
          { x: 30, y: 24, c: "bg-[hsl(var(--star))]", d: 1.5 },
          { x: 0, y: -26, c: "bg-primary", d: 2.0 },
          { x: 0, y: 31, c: "bg-accent", d: 2.5 },
        ].map((d, i) => (
          <motion.span
            key={i}
            className={`absolute h-1 w-1 rounded-full ${d.c} shadow-[0_0_8px_currentColor]`}
            style={{ x: d.x, y: d.y }}
            animate={{
              y: [d.y, d.y - 6, d.y],
              opacity: [0.35, 1, 0.35],
              scale: [1, 1.5, 1],
            }}
            transition={{ duration: 3, repeat: Infinity, delay: d.d, ease: "easeInOut" }}
          />
        ))}
      </div>

      {/* Magical rainbow portal — fires on click */}
      <AnimatePresence>
        {portal && (
          <>
            {/* Expanding rainbow rings */}
            {[0, 0.08, 0.16, 0.24].map((delay, i) => (
              <motion.div
                key={`ring-${i}`}
                aria-hidden
                className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{
                  width: 48,
                  height: 48,
                  background:
                    "conic-gradient(from 0deg, hsl(0 90% 65%), hsl(45 95% 60%), hsl(120 70% 60%), hsl(190 85% 60%), hsl(260 80% 65%), hsl(320 85% 65%), hsl(0 90% 65%))",
                  filter: "blur(2px)",
                  opacity: 0.85,
                }}
                initial={{ scale: 0.4, opacity: 0.9 }}
                animate={{ scale: 18, opacity: 0, rotate: 180 }}
                transition={{ duration: 1.2, delay, ease: [0.22, 1, 0.36, 1] }}
              />
            ))}

            {/* Inner white burst */}
            <motion.div
              aria-hidden
              className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 30, opacity: [0, 0.6, 0] }}
              transition={{ duration: 0.85, ease: "easeOut" }}
              style={{ width: 36, height: 36, filter: "blur(8px)" }}
            />

            {/* Confetti / star streaks shooting outward */}
            {Array.from({ length: 14 }).map((_, i) => {
              const angle = (i / 14) * Math.PI * 2;
              const dist = 132;
              const x = Math.cos(angle) * dist;
              const y = Math.sin(angle) * dist;
              const colors = [
                "hsl(var(--primary))",
                "hsl(var(--accent))",
                "hsl(var(--edge-cyan))",
                "hsl(var(--star))",
              ];
              return (
                <motion.span
                  key={`star-${i}`}
                  aria-hidden
                  className="pointer-events-none absolute left-1/2 top-1/2 h-1 w-1 rounded-full"
                  style={{
                    background: colors[i % colors.length],
                    boxShadow: `0 0 12px ${colors[i % colors.length]}`,
                  }}
                  initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                  animate={{ x, y, opacity: 0, scale: 0.4 }}
                  transition={{ duration: 0.9, delay: 0.05, ease: "easeOut" }}
                />
              );
            })}
          </>
        )}
      </AnimatePresence>

      {/* Floating + breathing wrapper */}
      <motion.div
        animate={portal ? { scale: 1.4, opacity: 0 } : { y: [0, -6, 0] }}
        transition={
          portal
            ? { duration: 0.7, ease: [0.22, 1, 0.36, 1] }
            : { duration: 4, repeat: Infinity, ease: "easeInOut" }
        }
      >
        <motion.button
          onClick={handleClick}
          onMouseEnter={() => !portal && setOpen(true)}
          onMouseLeave={() => !portal && setOpen(false)}
          onFocus={() => !portal && setOpen(true)}
          onBlur={() => !portal && setOpen(false)}
          whileTap={{ scale: 0.94 }}
          aria-label="Open my OOTD diary"
          className="group relative inline-flex items-center justify-center rounded-xl p-1.5 outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
          style={{ perspective: 800 }}
        >
          {/* The book — ~50% of previous size */}
          <motion.span
            className="relative inline-block h-16 w-12"
            style={{ transformStyle: "preserve-3d" }}
            animate={!open ? { rotateZ: [-1.5, 1.5, -1.5] } : { rotateZ: 0 }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          >
            {/* Back cover */}
            <span className="absolute inset-0 translate-x-[3px] translate-y-[3px] rounded-r-md rounded-l-sm bg-foreground/85 shadow-[3px_3px_0_hsl(var(--foreground)/0.25)]" />

            {/* Inner pages */}
            <span className="absolute inset-[2px] left-[3px] rounded-r-md rounded-l-sm bg-gradient-to-br from-background to-foreground/[0.05] shadow-inner overflow-hidden">
              <span className="absolute left-1.5 top-2 h-px w-6 rounded-full bg-foreground/25" />
              <span className="absolute left-1.5 top-4 h-px w-7 rounded-full bg-foreground/22" />
              <span className="absolute left-1.5 top-6 h-px w-5 rounded-full bg-foreground/20" />
              <span className="absolute left-1.5 top-8 h-px w-6 rounded-full bg-foreground/18" />
              <span className="absolute left-1.5 top-[38px] h-px w-4 rounded-full bg-foreground/15" />
              <motion.span
                className="absolute bottom-1 right-1 text-[8px] leading-none text-primary/80"
                animate={{ scale: [1, 1.25, 1] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
              >
                ♡
              </motion.span>
            </span>

            {/* Cover (opens) */}
            <motion.span
              className="absolute inset-0 origin-left rounded-r-md rounded-l-sm bg-gradient-to-br from-primary via-accent to-primary shadow-[3px_3px_0_hsl(var(--foreground)/0.85)]"
              animate={{ rotateY: open ? -150 : -14 }}
              transition={{ type: "spring", stiffness: 170, damping: 18 }}
              style={{ transformStyle: "preserve-3d", backfaceVisibility: "hidden" }}
            >
              <span className="absolute left-0.5 top-1 bottom-1 w-px rounded-full bg-background/35" />

              <span className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
                <span className="font-display text-[11px] font-black italic tracking-tight text-background drop-shadow-[1px_1px_0_hsl(var(--foreground)/0.5)]">
                  #OOTD
                </span>
                <span className="text-[4px] font-bold tracking-[0.32em] text-background/75">
                  MY DIARY
                </span>
              </span>
            </motion.span>
          </motion.span>
        </motion.button>
      </motion.div>

      {/* "Tap to open" cue */}
      <motion.p
        aria-hidden
        className="mt-1 text-[8px] font-semibold uppercase tracking-[0.3em] text-foreground/55"
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
      >
        ✦ Tap to open ✦
      </motion.p>
    </div>
  );
}