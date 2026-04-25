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
      {/* Hero — vibrant edge */}
      <section className="relative flex flex-1 flex-col items-center justify-center overflow-hidden">
        <WeatherAmbience condition={weather.condition} />

        {/* Animated color blobs — vibrancy without overwhelming */}
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="blob bg-primary -top-32 -left-20 h-[420px] w-[420px]" style={{ animationDelay: "0s" }} />
          <div className="blob bg-accent -bottom-40 -right-24 h-[480px] w-[480px]" style={{ animationDelay: "-6s" }} />
          <div className="blob bg-edge-cyan top-1/3 right-1/4 h-[300px] w-[300px]" style={{ animationDelay: "-12s", opacity: 0.3 }} />
        </div>

        {/* Top bar — mobile only */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="absolute top-5 z-20 flex w-full items-center justify-between gap-2 px-5 lg:hidden"
        >
          <Brandmark variant="inline" />
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleInstall}
              aria-label="Install app to home screen"
              title="Install app"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-foreground/20 bg-background/70 text-foreground/80 backdrop-blur-md transition-all hover:border-foreground hover:text-foreground"
            >
              <Download className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => navigate(user ? "/profile" : "/auth")}
              aria-label={user ? "Profile" : "Sign in"}
              className="flex h-8 items-center gap-1.5 rounded-full bg-foreground px-3 text-[10px] font-semibold uppercase tracking-wider text-background transition-all hover:bg-primary hover:text-primary-foreground"
            >
              {user ? <UserIcon className="h-3 w-3" /> : <LogIn className="h-3 w-3" />}
              <span>{user ? "Me" : "Sign in"}</span>
            </button>
            <LanguageSelector />
          </div>
        </motion.div>

        {/* Main column */}
        <div className="relative z-10 mx-auto w-full max-w-[600px] px-6">
          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col items-center text-center font-display text-[38px] font-medium italic leading-[1.15] tracking-[-0.05em] text-foreground sm:text-[50px] md:text-[66px]"
          >
            <span className="block">wear your</span>
            <MoodTicker
              onPick={(word) =>
                navigate(`/discover?mood=${encodeURIComponent(word)}&source=homepage`)
              }
            />
          </motion.h1>

          {/* Rounded command bar */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="mt-6"
          >
            <div className="flex items-center gap-2 rounded-full border border-foreground/15 bg-background/80 px-5 py-2 shadow-sm backdrop-blur-md focus-within:border-foreground/50 transition-colors">
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
                className="flex-1 bg-transparent py-2 font-display text-[16px] font-medium tracking-tight text-foreground outline-none placeholder:text-foreground/35 placeholder:italic placeholder:font-light md:text-[18px]"
              />
              <button
                onClick={handleSubmit}
                disabled={!query.trim() || isLoading}
                aria-label={t("enter")}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-foreground text-background transition-all duration-200 hover:bg-primary hover:text-primary-foreground disabled:cursor-not-allowed disabled:bg-foreground/15 disabled:text-foreground/40"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="h-4 w-4" />
                )}
              </button>
            </div>
          </motion.div>

          {/* OOTD Diary — HERO centerpiece. Compact on mobile so the hero
              fits in a single phone screen without overlapping the top bar
              or the action buttons below. Full size on md+. */}
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay: 0.45, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            className="mt-8 mb-3 flex justify-center md:mt-14 md:mb-8"
          >
            <span className="md:hidden"><OOTDDiaryButton compact /></span>
            <span className="hidden md:block"><OOTDDiaryButton /></span>
          </motion.div>

          {/* Button rows — mobile: 2 rows (Explore+StyleMe, then About+Share); desktop: single row */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.6 }}
            className="mt-8 flex flex-col items-center gap-3 md:flex-row md:flex-wrap md:justify-center md:mt-12"
          >
            {/* Row 1 (mobile): Explore + Style Me */}
            <div className="flex items-center justify-center gap-2 flex-nowrap">
              <button
                onClick={() => navigate("/discover")}
                className="rounded-full bg-foreground px-3 py-1.5 text-[10px] font-semibold tracking-wide text-background transition-all duration-200 hover:bg-primary hover:text-primary-foreground whitespace-nowrap"
              >
                {t("exploreStyles")}
              </button>
              <StyleMeButton variant="pill" />
            </div>
            {/* Row 2 (mobile): About + Share */}
            <div className="flex items-center justify-center gap-2 flex-nowrap">
              <button
                onClick={() => navigate("/about")}
                className="rounded-full border border-foreground/20 px-3 py-1.5 text-[10px] font-semibold tracking-wide text-foreground/75 transition-all duration-200 hover:border-foreground hover:text-foreground whitespace-nowrap"
              >
                {t("about")}
              </button>
              <ShareButton
                title="Share, Explore, and Edge your style. Join My'myon."
                url="https://www.mymyon.com"
                className="self-center"
              />
            </div>
          </motion.div>

          {/* Weather meta */}
          {!weather.loading && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8, duration: 0.8 }}
              className="mt-8 flex flex-col items-center gap-2 md:mt-12"
            >
              <p className="font-display text-[15px] italic font-light tracking-tight text-foreground/70 md:text-[17px]">
                today your weather is<span className="text-primary">…</span>
              </p>
              <p className="label-mono text-foreground/60">
                <span className="inline-block h-1.5 w-1.5 translate-y-[-1px] rounded-full bg-primary mr-2 animate-pulse" />
                {weather.temp}° · {weatherLabel.toUpperCase()}
                {weather.location && !weather.error ? ` · ${weather.location.toUpperCase()}` : ""}
              </p>
            </motion.div>
          )}

          {/* AFFILIATE / AD — fancy animated button under date */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.0, duration: 0.6 }}
            className="mt-4 flex justify-center"
          >
            <button
              onClick={() => setAffOpen(true)}
              className="group relative inline-flex items-center gap-2 overflow-hidden rounded-full border border-foreground/20 bg-background/60 px-3 py-1.5 text-[9px] font-bold tracking-[0.22em] text-foreground/70 backdrop-blur-md transition-all duration-300 hover:border-foreground/60 hover:text-foreground hover:scale-[1.04] active:scale-[0.97]"
            >
              {/* Sweeping gradient sheen */}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-y-0 -left-full w-1/2 bg-gradient-to-r from-transparent via-primary/40 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-[400%]"
              />
              {/* Pulsing dot */}
              <span
                aria-hidden
                className="relative flex h-1.5 w-1.5"
              >
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
              </span>
              <Handshake className="relative h-3 w-3 transition-transform duration-300 group-hover:rotate-[-8deg]" />
              <span className="relative">AFFILIATE / AD</span>
            </button>
          </motion.div>
        </div>
      </section>

      <ContactUsDialog open={affOpen} onOpenChange={setAffOpen} topic="Affiliate / Ad" />

      <Footer />
    </div>
  );
};

export default HomePage;
