/**
 * OOTDDiaryButton — playful, decorative entry point on the homepage that
 * feels like opening a personal style diary.
 *
 * Responsive design
 *   • Mobile (default): bigger book on the left, two-line headline, an
 *     extra "today's page" hint line and a soft glow halo behind the
 *     button. Cover is also slightly opened at rest so the diary metaphor
 *     reads even without hover.
 *   • Desktop (sm+): more compact pill, opens fully on hover.
 *
 * No business logic — just navigates to /ootd. All colors come from
 * design tokens (primary / accent / star / edge-cyan).
 */
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { BookHeart, Sparkles, Star, ChevronRight } from "lucide-react";
import { useState } from "react";

interface Props {
  className?: string;
}

export default function OOTDDiaryButton({ className = "" }: Props) {
  const navigate = useNavigate();
  const [hovered, setHovered] = useState(false);

  return (
    <div className={`relative flex flex-col items-center w-full ${className}`}>
      {/* Soft halo glow (mobile-emphasized) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 mx-auto h-32 max-w-[340px] rounded-[40px] bg-gradient-to-r from-primary/25 via-accent/25 to-edge-cyan/20 blur-2xl opacity-70 sm:max-w-none sm:h-24 sm:opacity-50"
      />

      {/* Floating confetti dots */}
      <div aria-hidden className="pointer-events-none absolute -inset-6">
        {[
          { x: -38, y: -16, c: "bg-primary", d: 0 },
          { x: 42, y: -22, c: "bg-accent", d: 0.4 },
          { x: -44, y: 28, c: "bg-edge-cyan", d: 0.8 },
          { x: 40, y: 32, c: "bg-[hsl(var(--star))]", d: 1.2 },
          { x: 0, y: -34, c: "bg-primary", d: 1.6 },
          { x: -18, y: 38, c: "bg-accent", d: 2.0 },
        ].map((d, i) => (
          <motion.span
            key={i}
            className={`absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full ${d.c}`}
            style={{ x: d.x, y: d.y }}
            animate={{
              y: [d.y, d.y - 6, d.y],
              opacity: [0.5, 1, 0.5],
              scale: [1, 1.4, 1],
            }}
            transition={{
              duration: 2.4,
              repeat: Infinity,
              delay: d.d,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>

      <motion.button
        onClick={() => navigate("/ootd")}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
        whileTap={{ scale: 0.96 }}
        aria-label="Open my OOTD diary"
        className="group relative flex w-full max-w-[320px] items-center gap-4 rounded-3xl border-2 border-foreground/15 bg-background/85 px-5 py-4 shadow-[0_10px_32px_-12px_hsl(var(--primary)/0.6)] backdrop-blur-md transition-colors hover:border-primary/50 hover:shadow-[0_16px_40px_-12px_hsl(var(--primary)/0.8)] sm:w-auto sm:max-w-none sm:rounded-full sm:py-3 sm:gap-3"
        style={{ perspective: 600 }}
      >
        {/* The "book" — bigger on mobile so it reads as a journal */}
        <span
          className="relative inline-block h-12 w-10 shrink-0 sm:h-9 sm:w-8"
          style={{ perspective: 240, transformStyle: "preserve-3d" }}
        >
          {/* Inner pages */}
          <span className="absolute inset-0 rounded-[4px] bg-gradient-to-br from-background to-foreground/[0.06] shadow-inner sm:rounded-[3px]">
            <span className="absolute left-1/2 top-2 h-px w-5 -translate-x-1/2 rounded-full bg-foreground/25 sm:top-1.5 sm:w-4 sm:bg-foreground/20" />
            <span className="absolute left-1/2 top-[14px] h-px w-4 -translate-x-1/2 rounded-full bg-foreground/20 sm:top-3 sm:w-3 sm:bg-foreground/15" />
            <span className="absolute left-1/2 top-[22px] h-px w-[18px] -translate-x-1/2 rounded-full bg-foreground/20 sm:top-[18px] sm:w-3.5 sm:bg-foreground/15" />
            <span className="absolute left-1/2 top-[30px] h-2 w-2 -translate-x-1/2 rounded-full bg-primary/70 sm:top-[24px] sm:h-1.5 sm:w-1.5" />
          </span>

          {/* Cover (opens). Slightly ajar at rest on mobile so the metaphor reads. */}
          <motion.span
            className="absolute inset-0 origin-left rounded-[4px] bg-gradient-to-br from-primary via-accent to-primary shadow-[2px_2px_0_hsl(var(--foreground)/0.85)] sm:rounded-[3px]"
            animate={{ rotateY: hovered ? -135 : -18 }}
            transition={{ type: "spring", stiffness: 220, damping: 18 }}
            style={{ transformStyle: "preserve-3d", backfaceVisibility: "hidden" }}
          >
            {/* Heart sticker */}
            <BookHeart className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 text-background/95 sm:h-4 sm:w-4" strokeWidth={2.4} />
            {/* Ribbon bookmark */}
            <span className="absolute -top-0.5 right-1.5 h-4 w-1.5 rounded-b-sm bg-[hsl(var(--star))] sm:right-1 sm:h-3 sm:w-1" />
            {/* Gold stamp */}
            <span className="absolute -bottom-0.5 left-0.5 rounded-sm bg-[hsl(var(--star))] px-[3px] py-[0.5px] font-display text-[7px] font-black italic leading-none text-foreground shadow-sm sm:text-[6px]">
              OOTD
            </span>
          </motion.span>

          {/* Sparkle that floats out */}
          <motion.span
            className="absolute -right-1.5 -top-1.5 text-[hsl(var(--star))]"
            animate={{
              opacity: hovered ? 1 : 0.7,
              scale: hovered ? 1.15 : 0.85,
              rotate: hovered ? 0 : -20,
            }}
            transition={{ duration: 0.4 }}
          >
            <Sparkles className="h-3.5 w-3.5 sm:h-3 sm:w-3" />
          </motion.span>
        </span>

        {/* Label */}
        <span className="flex flex-1 flex-col items-start leading-tight sm:flex-initial">
          <span className="font-display text-[10px] font-semibold uppercase tracking-[0.22em] text-primary/80">
            My Diary
          </span>
          <span className="font-display text-[17px] font-bold italic tracking-tight text-foreground sm:text-[15px]">
            Open my OOTD
          </span>
          <span className="mt-0.5 font-display text-[10.5px] italic tracking-tight text-foreground/55 sm:hidden">
            today's page is waiting ♡
          </span>
        </span>

        {/* Trailing star (desktop) / chevron (mobile) */}
        <motion.span
          animate={{ rotate: hovered ? [0, 18, -10, 0] : 0, x: hovered ? 2 : 0 }}
          transition={{ duration: 0.7, ease: "easeInOut" }}
          className="ml-1 hidden text-[hsl(var(--star))] sm:inline-block"
        >
          <Star className="h-3.5 w-3.5 fill-current" />
        </motion.span>
        <motion.span
          animate={{ x: hovered ? 4 : 0 }}
          transition={{ type: "spring", stiffness: 320, damping: 20 }}
          className="ml-auto inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-foreground text-background sm:hidden"
        >
          <ChevronRight className="h-4 w-4" />
        </motion.span>

        {/* Soft shimmer sweep */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl sm:rounded-full"
        >
          <span className="absolute -left-1/3 top-0 h-full w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-foreground/10 to-transparent transition-transform duration-700 group-hover:translate-x-[400%]" />
        </span>
      </motion.button>

      {/* Desktop-only caption (mobile shows it inside the card) */}
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6, duration: 0.6 }}
        className="mt-2 hidden font-display text-[10.5px] italic tracking-tight text-foreground/55 sm:inline"
      >
        a love letter to today's outfit ♡
      </motion.span>
    </div>
  );
}
