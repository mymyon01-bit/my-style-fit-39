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
      launchShowDuration: 1200,
      backgroundColor: "#0a0a0a",
      androidSplashResourceName: "splash",
      showSpinner: false,
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;
