/**
 * BottomNav — mobile-only tab bar. Mirrors the desktop sidebar nav exactly
 * (same icons, same order, same labels) so the two surfaces feel like one
 * product. No OOTD modal hijack — it routes to /ootd like every other tab.
 */
import { Home as HomeIcon, Ruler, Compass, Shirt, User as UserIcon, Info } from "lucide-react";
import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { prefetchAllTabs, prefetchRoute } from "@/lib/prefetch";
import { useNotifications } from "@/hooks/useNotifications";

const TABS = [
  { path: "/", icon: HomeIcon, label: "Home" },
  { path: "/fit", icon: Ruler, label: "Fit DNA" },
  { path: "/discover", icon: Compass, label: "Discover" },
  { path: "/ootd", icon: Shirt, label: "#OOTD" },
  { path: "/profile", icon: UserIcon, label: "Profile" },
  { path: "/about", icon: Info, label: "About" },
];

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { ootdUnread } = useNotifications();

  useEffect(() => {
    prefetchAllTabs();
  }, []);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[110] md:hidden">
      <div className="h-[2px] bg-gradient-animated" />
      <div className="bg-background/95 backdrop-blur-xl border-t border-foreground/10">
        <div className="flex w-full items-stretch justify-between px-1 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          {TABS.map((tab) => {
            const isActive =
              location.pathname === tab.path ||
              (tab.path !== "/" && location.pathname.startsWith(tab.path));
            const showBadge = tab.path === "/ootd" && !isActive && ootdUnread > 0;
            const Icon = tab.icon;
            return (
              <button
                key={tab.path}
                onClick={() => navigate(tab.path)}
                onMouseEnter={() => prefetchRoute(tab.path)}
                onTouchStart={() => prefetchRoute(tab.path)}
                className={`group relative flex flex-1 flex-col items-center gap-[3px] px-0.5 py-1 transition-colors ${
                  isActive ? "text-foreground" : "text-foreground/55 hover:text-foreground"
                }`}
              >
                {isActive && (
                  <span
                    className="absolute -top-[6px] left-1/2 h-[3px] w-7 -translate-x-1/2 rounded-b bg-accent"
                  />
                )}
                <span className="relative">
                  <Icon
                    className={`h-[20px] w-[20px] transition-transform duration-200 ${
                      isActive ? "scale-110" : "group-hover:scale-110"
                    }`}
                    strokeWidth={isActive ? 2 : 1.6}
                  />
                  {showBadge && (
                    <span
                      aria-label={`${ootdUnread} new OOTD activity`}
                      className="absolute -right-1.5 -top-1 flex h-3 min-w-3 items-center justify-center rounded-full bg-destructive px-1 text-[7px] font-bold text-destructive-foreground"
                    >
                      {ootdUnread > 9 ? "9+" : ootdUnread}
                    </span>
                  )}
                </span>
                <span className="text-[9.5px] font-medium tracking-tight leading-none">
                  {tab.label}
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
