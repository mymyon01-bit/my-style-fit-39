import { lazy, Suspense, useState, useCallback } from "react";
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
import { Loader2 } from "lucide-react";

// Lazy load all pages for code splitting
const AuthPage = lazy(() => import("@/pages/AuthPage"));
const OnboardingPage = lazy(() => import("@/pages/OnboardingPage"));
const HomePage = lazy(() => import("@/pages/HomePage"));
const DiscoverPage = lazy(() => import("@/pages/DiscoverPage"));
const FitPage = lazy(() => import("@/pages/FitPage"));
const OOTDPage = lazy(() => import("@/pages/OOTDPage"));
const ProfilePage = lazy(() => import("@/pages/ProfilePage"));
const SettingsPage = lazy(() => import("@/pages/SettingsPage"));
const AboutPage = lazy(() => import("@/pages/AboutPage"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const ResetPasswordPage = lazy(() => import("@/pages/ResetPasswordPage"));
const InstallPage = lazy(() => import("@/pages/InstallPage"));
const SubscriptionPage = lazy(() => import("@/pages/SubscriptionPage"));
const UserProfilePage = lazy(() => import("@/pages/UserProfilePage"));
const AdminLayout = lazy(() => import("@/pages/admin/AdminLayout"));
const AdminOverview = lazy(() => import("@/pages/admin/AdminOverview"));
const AdminUsers = lazy(() => import("@/pages/admin/AdminUsers"));
const AdminProducts = lazy(() => import("@/pages/admin/AdminProducts"));
const AdminCategories = lazy(() => import("@/pages/admin/AdminCategories"));
const AdminOOTD = lazy(() => import("@/pages/admin/AdminOOTD"));
const AdminContent = lazy(() => import("@/pages/admin/AdminContent"));
const AdminSettings = lazy(() => import("@/pages/admin/AdminSettings"));

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

const AppRoutes = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="font-display text-2xl font-bold tracking-[0.2em] text-foreground">WARDROBE</h1>
          <Loader2 className="mx-auto mt-4 h-5 w-5 animate-spin text-accent" />
        </div>
      </div>
    );
  }

  const location = useLocation();
  const isAdmin = location.pathname.startsWith("/admin");

  return (
    <>
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
