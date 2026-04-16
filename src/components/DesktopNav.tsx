import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";

const DesktopNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const links = [
    { path: "/discover", label: "DISCOVER" },
    { path: "/ootd", label: "OOTD" },
    { path: "/fit", label: "FIT" },
  ];

  const isActive = (path: string) =>
    location.pathname === path || (path !== "/" && location.pathname.startsWith(path));

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 hidden lg:block bg-background/95 backdrop-blur-xl">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-12 py-7">
        <button
          onClick={() => navigate("/")}
          className="hover-burgundy font-display text-[12px] font-semibold tracking-[0.4em] text-foreground/70"
        >
          WARDROBE
        </button>

        <div className="flex items-center gap-12">
          {links.map((link) => (
            <button
              key={link.path}
              onClick={() => navigate(link.path)}
              className={`hover-burgundy text-[10px] font-semibold tracking-[0.25em] ${
                isActive(link.path)
                  ? "text-foreground"
                  : "text-foreground/50"
              }`}
            >
              {link.label}
            </button>
          ))}

          <div className="h-3.5 w-px bg-border/40" />

          <button
            onClick={() => navigate(user ? "/profile" : "/auth")}
            className="hover-burgundy text-[10px] font-semibold tracking-[0.25em] text-foreground/50"
          >
            {user ? "YOU" : "SIGN IN"}
          </button>
        </div>
      </div>
    </nav>
  );
};

export default DesktopNav;
