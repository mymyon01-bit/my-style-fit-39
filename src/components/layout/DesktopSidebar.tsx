import { useLocation, useNavigate } from "react-router-dom";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { prefetchRoute } from "@/lib/prefetch";
import Brandmark from "@/components/Brandmark";
import LanguageSelector from "@/components/LanguageSelector";
import { Download } from "lucide-react";

/**
 * DesktopSidebar — quiet editorial left rail (>= md).
 * Replaces the old top DesktopNav.
 *  - Wordmark at top
 *  - 4 vertical nav items (Products / Fit / Feed / My)
 *  - utilities (download, auth, language) at the bottom
 */
const DesktopSidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useI18n();

  const links = [
    { path: "/discover", label: "Products" },
    { path: "/fit", label: "Fit" },
    { path: "/feed", label: "Feed" },
    { path: "/profile", label: "My" },
  ];

  const isActive = (p: string) =>
    location.pathname === p ||
    (p === "/feed" && location.pathname.startsWith("/ootd")) ||
    (p !== "/" && location.pathname.startsWith(p));

  return (
    <aside className="fixed left-0 top-0 z-40 hidden h-dvh w-[220px] flex-col border-r border-border/60 bg-background/80 backdrop-blur-xl px-7 py-8 md:flex">
      <button
        onClick={() => navigate("/")}
        aria-label="mymyon — home"
        className="self-start transition-opacity hover:opacity-80"
      >
        <Brandmark variant="compact" size={36} />
      </button>

      <nav className="mt-12 flex flex-col gap-1">
        {links.map((l) => {
          const active = isActive(l.path);
          return (
            <button
              key={l.path}
              onClick={() => navigate(l.path)}
              onMouseEnter={() => prefetchRoute(l.path)}
              className={`group flex items-center gap-3 rounded-md py-2 pl-2 pr-3 text-left text-[14px] tracking-tight transition-colors ${
                active
                  ? "text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span
                className={`h-[14px] w-[2px] rounded-full transition-colors ${
                  active ? "bg-accent" : "bg-transparent group-hover:bg-border"
                }`}
              />
              {l.label}
            </button>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-3 pt-8">
        <button
          onClick={() => navigate("/install")}
          className="flex items-center gap-2 text-[12px] text-muted-foreground hover:text-foreground"
        >
          <Download className="h-3 w-3" strokeWidth={1.75} />
          {t("downloadApp") || "Download app"}
        </button>
        {!user && (
          <div className="flex flex-col gap-2">
            <button
              onClick={() => navigate("/auth")}
              className="text-left text-[12px] text-muted-foreground hover:text-foreground"
            >
              {t("logIn") || "Log in"}
            </button>
            <button
              onClick={() => navigate("/auth?mode=signup")}
              className="rounded-md bg-foreground px-3 py-1.5 text-[12px] font-medium text-background hover:bg-foreground/90"
            >
              {t("signUp") || "Sign up"}
            </button>
          </div>
        )}
        <div className="pt-1">
          <LanguageSelector />
        </div>
      </div>
    </aside>
  );
};

export default DesktopSidebar;
