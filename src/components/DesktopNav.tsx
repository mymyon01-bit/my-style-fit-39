import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Download } from "lucide-react";
import LanguageSelector from "@/components/LanguageSelector";
import { prefetchAllTabs, prefetchRoute } from "@/lib/prefetch";

const DesktopNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useI18n();

  useEffect(() => {
    prefetchAllTabs();
  }, []);

  const navLinks = [
    { path: "/about", label: t("about").toUpperCase() },
    { path: "/discover", label: t("discover").toUpperCase() },
    { path: "/ootd", label: "OOTD" },
    { path: "/fit", label: t("fit").toUpperCase() },
    { path: "/profile", label: "PROFILE" },
  ];

  const isActive = (path: string) =>
    location.pathname === path || (path !== "/" && location.pathname.startsWith(path));

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 hidden lg:block">
      {/* Vibrant gradient hairline */}
      <div className="h-[2px] bg-gradient-animated" />

      {/* Top bar */}
      <div className="relative z-10 bg-background/90 backdrop-blur-xl border-b border-foreground/10">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-10 py-4">
          {/* Wordmark — italic display */}
          <button
            onClick={() => navigate("/")}
            aria-label="my'myon — home"
            className="group transition-opacity hover:opacity-80"
          >
            <Brandmark variant="compact" className="text-[20px]" />
          </button>

          {/* Center nav */}
          <div className="flex items-center gap-10">
            {navLinks.map((link) => {
              const active = isActive(link.path);
              return (
                <button
                  key={link.path}
                  onClick={() => navigate(link.path)}
                  onMouseEnter={() => prefetchRoute(link.path)}
                  className={`group relative font-mono text-[10px] font-semibold tracking-[0.22em] transition-colors ${
                    active ? "text-foreground" : "text-foreground/60 hover:text-foreground"
                  }`}
                >
                  {link.label}
                  <span
                    className={`absolute -bottom-1 left-0 h-[2px] bg-accent transition-all duration-300 ${
                      active ? "w-full" : "w-0 group-hover:w-full"
                    }`}
                  />
                </button>
              );
            })}
          </div>

          {/* Right cluster */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/install")}
              className={`flex items-center gap-1.5 font-mono text-[10px] font-semibold tracking-[0.22em] transition-colors ${
                isActive("/install") ? "text-accent" : "text-foreground/60 hover:text-accent"
              }`}
            >
              <Download className="h-3 w-3" />
              {t("downloadApp").toUpperCase()}
            </button>

            <div className="h-3.5 w-px bg-foreground/20" />

            {user ? (
              <button
                onClick={() => navigate("/settings")}
                className="font-mono text-[10px] font-semibold tracking-[0.22em] text-foreground/70 transition-colors hover:text-foreground"
              >
                SETTINGS
              </button>
            ) : (
              <>
                <button
                  onClick={() => navigate("/auth")}
                  className="font-mono text-[10px] font-semibold tracking-[0.22em] text-foreground/70 transition-colors hover:text-foreground"
                >
                  {t("logIn").toUpperCase()}
                </button>
                <button
                  onClick={() => navigate("/auth?mode=signup")}
                  className="border-[1.5px] border-foreground bg-foreground px-3.5 py-2 font-mono text-[10px] font-semibold tracking-[0.22em] text-background transition-all hover:bg-primary hover:text-primary-foreground hover:border-foreground"
                  style={{ borderRadius: "var(--radius)" }}
                >
                  {t("signUp").toUpperCase()}
                </button>
              </>
            )}

            <LanguageSelector />
          </div>
        </div>
      </div>
    </nav>
  );
};

export default DesktopNav;
