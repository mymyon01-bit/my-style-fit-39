import { Outlet, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import DesktopSidebar from "./DesktopSidebar";
import MobileBottomNav from "./MobileBottomNav";
import UploadFAB from "@/components/UploadFAB";

/**
 * AppShell — persistent layout shell that wraps every primary page.
 *
 * Architecture:
 *  - Desktop: left sidebar + content column (md:pl-[220px])
 *  - Mobile : bottom nav, content takes full width
 *  - Outlet content fades softly between routes (no neon, no big chrome)
 *
 * The shell is mounted once by the router, so navigating between
 * Products / Fit / Feed / My never remounts the chrome.
 */
const AppShell = () => {
  const location = useLocation();

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <DesktopSidebar />
      <main className="md:pl-[220px]">
        <div className="pb-[calc(72px+env(safe-area-inset-bottom))] md:pb-12">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
      <UploadFAB />
      <MobileBottomNav />
    </div>
  );
};

export default AppShell;
