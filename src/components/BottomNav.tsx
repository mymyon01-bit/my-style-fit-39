/**
 * BottomNav — mobile-only tab bar. Icons picked for personality (rose-gold
 * active pill + subtle glow) so the bar reads like a curated boutique, not
 * a generic web app footer.
 */
import { House, Scan, Compass, Shirt, UserCircle2 } from "lucide-react";
import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { prefetchAllTabs, prefetchRoute } from "@/lib/prefetch";
import { useNotifications } from "@/hooks/useNotifications";

const TABS = [
  { path: "/", icon: House, label: "Home" },
  { path: "/fit", icon: Scan, label: "Fit AI" },
  { path: "/discover", icon: Compass, label: "Discover" },
  { path: "/ootd", icon: Shirt, label: "#OOTD" },
  { path: "/profile", icon: UserCircle2, label: "Profile" },
];

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { ootdUnread } = useNotifications();

  useEffect(() => {
    prefetchAllTabs();
  }, []);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden">
      <div className="h-[2px] bg-gradient-animated" />
      <div className="bg-background/95 backdrop-blur-xl border-t border-foreground/10">
        <div className="flex w-full items-stretch justify-between px-1 pt-2 pb-[max(0.6rem,env(safe-area-inset-bottom))]">
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
                className={`group relative flex flex-1 flex-col items-center gap-1 px-1 py-1 transition-colors ${
                  isActive ? "text-foreground" : "text-foreground/55 hover:text-foreground"
                }`}
              >
                {/* Active pill — rose-gold blush behind the icon */}
                <span
                  className={`relative flex h-9 w-9 items-center justify-center rounded-full transition-all duration-300 ${
                    isActive
                      ? "bg-gradient-to-br from-[hsl(20_60%_92%)] to-[hsl(15_45%_82%)] shadow-[0_4px_14px_-4px_hsl(15_60%_55%/0.55),inset_0_1px_0_hsl(0_0%_100%/0.6)] ring-1 ring-[hsl(15_45%_70%/0.4)]"
                      : "bg-transparent group-hover:bg-foreground/[0.04]"
                  }`}
                >
                  {/* Sparkle accent — only on active */}
                  {isActive && (
                    <span className="pointer-events-none absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-[hsl(15_70%_55%)] shadow-[0_0_6px_hsl(15_70%_55%/0.9)]" />
                  )}
                  <Icon
                    className={`h-[22px] w-[22px] transition-all duration-300 ${
                      isActive
                        ? "text-[hsl(15_45%_28%)] scale-105"
                        : "group-hover:scale-110"
                    }`}
                    strokeWidth={isActive ? 2.1 : 1.7}
                  />
                  {showBadge && (
                    <span
                      aria-label={`${ootdUnread} new OOTD activity`}
                      className="absolute -right-1 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-destructive px-1 text-[8px] font-bold text-destructive-foreground shadow-sm"
                    >
                      {ootdUnread > 9 ? "9+" : ootdUnread}
                    </span>
                  )}
                </span>
                <span
                  className={`text-[10.5px] leading-none tracking-tight transition-all ${
                    isActive ? "font-semibold text-foreground" : "font-medium"
                  }`}
                >
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
