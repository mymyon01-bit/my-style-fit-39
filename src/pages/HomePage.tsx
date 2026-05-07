/**
 * HomePage — vibrant brutalist edition.
 *
 * Layout:
 *   [1] Vibrant hero with animated blobs, oversized italic display type,
 *       rotating ticker word, and brutalist command bar.
 *   [2] Marquee strip — moving manifesto words.
 *   [3] Footer.
 *
 * Keeps all original functions: mood query → /discover, language picker,
 * weather ambience, share-app, navigation buttons.
 */
import { useState, useRef, useCallback, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Loader2, Sparkles, Download, LogIn, User as UserIcon, Handshake } from "lucide-react";
import { toast } from "sonner";
import WeatherAmbience from "@/components/WeatherAmbience";
import { useWeather } from "@/hooks/useWeather";
import LanguageSelector from "@/components/LanguageSelector";
import Footer from "@/components/Footer";
import Brandmark from "@/components/Brandmark";
import MoodTicker from "@/components/MoodTicker";
import ShareButton from "@/components/ShareButton";
import OOTDDiaryButton from "@/components/OOTDDiaryButton";
import TodayInspoStrip from "@/components/today/TodayInspoStrip";
import StyleMeButton from "@/components/StyleMeButton";
import ContactUsDialog from "@/components/ContactUsDialog";
import { useAuth } from "@/lib/auth";

// PWA "Add to Home Screen" install event
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const HomePage = () => {
  const { t } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [affOpen, setAffOpen] = useState(false);
  const weather = useWeather();

  // Capture the browser's install prompt so the download icon can offer
  // a one-tap "Add to Home Screen" install — making the site behave like a
  // real app once installed.
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = useCallback(async () => {
    // Already installed (running standalone) → just confirm.
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // iOS Safari
      (navigator as any).standalone === true;
    if (isStandalone) {
      toast.success(t("appInstalled") || "Already installed");
      return;
    }
    if (installPrompt) {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === "accepted") {
        toast.success("Added to Home Screen");
        setInstallPrompt(null);
      }
      return;
    }
    // iOS / browsers without beforeinstallprompt — show manual instructions.
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (isIOS) {
      toast("Tap Share → Add to Home Screen", { duration: 5000 });
    } else {
      navigate("/install");
    }
  }, [installPrompt, navigate, t]);


  const handleSubmit = useCallback(async () => {
    if (!query.trim()) return;
    setIsLoading(true);
    await new Promise((r) => setTimeout(r, 600));
    setIsLoading(false);
    navigate(`/discover?mood=${encodeURIComponent(query.trim())}&source=homepage`);
  }, [query, navigate]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSubmit();
  };


  const weatherLabel = weather.condition
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background pb-20 md:pb-0">
      {/* Hero — HYPE edition */}
      <section className="hype-halo relative flex flex-1 flex-col items-center overflow-hidden pt-28 pb-20 md:pt-56 md:pb-28 md:flex-none">
        <WeatherAmbience condition={weather.condition} isNight={weather.isNight} />

        {/* Pink halo blobs */}
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="blob bg-primary -top-32 -left-20 h-[460px] w-[460px]" style={{ animationDelay: "0s" }} />
          <div className="blob bg-primary -bottom-40 -right-24 h-[520px] w-[520px]" style={{ animationDelay: "-6s", opacity: 0.4 }} />
          <div className="blob bg-foreground top-1/3 right-1/4 h-[260px] w-[260px]" style={{ animationDelay: "-12s", opacity: 0.18 }} />
        </div>

        {/* Grain + scanlines */}
        <div aria-hidden className="hype-grain" />
        <div aria-hidden className="hype-scan" />

        {/* Top bar — mobile only */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="absolute top-3 z-20 flex w-full items-center justify-between gap-2 px-4 py-0 lg:hidden"
        >
          <Brandmark variant="inline" size={20} />
          <div className="flex items-center gap-1">
            <button
              onClick={() => navigate("/install")}
              aria-label="Download app"
              title="Download app"
              className="flex h-7 w-7 items-center justify-center border-2 border-foreground bg-background text-foreground transition-all hover:bg-primary hover:text-primary-foreground hover:border-primary"
            >
              <Download className="h-3 w-3" />
            </button>
            <button
              onClick={() => navigate(user ? "/profile" : "/auth")}
              aria-label={user ? "Profile" : "Sign in"}
              className="flex h-7 items-center gap-1 border-2 border-foreground bg-primary px-2.5 text-[9px] font-black uppercase tracking-[0.2em] text-primary-foreground transition-all hover:bg-foreground hover:text-background"
            >
              {user ? <UserIcon className="h-2.5 w-2.5" /> : <LogIn className="h-2.5 w-2.5" />}
              <span>{user ? "ME" : "SIGN IN"}</span>
            </button>
            <LanguageSelector />
          </div>
        </motion.div>

        {/* Main column */}
        <div className="relative z-10 mx-auto w-full max-w-[680px] px-6">
          {/* Slap tag */}
          <motion.div
            initial={{ opacity: 0, y: -8, rotate: -8 }}
            animate={{ opacity: 1, y: 0, rotate: -2 }}
            transition={{ duration: 0.6 }}
            className="mb-6 flex justify-center"
          >
            <span className="hype-tag">★ DROP / VOL.04</span>
          </motion.div>

          {/* HYPE Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="hype-slab text-center text-[56px] sm:text-[78px] md:text-[104px]"
          >
            <span className="block">WEAR</span>
            <span className="block outline">YOUR</span>
            <span className="block">
              <MoodTicker
                onPick={(word) =>
                  navigate(`/discover?mood=${encodeURIComponent(word)}&source=homepage`)
                }
              />
            </span>
          </motion.h1>

          {/* Underline strip */}
          <div className="mx-auto mt-6 h-[3px] w-24 bg-primary shadow-[0_0_20px_hsl(var(--primary)/0.8)]" />

          {/* Command bar — slab style */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="mt-8"
          >
            <div className="flex items-center gap-2 border-2 border-foreground bg-background px-5 py-2 shadow-[6px_6px_0_hsl(var(--primary))] focus-within:border-primary focus-within:shadow-[6px_6px_0_hsl(var(--foreground))] transition-all">
              <Sparkles
                className={`h-4 w-4 shrink-0 transition-colors ${
                  isFocused ? "text-primary" : "text-foreground/50"
                }`}
              />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                onKeyDown={handleKeyDown}
                placeholder={t("howAreYouFeeling")}
                className="flex-1 bg-transparent py-2 font-display text-[16px] font-bold uppercase tracking-tight text-foreground outline-none placeholder:text-foreground/35 placeholder:font-medium placeholder:normal-case md:text-[18px]"
              />
              <button
                onClick={handleSubmit}
                disabled={!query.trim() || isLoading}
                aria-label={t("enter")}
                className="flex h-10 w-10 shrink-0 items-center justify-center bg-primary text-primary-foreground transition-all duration-200 hover:bg-foreground hover:text-primary disabled:cursor-not-allowed disabled:bg-foreground/15 disabled:text-foreground/40"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="h-4 w-4" />
                )}
              </button>
            </div>
          </motion.div>

          {/* OOTD Diary — mobile-only */}
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay: 0.45, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            className="mt-10 mb-4 flex justify-center md:hidden"
          >
            <OOTDDiaryButton compact />
          </motion.div>

          {/* Primary CTA */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.6 }}
            className="mt-8 flex flex-col items-center gap-3 md:mt-12"
          >
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.32em] text-foreground/60">
              CURATED <span className="text-primary">/</span> FOR YOU
            </p>
            <StyleMeButton variant="pill" />
          </motion.div>
        </div>

        {/* Marquee strip */}
        <div className="relative z-10 mt-10 w-full overflow-hidden hype-marquee py-2 md:mt-14">
          <div className="marquee">
            <div className="marquee-track text-[22px] md:text-[28px]">
              {Array.from({ length: 8 }).map((_, i) => (
                <span key={`a${i}`} className="flex items-center gap-6">
                  WEAR THE HYPE <span className="opacity-60">★</span> NEW DROP
                  <span className="opacity-60">★</span> AI FIT
                  <span className="opacity-60">★</span> SHOWROOM
                  <span className="opacity-60">★</span>
                </span>
              ))}
            </div>
            <div className="marquee-track text-[22px] md:text-[28px]" aria-hidden>
              {Array.from({ length: 8 }).map((_, i) => (
                <span key={`b${i}`} className="flex items-center gap-6">
                  WEAR THE HYPE <span className="opacity-60">★</span> NEW DROP
                  <span className="opacity-60">★</span> AI FIT
                  <span className="opacity-60">★</span> SHOWROOM
                  <span className="opacity-60">★</span>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* V4.3 — Today's Inspo strip */}
        <TodayInspoStrip />

        <div className="relative z-10 mx-auto w-full max-w-[680px] px-6">
          {/* Weather meta */}
          {!weather.loading && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8, duration: 0.8 }}
              className="mt-10 flex flex-col items-center gap-2 md:mt-14"
            >
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-foreground/55">
                TODAY <span className="text-primary">//</span> WEATHER
              </p>
              <p className="font-display text-[14px] font-black uppercase tracking-tight text-foreground">
                <span className="inline-block h-2 w-2 translate-y-[-2px] bg-primary mr-2 shadow-[0_0_12px_hsl(var(--primary))]" />
                {weather.temp}° · {weatherLabel.toUpperCase()}
                {weather.location && !weather.error ? ` · ${weather.location.toUpperCase()}` : ""}
              </p>
            </motion.div>
          )}

          {/* AFFILIATE / SHARE */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.0, duration: 0.6 }}
            className="mt-10 flex flex-wrap items-center justify-center gap-2 md:mt-14"
          >
            <button
              onClick={() => setAffOpen(true)}
              className="group relative inline-flex items-center gap-2 overflow-hidden border-2 border-foreground bg-background px-3 py-1.5 text-[10px] font-black tracking-[0.22em] text-foreground transition-all duration-200 hover:bg-primary hover:text-primary-foreground hover:border-primary hover:shadow-[0_0_24px_hsl(var(--primary)/0.6)]"
            >
              <span aria-hidden className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
              </span>
              <Handshake className="relative h-3 w-3" />
              <span className="relative">AFFILIATE / AD</span>
            </button>
            <ShareButton
              title="Share, Explore, and Edge your style. Join My'myon."
              url="https://www.mymyon.com"
              label="SHARE MYMYON"
            />
          </motion.div>
        </div>
      </section>

      <ContactUsDialog open={affOpen} onOpenChange={setAffOpen} topic="Affiliate / Ad" />

      <div className="hidden md:block">
        <Footer />
      </div>
    </div>
  );
};

export default HomePage;
