import { Home, Compass, Camera, Scan, User } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const tabs = [
    { path: "/", icon: Home, label: "HOME" },
    { path: "/discover", icon: Compass, label: "DISCOVER" },
    { path: "/ootd", icon: Camera, label: "OOTD" },
    { path: "/fit", icon: Scan, label: "FIT" },
    { path: "/profile", icon: User, label: "YOU" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-xl lg:hidden">
      <div className="h-px bg-border/40" />
      <div className="mx-auto flex max-w-lg items-center justify-around px-2 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:max-w-2xl md:py-4">
        {tabs.map((tab) => {
          const isActive = location.pathname === tab.path || (tab.path !== "/" && location.pathname.startsWith(tab.path));
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={`hover-burgundy relative flex flex-col items-center gap-1.5 px-5 py-1.5 md:gap-2 md:px-6 ${
                isActive ? "text-foreground" : "text-foreground/75"
              }`}
            >
              <tab.icon className="h-[18px] w-[18px] md:h-5 md:w-5" strokeWidth={isActive ? 2.2 : 1.5} />
              <span className="text-[7.5px] font-semibold tracking-[0.2em] md:text-[8.5px]">{tab.label}</span>
              {isActive && (
                <span className="absolute -top-px left-1/2 h-[2px] w-5 -translate-x-1/2 rounded-full bg-accent/60" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
