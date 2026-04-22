import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const SplashScreen = ({ onComplete }: { onComplete: () => void }) => {
  const [phase, setPhase] = useState<"idle" | "open" | "reveal" | "done">("idle");

  useEffect(() => {
    // Skip on slow devices or if already seen this session
    if (sessionStorage.getItem("wardrobe-splash")) {
      onComplete();
      return;
    }

    const t1 = setTimeout(() => setPhase("open"), 300);
    const t2 = setTimeout(() => setPhase("reveal"), 1000);
    const t3 = setTimeout(() => {
      setPhase("done");
      sessionStorage.setItem("wardrobe-splash", "1");
    }, 1600);
    const t4 = setTimeout(onComplete, 2000);

    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, [onComplete]);

  if (phase === "done") {
    return (
      <motion.div
        className="fixed inset-0 z-[9999] bg-background"
        initial={{ opacity: 1 }}
        animate={{ opacity: 0 }}
        transition={{ duration: 0.4, ease: "easeInOut" }}
      />
    );
  }

  const doorOpen = phase === "open" || phase === "reveal";
  const lightReveal = phase === "reveal";

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden bg-[hsl(20,10%,4%)]">
      {/* Ambient glow from inside */}
      <motion.div
        className="absolute inset-0 flex items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: lightReveal ? 1 : 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <div
          className="h-[60vh] w-[40vw] rounded-full blur-[80px]"
          style={{
            background: "radial-gradient(ellipse, hsl(252 30% 30% / 0.3), hsl(20 10% 8% / 0) 70%)",
          }}
        />
      </motion.div>

      {/* Wardrobe frame */}
      <div className="relative flex h-[45vh] w-[50vw] max-w-[220px] items-center justify-center lg:max-w-[280px]">
        {/* Left door */}
        <motion.div
          className="absolute left-0 top-0 h-full w-1/2 origin-left border-r border-foreground/[0.06]"
          style={{ backgroundColor: "hsl(20 10% 6%)" }}
          initial={{ rotateY: 0 }}
          animate={{ rotateY: doorOpen ? -65 : 0 }}
          transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          {/* Handle */}
          <div className="absolute right-3 top-1/2 h-6 w-px -translate-y-1/2 bg-foreground/[0.08]" />
        </motion.div>

        {/* Right door */}
        <motion.div
          className="absolute right-0 top-0 h-full w-1/2 origin-right border-l border-foreground/[0.06]"
          style={{ backgroundColor: "hsl(20 10% 6%)" }}
          initial={{ rotateY: 0 }}
          animate={{ rotateY: doorOpen ? 65 : 0 }}
          transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          {/* Handle */}
          <div className="absolute left-3 top-1/2 h-6 w-px -translate-y-1/2 bg-foreground/[0.08]" />
        </motion.div>

        {/* Inner glow (burgundy-tinted light) */}
        <motion.div
          className="absolute inset-0 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: lightReveal ? 1 : 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <div
            className="h-full w-full rounded-sm"
            style={{
              background: "radial-gradient(ellipse at center 40%, hsl(252 25% 25% / 0.15), transparent 60%)",
            }}
          />
        </motion.div>

        {/* Logo inside */}
        <motion.span
          className="relative z-10 flex items-baseline font-display text-[18px] font-light leading-none text-foreground/75"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{
            opacity: lightReveal ? 0.85 : phase === "idle" ? 0.2 : 0.4,
            scale: lightReveal ? 1 : 0.97,
          }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <span className="tracking-[0.05em]">my</span>
          <span aria-hidden className="mx-[0.18em] inline-block h-[3px] w-[3px] translate-y-[-0.55em] rounded-full bg-accent/80" />
          <span className="tracking-[0.05em]">myon</span>
        </motion.span>
      </div>

      {/* Forward motion overlay */}
      <motion.div
        className="absolute inset-0 bg-background"
        initial={{ opacity: 0, scale: 1.1 }}
        animate={{
          opacity: lightReveal ? 0.7 : 0,
          scale: lightReveal ? 1 : 1.1,
        }}
        transition={{ duration: 0.5, delay: 0.3, ease: "easeIn" }}
      />
    </div>
  );
};

export default SplashScreen;
