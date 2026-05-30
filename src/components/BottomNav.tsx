import { Compass, Newspaper, Scan, User, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { prefetchAllTabs, prefetchRoute } from "@/lib/prefetch";
import { useNotifications } from "@/hooks/useNotifications";
import CreateActionSheet from "@/components/CreateActionSheet";

type Tab = {
  path: string;
  icon: typeof Compass;
  label: string;
};

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { ootdUnread } = useNotifications();
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    prefetchAllTabs();
  }, []);

  // 4 main destinations + a centered "+" action button between Feed and Fit.
  const leftTabs: Tab[] = [
    { path: "/discover", icon: Compass, label: "DISCOVER" },
    { path: "/feed", icon: Newspaper, label: "FEED" },
  ];
  const rightTabs: Tab[] = [
    { path: "/fit", icon: Scan, label: "FIT" },
    { path: "/my", icon: User, label: "MY" },
  ];

  const isActive = (path: string) => {
    if (path === "/discover") {
      return location.pathname === "/" || location.pathname.startsWith("/discover");
    }
    if (path === "/feed") {
      return location.pathname.startsWith("/feed") || location.pathname.startsWith("/ootd");
    }
    if (path === "/my") {
      return location.pathname.startsWith("/my") || location.pathname.startsWith("/profile");
    }
    return location.pathname === path || location.pathname.startsWith(path + "/");
  };

  const renderTab = (tab: Tab) => {
    const active = isActive(tab.path);
    const showBadge = tab.path === "/feed" && !active && ootdUnread > 0;
    return (
      <button
        key={tab.path}
        onClick={() => navigate(tab.path)}
        onMouseEnter={() => prefetchRoute(tab.path === "/feed" ? "/ootd" : tab.path)}
        onTouchStart={() => prefetchRoute(tab.path === "/feed" ? "/ootd" : tab.path)}
        className={`group relative flex flex-1 flex-col items-center gap-1 px-1 py-1 transition-all duration-200 ${
          active ? "text-foreground" : "text-foreground/55 hover:text-foreground"
        }`}
      >
        {active && (
          <span
            className="absolute -top-[12px] left-1/2 h-[3px] w-8 -translate-x-1/2 bg-accent"
            style={{ borderRadius: "0 0 4px 4px" }}
          />
        )}
        <span className="relative">
          <tab.icon
            className={`h-[22px] w-[22px] transition-transform duration-200 ${
              active ? "scale-110" : "group-hover:scale-110"
            }`}
            strokeWidth={active ? 2.4 : 1.6}
          />
          {showBadge && (
            <span
              aria-label={`${ootdUnread} new`}
              className="absolute -right-1.5 -top-1 flex h-3 min-w-3 items-center justify-center rounded-full bg-destructive px-1 text-[7px] font-bold text-destructive-foreground"
            >
              {ootdUnread > 9 ? "9+" : ootdUnread}
            </span>
          )}
        </span>
        <span className="font-mono text-[8.5px] font-semibold tracking-[0.16em]">{tab.label}</span>
      </button>
    );
  };

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-[110] md:hidden">
        <div className="h-[2px] bg-gradient-animated" />
        <div className="bg-background/95 backdrop-blur-xl border-t border-foreground/10">
          <div className="flex w-full items-end justify-between px-3 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] sm:px-6">
            {leftTabs.map(renderTab)}

            {/* Center "+" action */}
            <div className="flex flex-1 items-center justify-center">
              <button
                onClick={() => setCreateOpen(true)}
                aria-label="Create"
                className="-mt-6 flex h-12 w-12 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-[0_8px_24px_-6px_hsl(var(--accent)/0.55)] ring-4 ring-background transition-transform active:scale-95"
              >
                <Plus className="h-6 w-6" strokeWidth={2.4} />
              </button>
            </div>

            {rightTabs.map(renderTab)}
          </div>
        </div>
      </nav>

      <CreateActionSheet open={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  );
};

export default BottomNav;
