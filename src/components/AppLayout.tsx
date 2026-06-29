import { Outlet, useLocation } from "react-router-dom";
import { useTransition } from "@/lib/transition";
import BottomNav from "./BottomNav";
import DailyPicksNotice from "./DailyPicksNotice";
import DesktopShell from "./DesktopShell";
import { useIsMobile } from "@/hooks/use-mobile";
import { useOOTDModal } from "@/lib/ootdModal";
import SocialLinks from "./SocialLinks";

const AppLayout = () => {
  const { transitionClass, transition } = useTransition();
  const location = useLocation();
  const isMobile = useIsMobile();
  const { isOpen: ootdModalOpen } = useOOTDModal();

  const hideNotice = (isMobile && location.pathname === "/") || ootdModalOpen;
  const hideBottomNav =
    ootdModalOpen ||
    location.pathname.startsWith("/ootd");
  const hideMobileSocial = location.pathname === "/";

  return (
    <>
      {!hideNotice && <DailyPicksNotice />}
      <div className={transition === "none" ? undefined : transitionClass}>
        <div className={!hideBottomNav ? "pb-[calc(72px+env(safe-area-inset-bottom))] md:pb-0" : undefined}>
          {!ootdModalOpen && (
            <DesktopShell>
              <Outlet />
            </DesktopShell>
          )}
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

