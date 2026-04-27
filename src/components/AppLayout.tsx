import { Outlet, useLocation } from "react-router-dom";
import { useTransition } from "@/lib/transition";
import BottomNav from "./BottomNav";
import DailyPicksNotice from "./DailyPicksNotice";
import { useIsMobile } from "@/hooks/use-mobile";
import { useOOTDModal } from "@/lib/ootdModal";

const AppLayout = () => {
  const { transitionClass, transition } = useTransition();
  const location = useLocation();
  const isMobile = useIsMobile();
  const { isOpen: ootdModalOpen } = useOOTDModal();

  // Hide top notice on mobile landing page
  const hideNotice = isMobile && location.pathname === "/";
  // Hide bottom nav on the OOTD experience (it has its own tab bar):
  //   - mobile: full-screen /ootd route
  //   - desktop: when the OOTD modal is open OR user is on /ootd directly
  const hideBottomNav =
    (isMobile && location.pathname.startsWith("/ootd")) ||
    (!isMobile && (ootdModalOpen || location.pathname.startsWith("/ootd")));

  return (
    <>
      {!hideNotice && <DailyPicksNotice />}
      <div className={transition === "none" ? undefined : transitionClass}>
        <Outlet />
      </div>
      {!hideBottomNav && <BottomNav />}
    </>
  );
};

export default AppLayout;
