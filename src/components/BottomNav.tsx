import { Home, Compass, Scan, Camera, User } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useLocation, useNavigate } from "react-router-dom";

const BottomNav = () => {
  const { t } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();

  const tabs = [
    { path: "/", icon: Home, label: t("home") },
    { path: "/discover", icon: Compass, label: t("discover") },
    { path: "/fit", icon: Scan, label: t("fit") },
    { path: "/ootd", icon: Camera, label: t("ootd") },
    { path: "/profile", icon: User, label: t("profile") },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-lg items-center justify-around py-1.5 pb-[env(safe-area-inset-bottom)]">
        {tabs.map((tab) => {
          const isActive = location.pathname === tab.path || (tab.path !== "/" && location.pathname.startsWith(tab.path));
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 transition-colors ${
                isActive ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              <tab.icon className="h-5 w-5" strokeWidth={isActive ? 2.2 : 1.5} />
              <span className="text-[9px] font-medium tracking-wide">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
