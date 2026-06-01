/**
 * OOTDModalHost — OOTD universe shell.
 *
 * Design goal: the modal acts as a *persistent base layer*. OOTDPage is
 * mounted ONCE while the modal is open; when the user navigates into a
 * sub-screen inside the OOTD universe (e.g. `/user/:id`), that sub-screen
 * is rendered as an overlay on top, so OOTDPage keeps its scroll, tab,
 * and data state. Going back simply unmounts the overlay — instant.
 *
 * The modal never auto-closes on internal navigation. It only closes via:
 *   - explicit close() (X button, ESC, backdrop click)
 *   - Android hardware back at the root level
 */
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useOOTDModal } from "@/lib/ootdModal";
import OOTDPage from "@/pages/OOTDPage";
import UserProfilePage from "@/pages/UserProfilePage";

// Routes considered "inside the OOTD universe" — they render as overlays
// on top of the persistent OOTDPage instead of closing the modal.
const isOOTDSubRoute = (pathname: string) =>
  pathname.startsWith("/user/");

const OOTDModalHost = () => {
  const { isOpen, close } = useOOTDModal();
  const location = useLocation();

  // Lock body scroll while open
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  // ESC closes the whole modal
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // If a sub-route is showing, step back through it first
        if (isOOTDSubRoute(location.pathname)) window.history.back();
        else close();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, location.pathname, close]);

  // Android hardware back — step back through sub-routes, then close.
  useEffect(() => {
    if (!isOpen) return;
    const onBack = (e: Event) => {
      const detail = (e as CustomEvent<{ handled: boolean }>).detail;
      if (!detail) return;
      detail.handled = true;
      if (isOOTDSubRoute(location.pathname)) {
        window.history.back();
      } else {
        close();
      }
    };
    window.addEventListener("app:backbutton", onBack as EventListener);
    return () => window.removeEventListener("app:backbutton", onBack as EventListener);
  }, [isOpen, location.pathname, close]);

  // Resolve the current OOTD sub-route (if any).
  const subUserId = location.pathname.startsWith("/user/")
    ? decodeURIComponent(location.pathname.split("/")[2] || "")
    : null;

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
          {/* Desktop backdrop */}
          <motion.div
            aria-hidden
            className="absolute inset-0 hidden bg-background md:block"
            onClick={close}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* The persistent OOTD shell */}
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
            {/* Desktop close X */}
            <button
              onClick={close}
              aria-label="Close OOTD"
              className="hidden md:flex absolute right-2 top-2 z-[300] h-7 w-7 items-center justify-center rounded-full bg-background/85 text-foreground/70 backdrop-blur-sm border border-foreground/10 shadow-sm transition-all hover:bg-foreground hover:text-background hover:scale-105"
            >
              <X className="h-3.5 w-3.5" strokeWidth={2.4} />
            </button>

            {/* BASE LAYER — OOTDPage stays mounted for the lifetime of the modal */}
            <div className="absolute inset-0 overflow-y-auto">
              <OOTDPage />
            </div>

            {/* OVERLAY — sub-route content slides over the base layer */}
            <AnimatePresence>
              {subUserId && (
                <motion.div
                  key={subUserId}
                  className="absolute inset-0 z-20 overflow-y-auto bg-background"
                  initial={{ x: "8%", opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: "8%", opacity: 0 }}
                  transition={{ type: "spring", stiffness: 320, damping: 32 }}
                  style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
                >
                  {/* UserProfilePage renders its own visitor background when
                      the user has one set; the wrapper's bg-background acts
                      as a fallback for visitors with no theme. */}
                  <UserProfilePage userIdOverride={subUserId} />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default OOTDModalHost;
