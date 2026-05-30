/**
 * HomePage — minimal editorial (MYMYON v3).
 *
 * Strip everything back. One column. Massive whitespace. One headline,
 * one input, two ghost links. Portrait sits below as a quiet anchor.
 * All original functions preserved (mood → /discover, weather, install,
 * language, auth, share, OOTD diary, StyleMe, affiliate).
 */
import { useState, useRef, useCallback, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Loader2, Download, LogIn, User as UserIcon } from "lucide-react";
import { toast } from "sonner";
import { useWeather } from "@/hooks/useWeather";
import LanguageSelector from "@/components/LanguageSelector";
import Brandmark from "@/components/Brandmark";
import MoodTicker from "@/components/MoodTicker";
import { useAuth } from "@/lib/auth";
import heroPortrait from "@/assets/home-hero.jpg";

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
    if (isIOS) toast("Tap Share → Add to Home Screen", { duration: 5000 });
    else navigate("/install");
  }, [installPrompt, navigate, t]);

  const handleSubmit = useCallback(async () => {
    if (!query.trim()) return;
    setIsLoading(true);
    await new Promise((r) => setTimeout(r, 250));
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
    <div className="flex min-h-[100dvh] flex-col bg-background text-foreground">
      {/* Top bar — barely there */}
      <header className="flex w-full items-center justify-between px-6 pt-5 md:px-10 md:pt-7">
        <Brandmark variant="inline" size={20} />
        <div className="flex items-center gap-3">
          <button
            onClick={handleInstall}
            aria-label="Install app"
            className="text-foreground/45 transition-colors hover:text-foreground"
          >
            <Download className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => navigate(user ? "/profile" : "/auth")}
            aria-label={user ? "Profile" : "Sign in"}
            className="text-foreground/45 transition-colors hover:text-foreground"
          >
            {user ? <UserIcon className="h-3.5 w-3.5" /> : <LogIn className="h-3.5 w-3.5" />}
          </button>
          <LanguageSelector />
        </div>
      </header>

      {/* Hero — one column, monumental whitespace */}
      <main className="mx-auto flex w-full max-w-[680px] flex-1 flex-col items-start px-6 pt-16 pb-12 md:pt-28">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
          className="mb-6 font-mono text-[10px] uppercase tracking-[0.32em] text-foreground/45"
        >
          MYMYON — Vol. 04
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="font-display text-[44px] font-black leading-[0.92] tracking-tight md:text-[68px]"
          style={{ letterSpacing: "-0.045em" }}
        >
          Discover your fit.
          <br />
          <span className="text-primary">Not your size.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="mt-6 max-w-sm text-[15px] leading-relaxed text-foreground/60"
        >
          Wear your{" "}
          <MoodTicker
            onPick={(word) =>
              navigate(`/discover?mood=${encodeURIComponent(word)}&source=homepage`)
            }
          />
          .
        </motion.p>

        {/* Underline input */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="mt-10 w-full max-w-md"
        >
          <div
            className={`flex items-center gap-3 border-b py-2 transition-colors ${
              isFocused ? "border-primary" : "border-foreground/20"
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
              className="flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-foreground/35"
            />
            <button
              onClick={handleSubmit}
              disabled={!query.trim() || isLoading}
              aria-label={t("enter")}
              className="text-foreground/50 transition-colors hover:text-primary disabled:opacity-30"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            </button>
          </div>
        </motion.div>

        {/* Two ghost links */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.45, duration: 0.6 }}
          className="mt-10 flex items-center gap-6 text-[12px] font-semibold uppercase tracking-[0.22em]"
        >
          <button
            onClick={() => navigate("/discover")}
            className="border-b border-foreground pb-1 text-foreground transition-opacity hover:opacity-70"
          >
            Explore
          </button>
          <button
            onClick={() => navigate("/fit")}
            className="text-foreground/55 transition-colors hover:text-foreground"
          >
            Fit Hub →
          </button>
        </motion.div>

        {/* Quiet weather line */}
        {!weather.loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7, duration: 0.6 }}
            className="mt-12 font-mono text-[10px] uppercase tracking-[0.24em] text-foreground/40"
          >
            {weather.temp}° · {weatherLabel}
            {weather.location && !weather.error ? ` · ${weather.location}` : ""}
          </motion.div>
        )}
      </main>

      {/* Anchor portrait — quiet, no text overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5, duration: 1 }}
        className="mx-auto w-full max-w-[680px] px-6 pb-10"
      >
        <div className="aspect-[16/10] w-full overflow-hidden rounded-2xl bg-muted">
          <img
            src={heroPortrait}
            alt=""
            className="h-full w-full object-cover grayscale-[10%]"
            width={1080}
            height={675}
          />
        </div>
      </motion.div>
    </div>
  );
};

export default HomePage;
