/**
 * OpenInAppBanner — smart banner shown to users browsing the web on a phone.
 * Hidden on desktop, hidden inside the native Capacitor shell, and dismissible
 * (remembered for 7 days via localStorage).
 *
 * Tapping "Get app" routes to /install where the actual store buttons live.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import { detectMobileOS, isNativeApp } from "@/lib/native/platform";

const DISMISS_KEY = "mymyon-app-banner-dismissed";
const DISMISS_DAYS = 7;

const OpenInAppBanner = () => {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);
  const [os, setOs] = useState<"ios" | "android" | null>(null);

  useEffect(() => {
    if (isNativeApp()) return;
    const detected = detectMobileOS();
    if (!detected) return;

    try {
      const dismissed = localStorage.getItem(DISMISS_KEY);
      if (dismissed) {
        const ts = parseInt(dismissed, 10);
        if (Date.now() - ts < DISMISS_DAYS * 24 * 60 * 60 * 1000) return;
      }
    } catch {
      // ignore storage errors
    }

    setOs(detected);
    setVisible(true);
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // ignore
    }
    setVisible(false);
  };

  if (!visible || !os) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[60] flex items-center gap-3 border-b border-foreground/10 bg-background/95 px-4 py-2.5 backdrop-blur-md lg:hidden">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-accent/10">
        <img src="/icons/icon-192.png" alt="my'myon" className="h-7 w-7 rounded-lg" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12px] font-semibold text-foreground">
          Get the my'myon app
        </p>
        <p className="truncate text-[10px] text-foreground/60">
          Faster, with camera + push notifications
        </p>
      </div>
      <button
        onClick={() => {
          dismiss();
          navigate("/install");
        }}
        className="shrink-0 rounded-full bg-foreground px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-background"
      >
        Install
      </button>
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="shrink-0 rounded-full p-1 text-foreground/50 hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};

export default OpenInAppBanner;
