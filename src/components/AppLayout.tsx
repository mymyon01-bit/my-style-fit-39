import { Outlet, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useTransition } from "@/lib/transition";
import BottomNav from "./BottomNav";
import UploadFAB from "./UploadFAB";
import DailyPicksNotice from "./DailyPicksNotice";
import { useIsMobile } from "@/hooks/use-mobile";
import SocialLinks from "./SocialLinks";

const AppLayout = () => {
  const { transitionClass, transition } = useTransition();
  const location = useLocation();
  const isMobile = useIsMobile();

  // Hide top notice on mobile landing page.
  const hideNotice = isMobile && location.pathname === "/";
  // Home is a single-viewport hero on mobile — skip the trailing social bar.
  const hideMobileSocial = location.pathname === "/";

  // Persistent shell: header/nav/FAB never unmount. Only the Outlet content
  // fades-and-rises softly between routes for a calm, premium feel.
  return (
    <>
      {!hideNotice && <DailyPicksNotice />}
      <div className={transition === "none" ? undefined : transitionClass}>
        <div className="pb-[calc(72px+env(safe-area-inset-bottom))] md:pb-0">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
          {!hideMobileSocial && (
            <SocialLinks className="md:hidden px-5 pb-3 pt-2" iconClassName="h-[18px] w-[18px]" />
          )}
        </div>
      </div>
      <UploadFAB />
      <BottomNav />
    </>
  );
};

export default AppLayout;

