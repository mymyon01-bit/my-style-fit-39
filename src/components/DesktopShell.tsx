/**
 * DesktopShell — persistent top bar + left sidebar for desktop (lg+).
 *
 * Provides the global "my" brandmark (links Home), AI search, utility
 * icons, and the side nav across every page rendered inside AppLayout.
 * Mobile layouts (<lg) bypass the chrome and render children directly.
 */
import { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Home as HomeIcon,
  Ruler,
  Compass,
  Shirt,
  User as UserIcon,
  Info,
  Heart as HeartIcon,
  ShoppingBag,
} from "lucide-react";

import MyMyonWordmark from "@/components/MyMyonWordmark";
import AISearchBar from "@/components/home/AISearchBar";
import { useAuth } from "@/lib/auth";

const SIDEBAR_LINKS = [
  { key: "home", label: "Home", icon: HomeIcon, to: "/" },
  { key: "fit", label: "Fit DNA", icon: Ruler, to: "/fit" },
  { key: "discover", label: "Discover", icon: Compass, to: "/discover" },
  { key: "ootd", label: "#OOTD", icon: Shirt, to: "/ootd" },
  { key: "profile", label: "Profile", icon: UserIcon, to: "/profile" },
  { key: "about", label: "About", icon: Info, to: "/about" },
];

const isActive = (pathname: string, to: string) => {
  if (to === "/") return pathname === "/";
  return pathname === to || pathname.startsWith(to + "/");
};

const DesktopShell = ({ children }: { children: ReactNode }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop top bar (lg+ only) */}
      <header className="sticky top-0 z-30 hidden border-b border-border/40 bg-background/85 backdrop-blur-xl lg:block">
        {/* Ink-blot corner brandmark — bleeds outward from the top-left corner
            on every desktop page. Clicking returns Home. Hidden on mobile. */}
        <button
          type="button"
          onClick={() => navigate("/")}
          aria-label="MYMYON home"
          className="group absolute left-4 top-2 z-20 flex h-[110px] w-[220px] items-center justify-center"
        >
          {/* MYMYON ink-blot logo — gold signature on organic black sumi splash. */}
          <span className="pointer-events-none relative z-10 transition-transform duration-500 group-hover:scale-[1.05]">
            <MyMyonWordmark size="md" />
          </span>
        </button>

        <div className="mx-auto flex max-w-[1440px] items-center gap-10 px-10 py-5 xl:px-16">
          <div className="w-[200px] shrink-0" aria-hidden="true" />

          <div className="max-w-2xl flex-1">
            <AISearchBar placeholder="Search for styles, products, looks…" />
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <button
              type="button"
              aria-label="Saved"
              onClick={() => navigate(user ? "/profile?tab=saved" : "/auth")}
              className="flex h-10 w-10 items-center justify-center rounded-full text-foreground/75 transition-colors hover:bg-secondary/60 hover:text-foreground"
            >
              <HeartIcon className="h-5 w-5" strokeWidth={1.5} />
            </button>
            <button
              type="button"
              aria-label="Account"
              onClick={() => navigate(user ? "/profile" : "/auth")}
              className="flex h-10 w-10 items-center justify-center rounded-full text-foreground/75 transition-colors hover:bg-secondary/60 hover:text-foreground"
            >
              <UserIcon className="h-5 w-5" strokeWidth={1.5} />
            </button>
            <button
              type="button"
              aria-label="Bag"
              onClick={() => navigate(user ? "/profile?tab=bag" : "/auth")}
              className="relative flex h-10 w-10 items-center justify-center rounded-full text-foreground/75 transition-colors hover:bg-secondary/60 hover:text-foreground"
            >
              <ShoppingBag className="h-5 w-5" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[1440px] lg:flex lg:items-start lg:gap-8 lg:px-6 lg:pt-6 xl:gap-16 xl:px-16">
        {/* Sidebar (lg+ only) — editorial rail */}
        <aside className="hidden w-[200px] shrink-0 border-r border-border/50 lg:block">
          <nav className="sticky top-[112px] flex flex-col gap-7 py-4 pr-8">
            {SIDEBAR_LINKS.map((l) => {
              const active = isActive(location.pathname, l.to);
              return (
                <button
                  key={l.key}
                  type="button"
                  onClick={() => navigate(l.to)}
                  className={`group flex items-center font-mono text-[10px] uppercase tracking-[0.2em] transition-colors ${
                    active ? "font-semibold text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span
                    className={`mr-4 h-px transition-all duration-500 ${
                      active ? "w-8 bg-foreground" : "w-4 bg-border group-hover:w-8 group-hover:bg-accent"
                    }`}
                  />
                  <span>{l.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        <main className="w-full min-w-0 lg:flex-1 lg:px-0">{children}</main>
      </div>

    </div>
  );
};

export default DesktopShell;
