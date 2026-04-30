import { Navigate, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAdmin } from "@/hooks/useAdmin";
import { useAuth } from "@/lib/auth";
import { Loader2, Users, Package, FolderTree, Camera, Star, BarChart3, Settings, Home, Activity, ShieldCheck, FileSearch, Ruler, Tag, Database, MessageSquare, ToggleLeft, Cog, Download } from "lucide-react";

const NAV_ITEMS = [
  { path: "/admin", icon: BarChart3, label: "Overview", exact: true },
  { path: "/admin/diagnostics", icon: Activity, label: "Diagnostics" },
  { path: "/admin/users", icon: Users, label: "Users" },
  { path: "/admin/admins", icon: ShieldCheck, label: "Admins" },
  { path: "/admin/audit", icon: FileSearch, label: "Audit Log" },
  { path: "/admin/products", icon: Package, label: "Products" },
  { path: "/admin/categories", icon: FolderTree, label: "Categories" },
  { path: "/admin/ootd", icon: Camera, label: "OOTD" },
  { path: "/admin/content", icon: Star, label: "Content" },
  { path: "/admin/brand-calibration", icon: Tag, label: "Brand Calibration" },
  { path: "/admin/fit-rules", icon: Ruler, label: "Fit Rules" },
  { path: "/admin/fallback-tables", icon: Database, label: "Fallback Tables" },
  { path: "/admin/fit-feedback", icon: MessageSquare, label: "Fit Feedback" },
  { path: "/admin/feature-flags", icon: ToggleLeft, label: "Feature Flags" },
  { path: "/admin/app-config", icon: Cog, label: "App Config" },
  { path: "/admin/settings", icon: Settings, label: "Settings" },
];

const AdminLayout = () => {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: roleLoading } = useAdmin();
  const navigate = useNavigate();
  const location = useLocation();

  if (authLoading || roleLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-accent" />
      </div>
    );
  }

  if (!user || !isAdmin) return <Navigate to="/" replace />;

  const isActive = (path: string, exact?: boolean) =>
    exact ? location.pathname === path : location.pathname.startsWith(path);

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="hidden md:flex w-56 flex-col border-r border-border/30 bg-card/30 p-4">
        <button onClick={() => navigate("/")} className="mb-8 flex items-center gap-2 px-3 py-2 text-foreground/75 hover:text-foreground/80 transition-colors">
          <Home className="h-4 w-4" />
          <span className="flex items-baseline font-display text-[13px] font-light leading-none">
            <span className="tracking-[0.05em]">my</span>
            <span aria-hidden className="mx-[0.16em] inline-block h-[2px] w-[2px] translate-y-[-0.5em] rounded-full bg-accent/70" />
            <span className="tracking-[0.05em]">myon</span>
          </span>
        </button>
        <p className="px-3 mb-4 text-[11px] font-semibold tracking-[0.2em] text-accent/60 uppercase">Admin</p>
        <nav className="space-y-0.5">
          {NAV_ITEMS.map(item => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[12px] transition-colors ${
                isActive(item.path, item.exact)
                  ? "bg-accent/10 text-foreground/90 font-medium"
                  : "text-foreground/70 hover:text-foreground/70 hover:bg-foreground/[0.03]"
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Mobile header */}
      <div className="flex flex-1 flex-col">
        <header className="flex items-center gap-4 border-b border-border/30 px-4 py-3 md:px-6">
          <button onClick={() => navigate("/")} className="text-[10px] tracking-[0.15em] text-foreground/70 hover:text-foreground/70 md:hidden">
            ← BACK
          </button>
          <span className="text-[10px] tracking-[0.2em] font-medium text-foreground/75">ADMIN PANEL</span>
        </header>

        {/* Mobile nav */}
        <div className="flex overflow-x-auto border-b border-border/20 px-4 md:hidden">
          {NAV_ITEMS.map(item => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`shrink-0 px-3 py-3 text-[10px] tracking-[0.1em] transition-colors ${
                isActive(item.path, item.exact)
                  ? "text-foreground/80 border-b-2 border-accent/40"
                  : "text-foreground/75"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <main className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
