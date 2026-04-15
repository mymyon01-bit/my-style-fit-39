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
      <div className="mx-auto flex max-w-5xl items-center justify-between px-12 py-7">
        <button
          onClick={() => navigate("/")}
          className="font-display text-[12px] font-medium tracking-[0.4em] text-foreground/62 transition-colors hover:text-foreground/80"
        >
          WARDROBE
        </button>

        <div className="flex items-center gap-12">
          {links.map((link) => (
            <button
              key={link.path}
              onClick={() => navigate(link.path)}
              className={`text-[10px] font-medium tracking-[0.25em] transition-colors duration-300 ${
                isActive(link.path)
                  ? "text-foreground/80"
                  : "text-foreground/62 hover:text-foreground/62"
              }`}
            >
              {link.label}
            </button>
          ))}

          <div className="h-3.5 w-px bg-accent/[0.14]" />

          <button
            onClick={() => navigate(user ? "/profile" : "/auth")}
            className="text-[10px] font-medium tracking-[0.25em] text-foreground/62 transition-colors hover:text-foreground/62"
          >
            {user ? "YOU" : "SIGN IN"}
          </button>
        </div>
      </div>
    </nav>
  );
};

export default DesktopNav;
