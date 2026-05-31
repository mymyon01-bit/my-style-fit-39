import { useLocation, useNavigate } from "react-router-dom";
import { useI18n } from "@/lib/i18n";
import { prefetchRoute } from "@/lib/prefetch";

/**
 * MobileBottomNav — new minimal 4-tab bar.
 * PRODUCTS · FIT · FEED · MY. No icons, no neon strip, no badges-everywhere.
 * One subtle dot under the active label, that's all.
 */
const MobileBottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useI18n();

  const tabs = [
    { path: "/discover", label: t("tabProducts") || "Products" },
    { path: "/fit", label: t("tabFit") || "Fit" },
    { path: "/feed", label: "Feed" },
    { path: "/profile", label: t("tabMy") || "My" },
  ];

  const isActive = (p: string) =>
    location.pathname === p ||
    (p === "/feed" && location.pathname.startsWith("/ootd")) ||
    (p !== "/" && location.pathname.startsWith(p));

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[110] border-t border-border/60 bg-background/95 backdrop-blur-xl md:hidden">
      <div className="flex items-stretch justify-between px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2.5">
        {tabs.map((tab) => {
          const active = isActive(tab.path);
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              onTouchStart={() => prefetchRoute(tab.path)}
              className={`relative flex flex-1 items-center justify-center py-2 text-[12px] tracking-tight transition-colors ${
                active ? "text-foreground font-medium" : "text-muted-foreground"
              }`}
            >
              {tab.label}
              {active && (
                <span className="absolute -bottom-0.5 left-1/2 h-[3px] w-[3px] -translate-x-1/2 rounded-full bg-foreground" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileBottomNav;
