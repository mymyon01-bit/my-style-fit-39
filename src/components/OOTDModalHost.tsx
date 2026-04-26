/**
 * OOTDModalHost — desktop-only "card pop-out" modal that mounts OOTDPage
 * inline instead of navigating to /ootd. Keeps the user's previous page
 * underneath so back-button / close returns them where they were.
 */
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect } from "react";
import { useOOTDModal } from "@/lib/ootdModal";
import OOTDPage from "@/pages/OOTDPage";

const OOTDModalHost = () => {
  const { isOpen, close } = useOOTDModal();

  // Lock body scroll while open
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  // ESC to close
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, close]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-start justify-center overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Backdrop — desktop only (mobile is full screen) */}
          <motion.div
            aria-hidden
            className="absolute inset-0 hidden bg-background/70 backdrop-blur-md md:block"
            onClick={close}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Mobile: full-screen OOTD interface that covers the main BottomNav.
              Desktop: card pop-out. */}
          <motion.div
            className="absolute inset-0 z-10 overflow-hidden bg-background
                       md:static md:inset-auto md:mt-[5vh] md:mb-[5vh] md:h-[88vh]
                       md:w-[min(980px,86vw)] md:rounded-2xl md:border md:border-foreground/15
                       md:shadow-[0_30px_80px_-20px_hsl(var(--foreground)/0.55)]"
            initial={{ opacity: 0, scale: 0.96, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 20 }}
            transition={{ type: "spring", stiffness: 240, damping: 26 }}
            style={{ transformPerspective: 1200, paddingBottom: "env(safe-area-inset-bottom)" }}
            role="dialog"
            aria-modal="true"
            aria-label="OOTD"
          >
            {/* Close button */}
            <button
              onClick={close}
              aria-label="Close OOTD"
              className="fixed right-3 z-[300] flex h-10 w-10 items-center justify-center rounded-full border border-foreground/25 bg-background/95 text-foreground shadow-lg backdrop-blur transition-all hover:scale-105 hover:bg-foreground hover:text-background md:absolute md:right-4"
              style={{ top: "max(0.75rem, env(safe-area-inset-top))" }}
            >
              <X className="h-5 w-5" />
            </button>

            {/* OOTD owns its own scroll area so its bottom menu stays fixed. */}
            <div className="h-full w-full overflow-hidden">
              <OOTDPage />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default OOTDModalHost;
