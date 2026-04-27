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

  // Hide top notice on mobile landing page, and always while the OOTD
  // modal is open (it owns the full viewport).
  const hideNotice = (isMobile && location.pathname === "/") || ootdModalOpen;
  // Hide bottom nav on the OOTD experience (it has its own tab bar).
  // On mobile, when the OOTD modal is open, keep the main BottomNav hidden
  // so only OOTD's own bottom tab bar shows — user must tap X to exit.
  const hideBottomNav =
    ootdModalOpen ||
    location.pathname.startsWith("/ootd");

  return (
    <>
      {!hideNotice && <DailyPicksNotice />}
      <div className={transition === "none" ? undefined : transitionClass}>
        {/* When the OOTD modal is open it owns the full viewport on desktop
            and renders the matched route's page itself (e.g. UserProfilePage).
            Hide the underlying Outlet to avoid mounting the same page twice,
            which caused crashes when navigating to /user/:id from inside the
            modal. */}
        {!ootdModalOpen && <Outlet />}
      </div>
      {!hideBottomNav && <BottomNav />}
    </>
  );
};

export default AppLayout;
