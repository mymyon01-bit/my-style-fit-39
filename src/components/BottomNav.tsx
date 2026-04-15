import { Home, Compass, Scan, Camera, User } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const tabs = [
    { path: "/", icon: Home, label: "HOME" },
    { path: "/discover", icon: Compass, label: "DISCOVER" },
    { path: "/fit", icon: Scan, label: "FIT" },
    { path: "/ootd", icon: Camera, label: "OOTD" },
    { path: "/profile", icon: User, label: "YOU" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-lg items-center justify-around py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))]">
        {tabs.map((tab) => {
          const isActive = location.pathname === tab.path || (tab.path !== "/" && location.pathname.startsWith(tab.path));
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={`relative flex flex-col items-center gap-1.5 px-4 py-1 transition-all duration-300 ${
                isActive ? "text-foreground/60" : "text-foreground/15"
              }`}
            >
              <tab.icon className="h-4 w-4" strokeWidth={isActive ? 1.8 : 1.2} />
              <span className="text-[7px] font-medium tracking-[0.2em]">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
