import { useEffect, useState } from "react";
import { motion } from "framer-motion";

const TICKER = ["mood", "weather", "moment", "story", "mood"];

/**
 * SplashScreen — matches the landing page aesthetic.
 * Vibrant blobs, oversized italic display headline with rotating word,
 * rounded pill tag underneath. Clean and quick (~1.6s).
 */
const SplashScreen = ({ onComplete }: { onComplete: () => void }) => {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem("wardrobe-splash")) {
      onComplete();
      return;
    }
    const tExit = setTimeout(() => setExiting(true), 1400);
    const tDone = setTimeout(() => {
      sessionStorage.setItem("wardrobe-splash", "1");
      onComplete();
    }, 1900);
    return () => {
      clearTimeout(tExit);
      clearTimeout(tDone);
    };
  }, [onComplete]);

  return (
    <motion.div
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden bg-background"
      initial={{ opacity: 1 }}
      animate={{ opacity: exiting ? 0 : 1 }}
      transition={{ duration: 0.5, ease: "easeInOut" }}
    >
      {/* Animated color blobs */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="blob bg-primary -top-32 -left-20 h-[420px] w-[420px]" style={{ animationDelay: "0s" }} />
        <div className="blob bg-accent -bottom-40 -right-24 h-[480px] w-[480px]" style={{ animationDelay: "-6s" }} />
      </div>

      {/* Center stack */}
      <div className="relative z-10 flex flex-col items-center px-6">
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="text-center font-display text-[44px] font-medium italic leading-[0.92] tracking-[-0.05em] text-foreground sm:text-[58px]"
        >
          <span className="block">wear your</span>
          <span
            className="relative inline-block h-[1em] overflow-hidden align-bottom"
            style={{ width: "4.2ch" }}
            aria-label="mood"
          >
            <span className="ticker-track text-gradient">
              {TICKER.map((w, i) => (
                <span key={i} className="block leading-[1em]">
                  {w}
                </span>
              ))}
            </span>
          </span>
        </motion.h1>

        {/* Brandmark wordmark */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-8"
        >
          <Brandmark variant="compact" className="text-[22px]" />
        </motion.div>
      </div>
    </motion.div>
  );
};

export default SplashScreen;
