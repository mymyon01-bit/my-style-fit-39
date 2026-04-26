import { Outlet, useLocation } from "react-router-dom";
import { useTransition } from "@/lib/transition";
import BottomNav from "./BottomNav";
import DailyPicksNotice from "./DailyPicksNotice";
import { useIsMobile } from "@/hooks/use-mobile";

const AppLayout = () => {
  const { transitionClass, transition } = useTransition();
  const location = useLocation();
  const isMobile = useIsMobile();

  // Hide top notice on mobile landing page
  const hideNotice = isMobile && location.pathname === "/";
  const hideBottomNav = isMobile && location.pathname.startsWith("/ootd");

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
