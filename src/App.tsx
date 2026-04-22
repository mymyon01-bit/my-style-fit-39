import { lazy, Suspense, useState, useCallback, useEffect, type ComponentType } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { I18nProvider } from "@/lib/i18n";
import { ThemeProvider } from "@/lib/theme";
import { TransitionProvider } from "@/lib/transition";
import { AuthProvider, useAuth } from "@/lib/auth";
import AppLayout from "@/components/AppLayout";
import DesktopNav from "@/components/DesktopNav";
import SplashScreen from "@/components/SplashScreen";
import OpenInAppBanner from "@/components/OpenInAppBanner";
import { initPushNotifications } from "@/lib/native/push";
import { isNativeApp } from "@/lib/native/platform";
import { Loader2 } from "lucide-react";
import AuthPage from "@/pages/AuthPage";
import HomePage from "@/pages/HomePage";
import DiscoverPage from "@/pages/DiscoverPage";
import FitPage from "@/pages/FitPage";
import OOTDPage from "@/pages/OOTDPage";
import SettingsPage from "@/pages/SettingsPage";
import AboutPage from "@/pages/AboutPage";
import NotFound from "@/pages/NotFound";
import ResetPasswordPage from "@/pages/ResetPasswordPage";
import InstallPage from "@/pages/InstallPage";

const lazyWithRetry = <T extends ComponentType<any>>(
  importer: () => Promise<{ default: T }>,
  key: string,
) =>
  lazy(async () => {
    const retryKey = `wardrobe:lazy-retry:${key}`;

    try {
      const module = await importer();
      sessionStorage.removeItem(retryKey);
      return module;
    } catch (error) {
      if (!sessionStorage.getItem(retryKey)) {
        sessionStorage.setItem(retryKey, "1");
        window.location.reload();
        return new Promise<never>(() => undefined);
      }

      sessionStorage.removeItem(retryKey);
      throw error;
    }
  });

// Keep the public entry flow eager so the published site never hangs on
// first-load route chunks in a fresh browser or slow network.
const OnboardingPage = lazyWithRetry(() => import("@/pages/OnboardingPage"), "OnboardingPage");
const ProfilePage = lazyWithRetry(() => import("@/pages/ProfilePage"), "ProfilePage");
const SubscriptionPage = lazyWithRetry(() => import("@/pages/SubscriptionPage"), "SubscriptionPage");
const UserProfilePage = lazyWithRetry(() => import("@/pages/UserProfilePage"), "UserProfilePage");
const AdminLayout = lazyWithRetry(() => import("@/pages/admin/AdminLayout"), "AdminLayout");
const AdminOverview = lazyWithRetry(() => import("@/pages/admin/AdminOverview"), "AdminOverview");
const AdminUsers = lazyWithRetry(() => import("@/pages/admin/AdminUsers"), "AdminUsers");
const AdminProducts = lazyWithRetry(() => import("@/pages/admin/AdminProducts"), "AdminProducts");
const AdminCategories = lazyWithRetry(() => import("@/pages/admin/AdminCategories"), "AdminCategories");
const AdminOOTD = lazyWithRetry(() => import("@/pages/admin/AdminOOTD"), "AdminOOTD");
const AdminContent = lazyWithRetry(() => import("@/pages/admin/AdminContent"), "AdminContent");
const AdminSettings = lazyWithRetry(() => import("@/pages/admin/AdminSettings"), "AdminSettings");
const AdminDiagnostics = lazyWithRetry(() => import("@/pages/admin/AdminDiagnostics"), "AdminDiagnostics");
const queryClient = new QueryClient();

const PageLoader = () => (
  <div className="flex min-h-[60vh] items-center justify-center">
    <Loader2 className="h-5 w-5 animate-spin text-accent/65" />
  </div>
);

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
};

/**
 * UrlMasker — keeps the visible browser address bar at "/" regardless of the
 * actual route. React Router still tracks the real path internally so all
 * navigation and rendering work normally.
 *
 * Trade-offs (user explicitly accepted):
 *  - Refresh always lands on /
 *  - Deep-link bookmarks not preserved
 *  - Browser back-button history is collapsed
 *
 * Auth-related routes (/auth, /reset-password) and admin routes are exempt
 * so OAuth callbacks and admin tooling continue to work.
 */
const UrlMasker = () => {
  const location = useLocation();
  useEffect(() => {
    if (typeof window === "undefined") return;
    const path = location.pathname;
    // Exempt routes where the URL must remain visible/usable.
    const exempt =
      path.startsWith("/auth") ||
      path.startsWith("/reset-password") ||
      path.startsWith("/admin") ||
      path.startsWith("/onboarding");
    if (exempt) return;
    if (window.location.pathname !== "/" || window.location.search || window.location.hash) {
      window.history.replaceState(null, "", "/");
    }
  }, [location.pathname]);
  return null;
};

const AppRoutes = () => {
  const { user, loading } = useAuth();

  // Init push notifications once a user is signed in (no-op on web).
  // The push helper POSTs the device token to the `register-device-token`
  // edge function, which upserts it into push_device_tokens (RLS-scoped).
  useEffect(() => {
    if (!user || !isNativeApp()) return;
    initPushNotifications((token, platform) => {
      console.log("[push] device token registered", { platform, token: token.slice(0, 12) + "…" });
    });
  }, [user]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="font-display text-2xl font-bold tracking-[0.2em] text-foreground">mymyon</h1>
          <Loader2 className="mx-auto mt-4 h-5 w-5 animate-spin text-accent" />
        </div>
      </div>
    );
  }

  const location = useLocation();
  const isAdmin = location.pathname.startsWith("/admin");

  return (
    <>
      <UrlMasker />
      <OpenInAppBanner />
      {!isAdmin && <DesktopNav />}
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Auth */}
          <Route path="/auth" element={user ? <Navigate to="/" replace /> : <AuthPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/onboarding" element={<ProtectedRoute><OnboardingPage /></ProtectedRoute>} />

          {/* Admin */}
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminOverview />} />
            <Route path="diagnostics" element={<AdminDiagnostics />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="products" element={<AdminProducts />} />
            <Route path="categories" element={<AdminCategories />} />
            <Route path="ootd" element={<AdminOOTD />} />
            <Route path="content" element={<AdminContent />} />
            <Route path="settings" element={<AdminSettings />} />
          </Route>

          {/* Public routes */}
          <Route path="/about" element={<AboutPage />} />
          <Route path="/install" element={<InstallPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/subscription" element={<ProtectedRoute><SubscriptionPage /></ProtectedRoute>} />
          <Route element={<AppLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/discover" element={<DiscoverPage />} />
            <Route path="/fit" element={<FitPage />} />
            <Route path="/fit/:productId" element={<FitPage />} />
            <Route path="/ootd" element={<OOTDPage />} />
            <Route path="/user/:userId" element={<UserProfilePage />} />
            <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </>
  );
};

const App = () => {
  const [splashDone, setSplashDone] = useState(() => !!sessionStorage.getItem("wardrobe-splash"));
  const handleSplashComplete = useCallback(() => setSplashDone(true), []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TransitionProvider>
          <I18nProvider>
            <AuthProvider>
              <TooltipProvider>
                <Toaster />
                <Sonner />
                {!splashDone && <SplashScreen onComplete={handleSplashComplete} />}
                <BrowserRouter>
                  <AppRoutes />
                </BrowserRouter>
              </TooltipProvider>
            </AuthProvider>
          </I18nProvider>
        </TransitionProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
