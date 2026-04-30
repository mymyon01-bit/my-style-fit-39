import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Download } from "lucide-react";
import LanguageSelector from "@/components/LanguageSelector";
import { prefetchAllTabs, prefetchRoute } from "@/lib/prefetch";
import Brandmark from "@/components/Brandmark";
import OOTDDiaryButton from "@/components/OOTDDiaryButton";

import { useOOTDModal } from "@/lib/ootdModal";

const DesktopNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useI18n();
  const { isOpen: ootdOpen } = useOOTDModal();

  useEffect(() => {
    prefetchAllTabs();
  }, []);

  // Two link groups symmetric around the centered OOTD diary button.
  const leftLinks = [
    { path: "/about", label: t("about").toUpperCase() },
    { path: "/discover", label: t("discover").toUpperCase() },
  ];
  const rightLinks = [
    { path: "/fit", label: t("fit").toUpperCase() },
    { path: "/profile", label: "PROFILE" },
  ];

  const isActive = (path: string) => {
    return location.pathname === path || (path !== "/" && location.pathname.startsWith(path));
  };

  // When the OOTD modal is open we hide the desktop top-nav entirely so the
  // OOTD experience owns the full viewport (its own RANKING/FEED/COMMUNITY/
  // SHOWROOM/MY PAGE tab bar is the only menu visible). Without this, both
  // menus stacked on top of each other and looked broken.
  if (ootdOpen) return null;

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 hidden md:block">
      {/* Vibrant gradient hairline */}
      <div className="h-[2px] bg-gradient-animated" />

      {/* Top bar — brand absolute-left, utilities absolute-right,
          nav links + OOTD diary truly centered in the viewport so they
          align with the hero content below. */}
      <div className="relative z-10 bg-background/40 backdrop-blur-md border-b border-foreground/5">
        <div className="relative mx-auto flex h-20 max-w-7xl items-center justify-center px-10">
          {/* LEFT — Wordmark (absolute, vertically centered) */}
          <button
            onClick={() => navigate("/")}
            aria-label="my'myon — home"
            className="group absolute left-10 top-1/2 -translate-y-1/2 transition-opacity hover:opacity-80"
          >
            <Brandmark variant="compact" className="!h-16" />
          </button>

          {/* CENTER — symmetric nav: 2 links | OOTD diary | 2 links */}
          <div className="flex items-center gap-7">
            {leftLinks.map((link) => {
              const active = isActive(link.path);
              return (
                <button
                  key={link.path}
                  onClick={() => navigate(link.path)}
                  onMouseEnter={() => prefetchRoute(link.path)}
                  className={`group relative font-mono text-[11px] font-semibold tracking-[0.22em] transition-colors ${
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

            <div className="relative mx-2 flex h-14 w-14 items-center justify-center rounded-full border border-primary/30 bg-gradient-to-br from-primary/10 via-accent/10 to-transparent shadow-[0_0_20px_hsl(var(--primary)/0.18)]">
              <div className="-m-4 origin-center scale-[0.55]">
                <OOTDDiaryButton />
              </div>
            </div>

            {rightLinks.map((link) => {
              const active = isActive(link.path);
              return (
                <button
                  key={link.path}
                  onClick={() => navigate(link.path)}
                  onMouseEnter={() => prefetchRoute(link.path)}
                  className={`group relative font-mono text-[11px] font-semibold tracking-[0.22em] transition-colors ${
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

          {/* RIGHT — utilities (absolute, vertically centered) */}
          <div className="absolute right-10 top-1/2 flex -translate-y-1/2 items-center gap-5">
            <button
              onClick={() => navigate("/install")}
              className={`flex items-center gap-1.5 font-mono text-[11px] font-semibold tracking-[0.22em] transition-colors ${
                isActive("/install") ? "text-accent" : "text-foreground/70 hover:text-accent"
              }`}
            >
              <Download className="h-3 w-3" strokeWidth={1.75} />
              {t("downloadApp").toUpperCase()}
            </button>

            <div className="h-3 w-px bg-foreground/20" />

            {user ? (
              <button
                onClick={() => navigate("/settings")}
                className="font-mono text-[11px] font-semibold tracking-[0.22em] text-foreground/70 transition-colors hover:text-foreground"
              >
                SETTINGS
              </button>
            ) : (
              <>
                <button
                  onClick={() => navigate("/auth")}
                  className="font-mono text-[11px] font-semibold tracking-[0.22em] text-foreground/70 transition-colors hover:text-foreground"
                >
                  {t("logIn").toUpperCase()}
                </button>
                <button
                  onClick={() => navigate("/auth?mode=signup")}
                  className="border-[1.5px] border-foreground bg-foreground px-3 py-1.5 font-mono text-[11px] font-semibold tracking-[0.22em] text-background transition-all hover:bg-primary hover:text-primary-foreground hover:border-foreground"
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
