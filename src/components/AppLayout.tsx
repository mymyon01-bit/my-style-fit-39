import { Outlet } from "react-router-dom";
import BottomNav from "./BottomNav";

const AppLayout = () => (
  <>
    <Outlet />
    <BottomNav />
  </>
);

export default AppLayout;
