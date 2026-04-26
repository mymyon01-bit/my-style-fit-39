import { Home, Compass, Camera, Scan, User } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { prefetchAllTabs, prefetchRoute } from "@/lib/prefetch";
import { useNotifications } from "@/hooks/useNotifications";
import OOTDNavLabel from "@/components/OOTDNavLabel";
import OOTDDiaryIcon from "@/components/OOTDDiaryIcon";
import { useOOTDModal } from "@/lib/ootdModal";

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { ootdUnread } = useNotifications();
  const { open: openOotdModal } = useOOTDModal();
  const [ootdTapped, setOotdTapped] = useState(false);

  useEffect(() => {
    prefetchAllTabs();
  }, []);

  const tabs = [
    { path: "/", icon: Home, label: "HOME", isOotd: false },
    { path: "/discover", icon: Compass, label: "DISCOVER", isOotd: false },
    { path: "/ootd", icon: Camera, label: "OOTD", isOotd: true },
    { path: "/fit", icon: Scan, label: "FIT", isOotd: false },
    { path: "/profile", icon: User, label: "YOU", isOotd: false },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
      {/* Vibrant gradient hairline */}
      <div className="h-[2px] bg-gradient-animated" />
      <div className="bg-background/95 backdrop-blur-xl border-t border-foreground/10">
        <div className="flex w-full items-center justify-between px-3 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] sm:px-6">
          {tabs.map((tab) => {
            const isActive =
              location.pathname === tab.path ||
              (tab.path !== "/" && location.pathname.startsWith(tab.path));
            // Only show OOTD badge when not already on the OOTD tab.
            const showOotdBadge = tab.path === "/ootd" && !isActive && ootdUnread > 0;
            return (
              <button
                key={tab.path}
                onClick={() => {
                  if (tab.isOotd) {
                    setOotdTapped(true);
                    setTimeout(() => {
                      openOotdModal();
                      setOotdTapped(false);
                    }, 700);
                  } else {
                    navigate(tab.path);
                  }
                }}
                onMouseEnter={() => prefetchRoute(tab.path)}
                onTouchStart={() => prefetchRoute(tab.path)}
                className={`group relative flex flex-1 flex-col items-center gap-1 px-1 py-1 transition-all duration-200 md:gap-1.5 md:px-6 md:py-1 ${
                  isActive ? "text-foreground" : "text-foreground/55 hover:text-foreground"
                }`}
              >
                {isActive && (
                  <span
                    className="absolute -top-[12px] left-1/2 h-[3px] w-8 -translate-x-1/2 bg-accent"
                    style={{ borderRadius: "0 0 4px 4px" }}
                  />
                )}
                <span className="relative">
                  {tab.isOotd ? (
                    <OOTDDiaryIcon size={24} active={isActive} />
                  ) : (
                    <tab.icon
                      className={`h-[22px] w-[22px] transition-transform duration-200 md:h-[17px] md:w-[17px] ${
                        isActive ? "scale-110" : "group-hover:scale-110"
                      }`}
                      strokeWidth={isActive ? 2.4 : 1.6}
                    />
                  )}
                  {showOotdBadge && (
                    <span
                      aria-label={`${ootdUnread} new OOTD activity`}
                      className="absolute -right-1.5 -top-1 flex h-3 min-w-3 items-center justify-center rounded-full bg-destructive px-1 text-[7px] font-bold text-destructive-foreground"
                    >
                      {ootdUnread > 9 ? "9+" : ootdUnread}
                    </span>
                  )}
                </span>
                <span className="font-mono text-[8.5px] font-semibold tracking-[0.16em] md:text-[8.5px]">
                  {tab.isOotd ? (
                    <OOTDNavLabel className="text-[8.5px] md:text-[8.5px] font-semibold tracking-[0.16em]" crownSize={14} />
                  ) : (
                    tab.label
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

export default BottomNav;
