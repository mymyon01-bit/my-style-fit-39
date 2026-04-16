import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Download } from "lucide-react";
import LanguageSelector from "@/components/LanguageSelector";

const DesktopNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useI18n();

  const navLinks = [
    { path: "/about", label: t("about").toUpperCase() },
    { path: "/discover", label: t("discover").toUpperCase() },
    { path: "/ootd", label: "OOTD" },
    { path: "/fit", label: t("fit").toUpperCase() },
    { path: "/profile", label: "MY PROFILE" },
  ];

  const isActive = (path: string) =>
    location.pathname === path || (path !== "/" && location.pathname.startsWith(path));

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 hidden lg:block">
      {/* Top bar */}
      <div className="bg-background/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-12 py-5">
          <button
            onClick={() => navigate("/")}
            className="hover-burgundy font-display text-[12px] font-semibold tracking-[0.4em] text-foreground/70"
          >
            WARDROBE
          </button>

          <div className="flex items-center gap-6">
            <button
              onClick={() => navigate("/install")}
              className={`hover-burgundy flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.25em] ${
                isActive("/install") ? "text-foreground" : "text-foreground/70"
              }`}
            >
              <Download className="h-3 w-3" />
              {t("downloadApp").toUpperCase()}
            </button>

            <div className="h-3.5 w-px bg-border/40" />

            {user ? (
              <button
                onClick={() => navigate("/settings")}
                className="hover-burgundy text-[10px] font-semibold tracking-[0.25em] text-foreground/70"
              >
                SETTINGS
              </button>
            ) : (
              <>
                <button
                  onClick={() => navigate("/auth")}
                  className="hover-burgundy text-[10px] font-semibold tracking-[0.25em] text-foreground/70"
                >
                  {t("logIn").toUpperCase()}
                </button>
                <button
                  onClick={() => navigate("/auth?mode=signup")}
                  className="hover-burgundy rounded-md border border-accent/25 px-3.5 py-1.5 text-[10px] font-semibold tracking-[0.25em] text-accent/70 transition-colors hover:bg-accent/[0.06] hover:text-accent"
                >
                  {t("signUp").toUpperCase()}
                </button>
              </>
            )}

            <LanguageSelector />
          </div>
        </div>
      </div>

      {/* Sub-nav — semi-transparent layer */}
      <div className="bg-background/40 backdrop-blur-md border-t border-border/10">
        <div className="mx-auto flex max-w-5xl items-center justify-center gap-16 px-12 py-3">
          {navLinks.map((link) => (
            <button
              key={link.path}
              onClick={() => navigate(link.path)}
              className={`hover-burgundy text-[10px] font-semibold tracking-[0.3em] transition-colors ${
                isActive(link.path)
                  ? "text-foreground/90"
                  : "text-foreground/75 hover:text-foreground/75"
              }`}
            >
              {link.label}
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
};

export default DesktopNav;
