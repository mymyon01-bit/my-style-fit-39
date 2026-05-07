/**
 * HomePage — minimal hype edition.
 *
 * Design: stripped-down black canvas with a single neon-pink accent.
 * Generous whitespace, restrained typography, no blobs/scanlines/marquee.
 * Keeps all original functions: mood query → /discover, language picker,
 * weather ambience, share-app, install, auth.
 */
import { useState, useRef, useCallback, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Loader2, Download, LogIn, User as UserIcon, Handshake } from "lucide-react";
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
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
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
    await new Promise((r) => setTimeout(r, 400));
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
      {/* Hero — minimal hype */}
      <section className="relative flex flex-1 flex-col items-center overflow-hidden pt-24 pb-16 md:pt-40 md:pb-24 md:flex-none">
        <WeatherAmbience condition={weather.condition} isNight={weather.isNight} />

        {/* Single soft pink halo — far left, low opacity */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-40 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full"
          style={{
            background: "radial-gradient(circle, hsl(var(--primary) / 0.18) 0%, transparent 60%)",
            filter: "blur(40px)",
          }}
        />

        {/* Top bar */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="absolute top-4 z-20 flex w-full items-center justify-between px-5 md:px-8"
        >
          <Brandmark variant="inline" size={20} />
          <div className="flex items-center gap-2">
            <button
              onClick={handleInstall}
              aria-label="Install app"
              className="flex h-8 w-8 items-center justify-center rounded-full text-foreground/60 transition-colors hover:text-foreground"
            >
              <Download className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => navigate(user ? "/profile" : "/auth")}
              aria-label={user ? "Profile" : "Sign in"}
              className="flex h-8 items-center gap-1.5 rounded-full border border-foreground/15 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/80 transition-colors hover:border-primary/60 hover:text-primary"
            >
              {user ? <UserIcon className="h-3 w-3" /> : <LogIn className="h-3 w-3" />}
              <span>{user ? "Me" : "Sign in"}</span>
            </button>
            <LanguageSelector />
          </div>
        </motion.div>

        {/* Main column */}
        <div className="relative z-10 mx-auto w-full max-w-[640px] px-6">
          {/* Tiny eyebrow */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mb-10 flex items-center justify-center gap-2"
          >
            <span className="h-1 w-1 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary))]" />
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.32em] text-foreground/50">
              Vol.04 — Drop
            </span>
            <span className="h-1 w-1 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary))]" />
          </motion.div>

          {/* Minimal headline */}
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="text-center font-display text-[44px] font-black leading-[0.92] tracking-tight text-foreground sm:text-[60px] md:text-[80px]"
            style={{ letterSpacing: "-0.045em" }}
          >
            <span className="block">Wear your</span>
            <span className="block text-primary">
              <MoodTicker
                onPick={(word) =>
                  navigate(`/discover?mood=${encodeURIComponent(word)}&source=homepage`)
                }
              />
            </span>
          </motion.h1>

          {/* Minimal command bar */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.25 }}
            className="mt-12"
          >
            <div
              className={`flex items-center gap-3 rounded-full border bg-card/60 px-5 py-2.5 backdrop-blur-md transition-all ${
                isFocused
                  ? "border-primary/60 shadow-[0_0_0_4px_hsl(var(--primary)/0.12)]"
                  : "border-foreground/15"
              }`}
            >
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                onKeyDown={handleKeyDown}
                placeholder={t("howAreYouFeeling")}
                className="flex-1 bg-transparent py-1.5 text-[15px] font-medium text-foreground outline-none placeholder:text-foreground/35"
              />
              <button
                onClick={handleSubmit}
                disabled={!query.trim() || isLoading}
                aria-label={t("enter")}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-all hover:scale-105 disabled:cursor-not-allowed disabled:bg-foreground/10 disabled:text-foreground/40"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="h-4 w-4" />
                )}
              </button>
            </div>
          </motion.div>

          {/* OOTD Diary — mobile only */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="mt-8 flex justify-center md:hidden"
          >
            <OOTDDiaryButton compact />
          </motion.div>

          {/* Primary CTA */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.6 }}
            className="mt-10 flex items-center justify-center gap-2 md:mt-12"
          >
            <StyleMeButton variant="pill" />
            <button
              type="button"
              onClick={() => window.dispatchEvent(new Event("mymyon:open-tour"))}
              aria-label="Show intro"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-foreground/15 text-foreground/60 transition-colors hover:border-accent hover:text-accent"
            >
              <span className="font-mono text-[12px] font-bold italic">i</span>
            </button>
          </motion.div>

          {/* Weather meta */}
          {!weather.loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7, duration: 0.6 }}
              className="mt-12 flex items-center justify-center gap-2 font-mono text-[10px] uppercase tracking-[0.24em] text-foreground/45"
            >
              <span className="h-1 w-1 rounded-full bg-primary/70" />
              <span>
                {weather.temp}° · {weatherLabel}
                {weather.location && !weather.error ? ` · ${weather.location}` : ""}
              </span>
            </motion.div>
          )}
        </div>

        {/* Today's Inspo strip */}
        <TodayInspoStrip />

        {/* Footer actions */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9, duration: 0.6 }}
          className="relative z-10 mt-12 flex flex-wrap items-center justify-center gap-3"
        >
          <button
            onClick={() => setAffOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-full border border-foreground/15 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-foreground/60 transition-colors hover:border-primary/50 hover:text-primary"
          >
            <Handshake className="h-3 w-3" />
            <span>Affiliate</span>
          </button>
          <ShareButton
            title="Share, Explore, and Edge your style. Join My'myon."
            url="https://www.mymyon.com"
            label="Share"
          />
        </motion.div>
      </section>

      <ContactUsDialog open={affOpen} onOpenChange={setAffOpen} topic="Affiliate / Ad" />

      <div className="hidden md:block">
        <Footer />
      </div>
    </div>
  );
};

export default HomePage;
