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
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-xl lg:hidden">
      <div className="h-px bg-accent/[0.12]" />
      <div className="mx-auto flex max-w-lg items-center justify-around py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:max-w-2xl md:py-4">
        {tabs.map((tab) => {
          const isActive = location.pathname === tab.path || (tab.path !== "/" && location.pathname.startsWith(tab.path));
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={`relative flex flex-col items-center gap-1.5 px-5 py-1.5 transition-all duration-300 md:gap-2 md:px-6 ${
                isActive ? "text-foreground/90" : "text-foreground/40"
              }`}
            >
              <tab.icon className="h-[18px] w-[18px] md:h-5 md:w-5" strokeWidth={isActive ? 2 : 1.4} />
              <span className="text-[7px] font-semibold tracking-[0.2em] md:text-[8px]">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
