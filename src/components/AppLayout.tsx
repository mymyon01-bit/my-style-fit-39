import { Outlet, useLocation } from "react-router-dom";
import { useTransition } from "@/lib/transition";
import BottomNav from "./BottomNav";
import DesktopNav from "./DesktopNav";

const AppLayout = () => {
  const { transitionClass } = useTransition();
  const location = useLocation();

  return (
    <>
      <DesktopNav />
      <div key={location.pathname} className={transitionClass}>
        <Outlet />
      </div>
      <BottomNav />
    </>
  );
};

export default AppLayout;
