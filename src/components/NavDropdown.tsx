import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth";

const routes = [
  { path: "/", label: "HOME" },
  { path: "/discover", label: "DISCOVER" },
  { path: "/fit", label: "FIT" },
  { path: "/ootd", label: "OOTD" },
  { path: "/profile", label: "PROFILE" },
];

const NavDropdown = () => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on route change
  useEffect(() => setOpen(false), [location.pathname]);

  const currentLabel = routes.find(r => r.path === location.pathname)?.label || "MENU";

  return (
    <div ref={ref} className="relative z-50">
      {/* Trigger — always visible */}
      <button
        onClick={() => setOpen(!open)}
        className="group flex items-center gap-2 text-foreground/40 transition-colors hover:text-foreground/70"
      >
        <div className="flex flex-col gap-[3px]">
          <span
            className={`block h-px w-4 bg-current transition-all duration-300 origin-center ${
              open ? "translate-y-[2px] rotate-45" : ""
            }`}
          />
          <span
            className={`block h-px w-4 bg-current transition-all duration-300 origin-center ${
              open ? "-translate-y-[2px] -rotate-45" : ""
            }`}
          />
        </div>
        <span className="text-[10px] font-semibold tracking-[0.2em]">{currentLabel}</span>
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />

            {/* Menu */}
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
              className="absolute left-0 top-full z-50 mt-4 min-w-[180px] overflow-hidden rounded-xl border border-foreground/[0.06] bg-card/95 shadow-[0_20px_60px_-15px_hsl(0_0%_0%_/_0.3)] backdrop-blur-xl"
            >
              <div className="py-2">
                {routes
                  .filter(r => r.path !== "/profile" || user)
                  .map((route, i) => {
                    const isActive = location.pathname === route.path;
                    return (
                      <motion.button
                        key={route.path}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.04, duration: 0.2 }}
                        onClick={() => navigate(route.path)}
                        className={`flex w-full items-center gap-3 px-5 py-3 text-left transition-colors ${
                          isActive
                            ? "text-foreground"
                            : "text-foreground/30 hover:text-foreground/60"
                        }`}
                      >
                        {isActive && (
                          <span className="h-px w-3 bg-accent" />
                        )}
                        <span
                          className={`text-[11px] font-semibold tracking-[0.2em] ${
                            isActive ? "ml-0" : "ml-6"
                          }`}
                        >
                          {route.label}
                        </span>
                      </motion.button>
                    );
                  })}
              </div>

              {/* Sign in for guests */}
              {!user && (
                <div className="border-t border-foreground/[0.04] px-5 py-3">
                  <button
                    onClick={() => navigate("/auth")}
                    className="text-[10px] font-medium tracking-[0.15em] text-foreground/25 transition-colors hover:text-foreground/50"
                  >
                    SIGN IN →
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NavDropdown;
