import { Compass, Scan, Bookmark, Sparkles } from "lucide-react";
import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { prefetchAllTabs, prefetchRoute } from "@/lib/prefetch";
import { useNotifications } from "@/hooks/useNotifications";
import { useI18n } from "@/lib/i18n";

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { ootdUnread } = useNotifications();
  const { t } = useI18n();

  useEffect(() => {
    prefetchAllTabs();
  }, []);

  // 4-tab main navigation: PRODUCTS · FIT · FEED · MY
  // OOTD lives inside FEED (the /ootd route) — no separate diary entry.
  const tabs = [
    { path: "/discover", icon: Compass, label: t("tabProducts") },
    { path: "/fit", icon: Scan, label: t("tabFit") },
    { path: "/ootd", icon: Sparkles, label: "FEED", showUnread: true },
    { path: "/profile", icon: Bookmark, label: t("tabMy") },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[110] md:hidden">
      <div className="h-[2px] bg-gradient-animated" />
      <div className="bg-background/95 backdrop-blur-xl border-t border-foreground/10">
        <div className="flex w-full items-center justify-between px-3 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] sm:px-6">
          {tabs.map((tab) => {
            const isActive =
              location.pathname === tab.path ||
              (tab.path !== "/" && location.pathname.startsWith(tab.path));
            const showUnread = tab.showUnread && !isActive && ootdUnread > 0;
            return (
              <button
                key={tab.path}
                onClick={() => navigate(tab.path)}
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
                  <tab.icon
                    className={`h-[22px] w-[22px] transition-transform duration-200 md:h-[17px] md:w-[17px] ${
                      isActive ? "scale-110" : "group-hover:scale-110"
                    }`}
                    strokeWidth={isActive ? 2.4 : 1.6}
                  />
                  {showUnread && (
                    <span
                      aria-label={`${ootdUnread} new activity`}
                      className="absolute -right-1.5 -top-1 flex h-3 min-w-3 items-center justify-center rounded-full bg-destructive px-1 text-[7px] font-bold text-destructive-foreground"
                    >
                      {ootdUnread > 9 ? "9+" : ootdUnread}
                    </span>
                  )}
                </span>
                <span className="font-body text-[9.5px] font-medium tracking-[0.14em] md:text-[9.5px]">
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
