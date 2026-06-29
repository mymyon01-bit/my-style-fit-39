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
import inkCorner from "@/assets/ink-corner.png";
import Brandmark from "@/components/Brandmark";
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
          className="group absolute left-0 top-0 z-20 h-[130px] w-[290px] overflow-hidden"
        >
          {/* Ink layer — breathes like sumi ink bleeding into hanji paper. */}
          <span className="pointer-events-none absolute inset-0 block">
            <img
              src={inkCorner}
              alt=""
              aria-hidden="true"
              className="ink-breathe pointer-events-none absolute -left-12 -top-14 h-[230px] w-[340px] select-none object-cover object-left-top"
              draggable={false}
            />
          </span>
          {/* Gold "my" wordmark — sits crisply on top of the ink. */}
          <span className="pointer-events-none absolute left-8 top-9 z-10 drop-shadow-[0_2px_10px_rgba(0,0,0,0.7)] transition-transform duration-500 group-hover:scale-[1.04]">
            <Brandmark variant="inline" size={46} />
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

      <div className="mx-auto w-full max-w-[1440px] lg:flex lg:items-start lg:gap-14 lg:px-10 lg:pt-4 xl:px-16">
        {/* Sidebar (lg+ only) */}
        <aside className="hidden w-[200px] shrink-0 lg:block">
          <nav className="sticky top-[96px] flex flex-col gap-1 py-2">
            {SIDEBAR_LINKS.map((l) => {
              const Icon = l.icon;
              const active = isActive(location.pathname, l.to);
              return (
                <button
                  key={l.key}
                  type="button"
                  onClick={() => navigate(l.to)}
                  className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-[14px] tracking-tight transition-colors ${
                    active
                      ? "bg-secondary/70 font-medium text-foreground"
                      : "text-foreground/70 hover:bg-secondary/50 hover:text-foreground"
                  }`}
                >
                  <Icon className="h-[18px] w-[18px]" strokeWidth={1.6} />
                  <span>{l.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        <main className="w-full lg:flex-1 lg:px-0">{children}</main>
      </div>
    </div>
  );
};

export default DesktopShell;
