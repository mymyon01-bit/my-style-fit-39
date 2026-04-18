/**
 * FreshnessPill — soft burgundy pill that surfaces continuous-discovery
 * progress above the product grid. Rotates through three messages while
 * `active` is true, then fades out.
 *
 * Pairs with sonner toasts fired from the search pipeline when a fresh
 * batch is appended ("New arrivals just added").
 */
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles } from "lucide-react";

const MESSAGES = [
  "Fetching new items from stores…",
  "Adding fresh picks…",
  "Curating live inventory…",
];

interface FreshnessPillProps {
  active: boolean;
}

export default function FreshnessPill({ active }: FreshnessPillProps) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setI((n) => (n + 1) % MESSAGES.length), 2400);
    return () => clearInterval(t);
  }, [active]);

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.25 }}
          className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/[0.06] px-3 py-1.5 text-[10px] font-medium tracking-[0.12em] text-accent/85 shadow-sm"
        >
          <Sparkles className="h-3 w-3 animate-pulse" />
          <AnimatePresence mode="wait">
            <motion.span
              key={i}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {MESSAGES[i]}
            </motion.span>
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
