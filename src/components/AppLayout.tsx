import { Outlet, useLocation } from "react-router-dom";
import { useTransition } from "@/lib/transition";
import BottomNav from "./BottomNav";
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

  return (
    <>
      {!hideNotice && <DailyPicksNotice />}
      <div className={transition === "none" ? undefined : transitionClass}>
        <div className="pb-[calc(72px+env(safe-area-inset-bottom))] md:pb-0">
          <Outlet />
          {!hideMobileSocial && (
            <SocialLinks className="md:hidden px-5 pb-3 pt-2" iconClassName="h-[18px] w-[18px]" />
          )}
        </div>
      </div>
      <BottomNav />
    </>
  );
};

export default AppLayout;
