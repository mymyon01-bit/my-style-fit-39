/**
 * WaveButton — 🌊 reaction control used in feed cards & post detail.
 * Animates a swell when waved on. Falls back to a sign-in prompt if guest.
 */
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useWave } from "@/hooks/useWave";
import { useAuth } from "@/lib/auth";
import { formatCount } from "@/lib/formatCount";
import { cn } from "@/lib/utils";

interface Props {
  postId: string;
  initialCount?: number;
  size?: "sm" | "md";
  className?: string;
}

export default function WaveButton({ postId, initialCount = 0, size = "md", className }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { count, waved, toggle } = useWave(postId, initialCount);
  const px = size === "sm" ? 16 : 18;

  return (
    <button
      type="button"
      aria-label={waved ? "Remove wave" : "Wave"}
      onClick={(e) => {
        e.stopPropagation();
        if (!user) { navigate("/auth"); return; }
        toggle();
      }}
      className={cn(
        "group relative flex items-center gap-1.5 text-[12px] transition",
        waved ? "text-accent" : "text-foreground/75 hover:text-foreground",
        className,
      )}
    >
      <span className="relative inline-flex h-5 w-5 items-center justify-center">
        <AnimatePresence>
          {waved && (
            <motion.span
              key="ring"
              initial={{ scale: 0.4, opacity: 0.7 }}
              animate={{ scale: 1.6, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.55, ease: "easeOut" }}
              className="absolute inset-0 rounded-full border border-accent"
            />
          )}
        </AnimatePresence>
        <motion.svg
          width={px} height={px} viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth={waved ? 2 : 1.7}
          strokeLinecap="round" strokeLinejoin="round"
          animate={waved ? { scale: [1, 1.25, 1] } : { scale: 1 }}
          transition={{ duration: 0.35 }}
        >
          {/* Stylized wave glyph */}
          <path d="M2 9c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2" />
          <path d="M2 14c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2" />
          <path d="M2 19c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2" />
        </motion.svg>
      </span>
      <span className="tabular-nums">{formatCount(count)}</span>
    </button>
  );
}
