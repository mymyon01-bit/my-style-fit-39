/**
 * OOTDModalHost — desktop-only "card pop-out" modal that mounts OOTDPage
 * inline instead of navigating to /ootd. Keeps the user's previous page
 * underneath so back-button / close returns them where they were.
 *
 * The modal stays open while the user navigates to OOTD-related routes
 * (other users' profiles, OOTD detail, etc.) so the entire OOTD experience
 * lives inside the modal on desktop.
 */
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useOOTDModal } from "@/lib/ootdModal";
import OOTDPage from "@/pages/OOTDPage";
import UserProfilePage from "@/pages/UserProfilePage";

// Routes that should render INSIDE the OOTD modal instead of closing it.
const isInModalRoute = (pathname: string) =>
  pathname === "/" ||
  pathname.startsWith("/ootd") ||
  pathname.startsWith("/user/");

const OOTDModalHost = () => {
  const { isOpen, close } = useOOTDModal();
  const location = useLocation();

  // Close only when the user navigates somewhere that's NOT part of the OOTD
  // experience (e.g. /settings, /discover, /fit). Tapping into another user's
  // profile keeps the modal open and shows that profile inside it.
  useEffect(() => {
    if (isOpen && !isInModalRoute(location.pathname)) {
      close();
    }
  }, [isOpen, location.pathname, close]);

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

  // Decide what to render inside the modal based on current route.
  const renderInner = () => {
    if (location.pathname.startsWith("/user/")) {
      return <UserProfilePage />;
    }
    return <OOTDPage />;
  };

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
          {/* Backdrop — opaque on desktop so the page underneath is fully
              hidden (prevents the previous "two menus stacked" look). */}
          <motion.div
            aria-hidden
            className="absolute inset-0 hidden bg-background md:block"
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
            {/* Small corner X — top-right inside the card (desktop only).
                Mobile uses OOTDPage's own header X. */}
            <button
              onClick={close}
              aria-label="Close OOTD"
              className="hidden md:flex absolute right-2 top-2 z-[300] h-7 w-7 items-center justify-center rounded-full bg-background/85 text-foreground/70 backdrop-blur-sm border border-foreground/10 shadow-sm transition-all hover:bg-foreground hover:text-background hover:scale-105"
            >
              <X className="h-3.5 w-3.5" strokeWidth={2.4} />
            </button>

            {/* OOTD owns its own scroll area so its bottom menu stays fixed. */}
            <div className="h-full w-full overflow-y-auto">
              {renderInner()}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default OOTDModalHost;

