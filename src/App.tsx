import { lazy, Suspense, useState, useCallback, useEffect, type ComponentType } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { I18nProvider } from "@/lib/i18n";
import { ThemeProvider } from "@/lib/theme";
import { TransitionProvider } from "@/lib/transition";
import { FontSizeProvider } from "@/lib/fontSize";
import { AuthProvider, useAuth } from "@/lib/auth";
import AppLayout from "@/components/AppLayout";
import DesktopNav from "@/components/DesktopNav";
import OOTDModalHost from "@/components/OOTDModalHost";
import UpdateBanner from "@/components/UpdateBanner";
import { OOTDModalProvider } from "@/lib/ootdModal";
import SplashScreen from "@/components/SplashScreen";
import { initPushNotifications } from "@/lib/native/push";
import { useMessageToasts } from "@/hooks/useMessageToasts";
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
import OAuthBridge from "@/pages/OAuthBridge";

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
const AdminAdmins = lazyWithRetry(() => import("@/pages/admin/AdminAdmins"), "AdminAdmins");
const AdminAuditLog = lazyWithRetry(() => import("@/pages/admin/AdminAuditLog"), "AdminAuditLog");
const AdminBrandCalibration = lazyWithRetry(() => import("@/pages/admin/AdminBrandCalibration"), "AdminBrandCalibration");
const AdminFitRules = lazyWithRetry(() => import("@/pages/admin/AdminFitRules"), "AdminFitRules");
const AdminFallbackTables = lazyWithRetry(() => import("@/pages/admin/AdminFallbackTables"), "AdminFallbackTables");
const AdminFitFeedback = lazyWithRetry(() => import("@/pages/admin/AdminFitFeedback"), "AdminFitFeedback");
const AdminFeatureFlags = lazyWithRetry(() => import("@/pages/admin/AdminFeatureFlags"), "AdminFeatureFlags");
const AdminAppConfig = lazyWithRetry(() => import("@/pages/admin/AdminAppConfig"), "AdminAppConfig");
const ShowroomBrowsePage = lazyWithRetry(() => import("@/pages/ShowroomBrowsePage"), "ShowroomBrowsePage");
const ShowroomNewPage = lazyWithRetry(() => import("@/pages/ShowroomNewPage"), "ShowroomNewPage");
const ShowroomDetailPage = lazyWithRetry(() => import("@/pages/ShowroomDetailPage"), "ShowroomDetailPage");
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
  // Run synchronously during render-commit window via useEffect, but DO NOT
  // depend on location.pathname — depending on it caused a second render pass
  // on every navigation (replaceState → useLocation tick → re-render of heavy
  // pages like Home/Discover). We read pathname fresh inside the effect.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const path = location.pathname;
    const exempt =
      path.startsWith("/auth") ||
      path.startsWith("/reset-password") ||
      path.startsWith("/admin") ||
      path.startsWith("/onboarding");
    if (exempt) return;
    if (
      window.location.pathname !== "/" ||
      window.location.search ||
      window.location.hash
    ) {
      // replaceState does not fire popstate, so React Router's internal
      // location is unaffected — no extra render is triggered.
      window.history.replaceState(null, "", "/");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);
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

  // Live message toasts — pop a sonner toast the moment a new message arrives,
  // regardless of which page the user is on, so they never need to refresh
  // to see incoming messages.
  useMessageToasts();

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
      <UpdateBanner />
      {!isAdmin && <DesktopNav />}
      {!isAdmin && <OOTDModalHost />}
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
            <Route path="admins" element={<AdminAdmins />} />
            <Route path="audit" element={<AdminAuditLog />} />
            <Route path="products" element={<AdminProducts />} />
            <Route path="categories" element={<AdminCategories />} />
            <Route path="ootd" element={<AdminOOTD />} />
            <Route path="content" element={<AdminContent />} />
            <Route path="brand-calibration" element={<AdminBrandCalibration />} />
            <Route path="fit-rules" element={<AdminFitRules />} />
            <Route path="fallback-tables" element={<AdminFallbackTables />} />
            <Route path="fit-feedback" element={<AdminFitFeedback />} />
            <Route path="feature-flags" element={<AdminFeatureFlags />} />
            <Route path="app-config" element={<AdminAppConfig />} />
            <Route path="settings" element={<AdminSettings />} />
          </Route>

          {/* Public routes */}
          <Route path="/about" element={<AboutPage />} />
          <Route path="/install" element={<InstallPage />} />
          <Route path="/~oauth-bridge" element={<OAuthBridge />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/subscription" element={<ProtectedRoute><SubscriptionPage /></ProtectedRoute>} />
          <Route element={<AppLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/discover" element={<DiscoverPage />} />
            <Route path="/fit" element={<FitPage />} />
            <Route path="/fit/:productId" element={<FitPage />} />
            <Route path="/ootd" element={<OOTDPage />} />
            <Route path="/showroom" element={<ShowroomBrowsePage />} />
            <Route path="/showroom/new" element={<ProtectedRoute><ShowroomNewPage /></ProtectedRoute>} />
            <Route path="/showroom/:id" element={<ShowroomDetailPage />} />
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
  const [splashDone, setSplashDone] = useState(() => !!sessionStorage.getItem("wardrobe-splash-v2"));
  const handleSplashComplete = useCallback(() => setSplashDone(true), []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <FontSizeProvider>
          <TransitionProvider>
            <I18nProvider>
              <AuthProvider>
              <TooltipProvider>
                <Toaster />
                <Sonner />
                {!splashDone && <SplashScreen onComplete={handleSplashComplete} />}
                <BrowserRouter>
                  <OOTDModalProvider>
                    <AppRoutes />
                  </OOTDModalProvider>
                </BrowserRouter>
              </TooltipProvider>
              </AuthProvider>
            </I18nProvider>
          </TransitionProvider>
        </FontSizeProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
