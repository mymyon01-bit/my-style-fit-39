import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor config for my'myon — wraps the React + Vite web app as a native
 * iOS / Android shell. Backend (Lovable Cloud) is shared with the web build.
 *
 * Hot-reload during development:
 *   The `server.url` points to the Lovable preview so a fresh `npx cap run ios`
 *   or `npx cap run android` will load the live preview without a rebuild.
 *   For production App Store / Play Store builds, REMOVE the `server.url` block
 *   (or build with `npm run build` and `npx cap sync` so the bundled `dist/` is
 *   used instead).
 */
const config: CapacitorConfig = {
  appId: "com.mymyon.app",
  appName: "my'myon",
  webDir: "dist",
  server: {
    url: "https://538d9ee4-0745-4436-8a8d-5fac1f101c81.lovableproject.com?forceHideBadge=true",
    cleartext: true,
  },
  ios: {
    contentInset: "always",
  },
  android: {
    backgroundColor: "#0a0a0a",
  },
  plugins: {
    SplashScreen: {
      // Keep splash visible until the React app explicitly hides it.
      // Prevents the white flash between native splash and JS bundle load.
      launchShowDuration: 3000,
      launchAutoHide: false,
      backgroundColor: "#f5a3c7",
      androidSplashResourceName: "splash",
      // CENTER_CROP fills the entire screen by cropping overflow. The new
      // splash artwork is portrait (phone-aspect) so cropping is minimal and
      // there are no pink/black bars on the sides.
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;
