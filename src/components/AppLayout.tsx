import { Outlet } from "react-router-dom";
import { useTransition } from "@/lib/transition";
import BottomNav from "./BottomNav";
import DailyPicksNotice from "./DailyPicksNotice";

const AppLayout = () => {
  const { transitionClass, transition } = useTransition();

  return (
    <>
      <DailyPicksNotice />
      {/* No remount key — keeps page chunks warm and avoids full re-renders.
          Transition class only applies when the user opted into a non-"none" style. */}
      <div className={transition === "none" ? undefined : transitionClass}>
        <Outlet />
      </div>
      <BottomNav />
    </>
  );
};

export default AppLayout;
