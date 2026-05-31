import { Outlet, useLocation } from "react-router-dom";
import { useTransition } from "@/lib/transition";
import BottomNav from "./BottomNav";
import DailyPicksNotice from "./DailyPicksNotice";
import { useIsMobile } from "@/hooks/use-mobile";
import { useOOTDModal } from "@/lib/ootdModal";
import SocialLinks from "./SocialLinks";

const AppLayout = () => {
  const { transitionClass, transition } = useTransition();
  const location = useLocation();
  const isMobile = useIsMobile();
  const { isOpen: ootdModalOpen } = useOOTDModal();

  // Hide top notice on mobile landing page, and always while the OOTD
  // modal is open (it owns the full viewport).
  const hideNotice = (isMobile && location.pathname === "/") || ootdModalOpen;
  // Hide bottom nav on the OOTD experience (it has its own tab bar).
  // On mobile, when the OOTD modal is open, keep the main BottomNav hidden
  // so only OOTD's own bottom tab bar shows — user must tap X to exit.
  const hideBottomNav =
    ootdModalOpen ||
    location.pathname.startsWith("/ootd");
  // Home is a single-viewport hero on mobile — skip the trailing social bar
  // so there's no empty gap and no need to scroll to reach Instagram/etc.
  const hideMobileSocial = location.pathname === "/";

  return (
    <>
      {!hideNotice && <DailyPicksNotice />}
      <div className={transition === "none" ? undefined : transitionClass}>
        <div className={!hideBottomNav ? "pb-[calc(72px+env(safe-area-inset-bottom))] md:pb-0" : undefined}>
          {!ootdModalOpen && <Outlet />}
          {!hideBottomNav && !hideMobileSocial && (
            <SocialLinks className="md:hidden px-5 pb-3 pt-2" iconClassName="h-[18px] w-[18px]" />
          )}
        </div>
      </div>
      {!hideBottomNav && <BottomNav />}
    </>
  );
};

export default AppLayout;
