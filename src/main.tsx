import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Font-loading guard — while the display font (Fraunces / Noto Serif KR) is
// still loading, computers without the font installed render the headline in
// a weird fallback. We mark <html class="fonts-loading"> so CSS can replace
// the headline text with an animated pink blink block until the font arrives.
if (typeof document !== "undefined") {
  document.documentElement.classList.add("fonts-loading");
  const clear = () => document.documentElement.classList.remove("fonts-loading");
  const fonts = (document as any).fonts;
  if (fonts?.ready) {
    Promise.race([
      fonts.ready,
      new Promise((r) => setTimeout(r, 4000)),
    ]).then(clear).catch(clear);
  } else {
    setTimeout(clear, 1500);
  }
}

// One-time purge of locally cached fit/cutout/try-on images so previously
// generated photos don't reappear after the server-side reset.
try {
  const PURGE_KEY = "fit-cache-purge::v2";
  if (typeof window !== "undefined" && !localStorage.getItem(PURGE_KEY)) {
    const prefixes = ["fit-cutout::", "fit-tryon::", "fit-canvas::", "fit-result::"];
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && prefixes.some((p) => k.startsWith(p))) toRemove.push(k);
    }
    toRemove.forEach((k) => localStorage.removeItem(k));
    localStorage.setItem(PURGE_KEY, String(Date.now()));
  }
} catch {
  // ignore
}

// Safety net: hide the native Capacitor splash once the JS bundle is parsed.
// Capacitor config sets `launchAutoHide: false` so the native splash stays up
// until we explicitly hide it — guaranteeing no white flash. We hide it here
// (and again from <SplashScreen/>) so even sessions that skip the web splash
// (cached) still dismiss the native one immediately.
if (typeof window !== "undefined" && (window as any).Capacitor?.isNativePlatform?.()) {
  import("@capacitor/splash-screen")
    .then(({ SplashScreen }) => SplashScreen.hide({ fadeOutDuration: 250 }))
    .catch(() => { /* plugin missing in web build — ignore */ });

  // Mark the native shell on <html> so CSS can add status-bar safe-area
  // padding only on the APK (web stays unpadded).
  document.documentElement.classList.add("native-app");

  // Configure the status bar so the OS time/battery are NOT drawn on top
  // of our content. setOverlaysWebView(false) reserves the status-bar area
  // and pushes the WebView down. Style 'Light' = light icons on dark bg.
  import("@capacitor/status-bar")
    .then(async ({ StatusBar, Style }) => {
      try {
        await StatusBar.setOverlaysWebView({ overlay: false });
        await StatusBar.setStyle({ style: Style.Dark });
        await StatusBar.setBackgroundColor({ color: "#0a0a0a" });
      } catch { /* ignore */ }
    })
    .catch(() => { /* plugin missing — ignore */ });
}

createRoot(document.getElementById("root")!).render(<App />);
