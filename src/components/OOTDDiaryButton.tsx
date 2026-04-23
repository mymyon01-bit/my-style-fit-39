/**
 * OOTDDiaryButton — playful, decorative entry point on the homepage that
 * feels like opening a personal style diary.
 *
 * Visual idea
 *   • A small "book" sitting at rest. The cover has a heart sticker, a
 *     gold stamp ("OOTD") and a ribbon bookmark.
 *   • On hover/tap the cover swings open ~140°, revealing two soft inner
 *     pages with handwritten-style script and tiny floating sparkles.
 *   • Surrounded by orbiting confetti dots so it reads as celebratory.
 *
 * No business logic — just navigates to /ootd. All colors come from
 * design tokens (primary / accent / star / edge-cyan).
 */
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { BookHeart, Sparkles, Star } from "lucide-react";
import { useState } from "react";

interface Props {
  className?: string;
}

export default function OOTDDiaryButton({ className = "" }: Props) {
  const navigate = useNavigate();
  const [hovered, setHovered] = useState(false);

  return (
    <div className={`relative flex flex-col items-center ${className}`}>
      {/* Floating confetti dots */}
      <div aria-hidden className="pointer-events-none absolute -inset-6">
        {[
          { x: -28, y: -10, c: "bg-primary", d: 0 },
          { x: 32, y: -18, c: "bg-accent", d: 0.4 },
          { x: -34, y: 26, c: "bg-edge-cyan", d: 0.8 },
          { x: 30, y: 30, c: "bg-[hsl(var(--star))]", d: 1.2 },
          { x: 0, y: -28, c: "bg-primary", d: 1.6 },
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
        whileTap={{ scale: 0.94 }}
        aria-label="Open my OOTD diary"
        className="group relative flex items-center gap-3 rounded-full border-2 border-foreground/15 bg-background/85 px-5 py-3 shadow-[0_8px_28px_-12px_hsl(var(--primary)/0.55)] backdrop-blur-md transition-colors hover:border-primary/50 hover:shadow-[0_12px_36px_-12px_hsl(var(--primary)/0.7)]"
        style={{ perspective: 600 }}
      >
        {/* The "book" — 32x36 with cover that swings open on hover */}
        <span
          className="relative inline-block h-9 w-8"
          style={{ perspective: 220, transformStyle: "preserve-3d" }}
        >
          {/* Inner pages */}
          <span className="absolute inset-0 rounded-[3px] bg-gradient-to-br from-background to-foreground/[0.04] shadow-inner">
            <span className="absolute left-1/2 top-1.5 h-px w-4 -translate-x-1/2 rounded-full bg-foreground/20" />
            <span className="absolute left-1/2 top-3 h-px w-3 -translate-x-1/2 rounded-full bg-foreground/15" />
            <span className="absolute left-1/2 top-[18px] h-px w-3.5 -translate-x-1/2 rounded-full bg-foreground/15" />
            <span className="absolute left-1/2 top-[24px] h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-primary/70" />
          </span>

          {/* Cover (opens) */}
          <motion.span
            className="absolute inset-0 origin-left rounded-[3px] bg-gradient-to-br from-primary via-accent to-primary shadow-[2px_2px_0_hsl(var(--foreground)/0.85)]"
            animate={{ rotateY: hovered ? -135 : 0 }}
            transition={{ type: "spring", stiffness: 220, damping: 18 }}
            style={{ transformStyle: "preserve-3d", backfaceVisibility: "hidden" }}
          >
            {/* Heart sticker */}
            <BookHeart className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 text-background/95" strokeWidth={2.4} />
            {/* Ribbon bookmark */}
            <span className="absolute -top-0.5 right-1 h-3 w-1 rounded-b-sm bg-[hsl(var(--star))]" />
            {/* Gold stamp */}
            <span className="absolute -bottom-0.5 left-0.5 rounded-sm bg-[hsl(var(--star))] px-[3px] py-[0.5px] font-display text-[6px] font-black italic leading-none text-foreground shadow-sm">
              OOTD
            </span>
          </motion.span>

          {/* Sparkle that pops out when opened */}
          <motion.span
            className="absolute -right-1 -top-1 text-[hsl(var(--star))]"
            animate={{
              opacity: hovered ? 1 : 0,
              scale: hovered ? 1 : 0.4,
              rotate: hovered ? 0 : -45,
            }}
            transition={{ duration: 0.35, delay: hovered ? 0.18 : 0 }}
          >
            <Sparkles className="h-3 w-3" />
          </motion.span>
        </span>

        {/* Label */}
        <span className="flex flex-col items-start leading-tight">
          <span className="font-display text-[10px] font-semibold uppercase tracking-[0.22em] text-primary/80">
            My Diary
          </span>
          <span className="font-display text-[15px] font-bold italic tracking-tight text-foreground">
            Open my OOTD
          </span>
        </span>

        {/* Trailing star */}
        <motion.span
          animate={{ rotate: hovered ? [0, 18, -10, 0] : 0 }}
          transition={{ duration: 0.7, ease: "easeInOut" }}
          className="ml-1 text-[hsl(var(--star))]"
        >
          <Star className="h-3.5 w-3.5 fill-current" />
        </motion.span>

        {/* Soft shimmer sweep on hover */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-full"
        >
          <span className="absolute -left-1/3 top-0 h-full w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-foreground/10 to-transparent transition-transform duration-700 group-hover:translate-x-[400%]" />
        </span>
      </motion.button>

      {/* Tiny caption */}
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6, duration: 0.6 }}
        className="mt-2 font-display text-[10.5px] italic tracking-tight text-foreground/55"
      >
        a love letter to today's outfit ♡
      </motion.span>
    </div>
  );
}
