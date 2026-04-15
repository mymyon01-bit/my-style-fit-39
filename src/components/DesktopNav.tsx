import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";

const DesktopNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const links = [
    { path: "/discover", label: "DISCOVER" },
    { path: "/fit", label: "FIT" },
    { path: "/ootd", label: "OOTD" },
  ];

  const isActive = (path: string) =>
    location.pathname === path || (path !== "/" && location.pathname.startsWith(path));

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 hidden lg:block">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-12 py-6">
        <button
          onClick={() => navigate("/")}
          className="font-display text-[11px] font-medium tracking-[0.4em] text-foreground/40 transition-colors hover:text-foreground/60"
        >
          WARDROBE
        </button>

        <div className="flex items-center gap-10">
          {links.map((link) => (
            <button
              key={link.path}
              onClick={() => navigate(link.path)}
              className={`text-[9px] font-medium tracking-[0.25em] transition-colors duration-300 ${
                isActive(link.path)
                  ? "text-foreground/60"
                  : "text-foreground/20 hover:text-foreground/40"
              }`}
            >
              {link.label}
            </button>
          ))}

          <div className="h-3 w-px bg-foreground/[0.06]" />

          <button
            onClick={() => navigate(user ? "/profile" : "/auth")}
            className="text-[9px] font-medium tracking-[0.25em] text-foreground/20 transition-colors hover:text-foreground/40"
          >
            {user ? "YOU" : "SIGN IN"}
          </button>
        </div>
      </div>
    </nav>
  );
};

export default DesktopNav;
