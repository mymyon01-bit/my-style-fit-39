import { Navigate, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAdmin } from "@/hooks/useAdmin";
import { useAuth } from "@/lib/auth";
import { Loader2, Users, Package, FolderTree, Camera, Star, BarChart3, Settings, Home } from "lucide-react";

const NAV_ITEMS = [
  { path: "/admin", icon: BarChart3, label: "Overview", exact: true },
  { path: "/admin/users", icon: Users, label: "Users" },
  { path: "/admin/products", icon: Package, label: "Products" },
  { path: "/admin/categories", icon: FolderTree, label: "Categories" },
  { path: "/admin/ootd", icon: Camera, label: "OOTD" },
  { path: "/admin/content", icon: Star, label: "Content" },
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
        <button onClick={() => navigate("/")} className="mb-8 flex items-center gap-2 px-3 py-2 text-foreground/60 hover:text-foreground/80 transition-colors">
          <Home className="h-4 w-4" />
          <span className="text-[11px] tracking-[0.15em] font-medium">WARDROBE</span>
        </button>
        <p className="px-3 mb-4 text-[9px] font-semibold tracking-[0.2em] text-accent/60 uppercase">Admin</p>
        <nav className="space-y-0.5">
          {NAV_ITEMS.map(item => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[12px] transition-colors ${
                isActive(item.path, item.exact)
                  ? "bg-accent/10 text-foreground/90 font-medium"
                  : "text-foreground/50 hover:text-foreground/70 hover:bg-foreground/[0.03]"
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
          <button onClick={() => navigate("/")} className="text-[10px] tracking-[0.15em] text-foreground/50 hover:text-foreground/70 md:hidden">
            ← BACK
          </button>
          <span className="text-[10px] tracking-[0.2em] font-medium text-foreground/40">ADMIN PANEL</span>
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
                  : "text-foreground/40"
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
