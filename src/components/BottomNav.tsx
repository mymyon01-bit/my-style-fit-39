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
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-lg items-center justify-around py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {tabs.map((tab) => {
          const isActive = location.pathname === tab.path || (tab.path !== "/" && location.pathname.startsWith(tab.path));
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={`relative flex flex-col items-center gap-1 px-3 py-1 transition-all ${
                isActive ? "text-foreground" : "text-foreground/20"
              }`}
            >
              <tab.icon className="h-4 w-4" strokeWidth={isActive ? 2 : 1.5} />
              <span className="text-[8px] font-semibold tracking-[0.15em]">{tab.label}</span>
              {isActive && (
                <span className="absolute -bottom-1 h-px w-4 bg-accent" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
