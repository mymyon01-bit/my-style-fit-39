import { Outlet } from "react-router-dom";
import BottomNav from "./BottomNav";
import DesktopNav from "./DesktopNav";

const AppLayout = () => (
  <>
    <DesktopNav />
    <Outlet />
    <BottomNav />
  </>
);

export default AppLayout;
