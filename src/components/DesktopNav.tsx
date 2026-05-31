import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Download } from "lucide-react";
import LanguageSelector from "@/components/LanguageSelector";
import { prefetchAllTabs, prefetchRoute } from "@/lib/prefetch";
import Brandmark from "@/components/Brandmark";

const DesktopNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useI18n();

  useEffect(() => {
    prefetchAllTabs();
  }, []);

  // 4-tab main navigation: DISCOVER · FEED · FIT LAB · MY
  const links = [
    { path: "/discover", label: "DISCOVER" },
    { path: "/ootd", label: "FEED" },
    { path: "/fit", label: "FIT LAB" },
    { path: "/profile", label: "MY" },
  ];

  const isActive = (path: string) =>
    location.pathname === path || (path !== "/" && location.pathname.startsWith(path));

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 hidden md:block">
      <div className="h-[2px] bg-gradient-animated" />

      <div className="relative z-10 bg-background/40 backdrop-blur-md border-b border-foreground/5">
        <div className="relative mx-auto flex h-20 max-w-7xl items-center justify-center px-10">
          {/* LEFT — Wordmark */}
          <button
            onClick={() => navigate("/")}
            aria-label="my'myon — home"
            className="group absolute left-10 top-1/2 -translate-y-1/2 transition-opacity hover:opacity-80"
          >
            <Brandmark variant="compact" size={42} />
          </button>

          {/* CENTER — 4 flat nav links */}
          <div className="flex items-center gap-9">
            {links.map((link) => {
              const active = isActive(link.path);
              return (
                <button
                  key={link.path}
                  onClick={() => navigate(link.path)}
                  onMouseEnter={() => prefetchRoute(link.path)}
                  className={`group relative font-body text-[11.5px] font-medium tracking-[0.18em] transition-colors ${
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

          {/* RIGHT — utilities */}
          <div className="absolute right-10 top-1/2 flex -translate-y-1/2 items-center gap-4">
            <button
              onClick={() => navigate("/install")}
              className={`flex items-center gap-1 font-sans text-[10px] font-medium tracking-[0.05em] capitalize transition-colors ${
                isActive("/install") ? "text-accent" : "text-foreground/60 hover:text-accent"
              }`}
            >
              <Download className="h-2.5 w-2.5" strokeWidth={1.75} />
              {t("downloadApp")}
            </button>

            <div className="h-2.5 w-px bg-foreground/15" />

            {user ? (
              <button
                onClick={() => navigate("/settings")}
                className="font-sans text-[10px] font-medium tracking-[0.05em] capitalize text-foreground/60 transition-colors hover:text-foreground"
              >
                Settings
              </button>
            ) : (
              <>
                <button
                  onClick={() => navigate("/auth")}
                  className="font-sans text-[10px] font-medium tracking-[0.05em] capitalize text-foreground/60 transition-colors hover:text-foreground"
                >
                  {t("logIn")}
                </button>
                <button
                  onClick={() => navigate("/auth?mode=signup")}
                  className="border border-foreground bg-foreground px-2.5 py-1 font-sans text-[10px] font-semibold tracking-[0.05em] capitalize text-background transition-all hover:bg-primary hover:text-primary-foreground hover:border-foreground"
                  style={{ borderRadius: "var(--radius)" }}
                >
                  {t("signUp")}
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
