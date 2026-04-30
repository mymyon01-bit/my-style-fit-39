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

      {/* Top bar — 3 columns: brand | centered nav | right utilities */}
      <div className="relative z-10 bg-background/40 backdrop-blur-md border-b border-foreground/5">
        <div className="mx-auto grid max-w-7xl grid-cols-[auto_1fr_auto] items-center gap-6 px-10 py-0">
          {/* LEFT — Wordmark */}
          <button
            onClick={() => navigate("/")}
            aria-label="my'myon — home"
            className="group justify-self-start transition-opacity hover:opacity-80"
          >
            <Brandmark variant="compact" className="!h-[88px] md:!h-24" />
          </button>

          {/* CENTER — nav links with OOTD diary in the middle */}
          <div className="flex items-center justify-center gap-7">
            {navLinks.map((link) => {
              const active = isActive(link.path);
              const insertDiaryAfter = link.path === "/discover";
              return (
                <div key={link.path} className="flex items-center gap-7">
                  <button
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
                  {insertDiaryAfter && (
                    <div className="relative flex h-16 w-16 items-center justify-center rounded-full border border-primary/30 bg-gradient-to-br from-primary/10 via-accent/10 to-transparent shadow-[0_0_20px_hsl(var(--primary)/0.18)]">
                      <div className="scale-[0.6] origin-center -m-4">
                        <OOTDDiaryButton />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* RIGHT — utilities (Download + auth/settings + language) */}
          <div className="flex items-center justify-self-end gap-5">
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
