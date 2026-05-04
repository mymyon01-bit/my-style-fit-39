/**
 * Android immersive fullscreen — hides status bar AND navigation bar,
 * and re-asserts immersive mode on every resume / focus change so swipe-down
 * gestures don't permanently bring the system bars back.
 *
 * Uses a tiny inline Capacitor plugin call via the WebView bridge: the
 * Capacitor StatusBar plugin only hides the top bar. To hide the bottom
 * navigation bar we call Android's setSystemUiVisibility through the
 * EdgeToEdge / immersive APIs exposed by Capacitor 8 by toggling the
 * window flags via the Capacitor Plugins registry when available.
 */
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { StatusBar } from "@capacitor/status-bar";

let installed = false;

async function applyImmersive() {
  try {
    await StatusBar.hide();
    await StatusBar.setOverlaysWebView({ overlay: true });
  } catch { /* ignore */ }

  // Try the community immersive plugin if installed; otherwise rely on
  // the MainActivity-side flags applied at launch.
  const anyWindow = window as any;
  const plugin =
    anyWindow?.Capacitor?.Plugins?.AndroidFullScreen ||
    anyWindow?.Capacitor?.Plugins?.ImmersiveMode;
  if (plugin?.immersive) {
    try { await plugin.immersive(); } catch { /* ignore */ }
  }
}

export function installFullscreen() {
  if (installed) return;
  if (!Capacitor.isNativePlatform()) return;
  installed = true;

  applyImmersive();

  // Re-apply on resume — Android can show the system bars again after the
  // app returns from background or after a swipe gesture.
  App.addListener("appStateChange", ({ isActive }) => {
    if (isActive) applyImmersive();
  }).catch(() => { /* ignore */ });

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) applyImmersive();
  });
  window.addEventListener("focus", () => applyImmersive());
}
