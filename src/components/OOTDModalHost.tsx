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
          className="fixed inset-0 z-[100] hidden md:flex items-start justify-center overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Backdrop */}
          <motion.div
            aria-hidden
            className="absolute inset-0 bg-background/70 backdrop-blur-md"
            onClick={close}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Card pop-out */}
          <motion.div
            className="relative z-10 mt-[5vh] mb-[5vh] h-[88vh] w-[min(980px,86vw)] overflow-hidden rounded-2xl border border-foreground/15 bg-background shadow-[0_30px_80px_-20px_hsl(var(--foreground)/0.55)]"
            initial={{ opacity: 0, scale: 0.9, y: 30, rotateX: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0, rotateX: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }}
            transition={{ type: "spring", stiffness: 240, damping: 26 }}
            style={{ transformPerspective: 1200 }}
            role="dialog"
            aria-modal="true"
            aria-label="OOTD"
          >
            {/* Close button */}
            <button
              onClick={close}
              aria-label="Close OOTD"
              className="absolute right-4 top-4 z-50 flex h-9 w-9 items-center justify-center rounded-full border border-foreground/20 bg-background/95 text-foreground shadow-md backdrop-blur transition-all hover:scale-105 hover:bg-foreground hover:text-background"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Scrollable inner content */}
            <div className="h-full w-full overflow-y-auto">
              <OOTDPage />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default OOTDModalHost;
