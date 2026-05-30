/**
 * HomePage — editorial redesign (MYMYON v2).
 *
 * Layout inspired by the reference: split hero (headline left, portrait
 * right), AI-driven CTA row, then quick links into the 5 core sections.
 * Keeps every existing function — mood search → /discover, weather pill,
 * language picker, share, install prompt, OOTD diary, StyleMe quiz, auth.
 */
import { useState, useRef, useCallback, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Loader2,
  Download,
  LogIn,
  User as UserIcon,
  Handshake,
  Compass,
  Sparkles,
  Camera,
  Users,
} from "lucide-react";
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
import heroPortrait from "@/assets/home-hero.jpg";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const sections = [
  { to: "/discover", label: "Discover", caption: "Shop", icon: Compass },
  { to: "/fit", label: "Fit Hub", caption: "Try & Analyse", icon: Sparkles },
  { to: "/ootd", label: "OOTD Feed", caption: "Inspire", icon: Camera },
  { to: "/profile", label: "My Closet", caption: "Manage", icon: Users },
];

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
    await new Promise((r) => setTimeout(r, 300));
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
      <WeatherAmbience condition={weather.condition} isNight={weather.isNight} />

      {/* ── Top bar ── */}
      <header className="relative z-20 flex w-full items-center justify-between px-5 pt-4 md:px-10 md:pt-6">
        <Brandmark variant="inline" size={22} />
        <div className="flex items-center gap-2">
          <button
            onClick={handleInstall}
            aria-label="Install app"
            className="flex h-8 w-8 items-center justify-center rounded-full text-foreground/55 transition-colors hover:text-foreground"
          >
            <Download className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => navigate(user ? "/profile" : "/auth")}
            aria-label={user ? "Profile" : "Sign in"}
            className="flex h-8 items-center gap-1.5 rounded-full border border-border px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/75 transition-colors hover:border-primary/60 hover:text-primary"
          >
            {user ? <UserIcon className="h-3 w-3" /> : <LogIn className="h-3 w-3" />}
            <span>{user ? "Me" : "Sign in"}</span>
          </button>
          <LanguageSelector />
        </div>
      </header>

      {/* ── Editorial hero ── */}
      <section className="relative mx-auto w-full max-w-[1240px] px-5 pt-8 pb-10 md:px-10 md:pt-16 md:pb-20">
        <div className="grid items-center gap-8 md:grid-cols-[1.05fr_1fr] md:gap-14">
          {/* Left — text */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="order-2 md:order-1"
          >
            <div className="mb-5 flex items-center gap-2">
              <span className="h-1 w-1 rounded-full bg-primary" />
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.32em] text-foreground/55">
                Vol.04 — Drop
              </span>
            </div>

            <h1
              className="font-display text-[44px] font-black leading-[0.92] tracking-tight text-foreground sm:text-[58px] md:text-[72px]"
              style={{ letterSpacing: "-0.045em" }}
            >
              <span className="block">Discover your fit.</span>
              <span className="block text-primary">Not your size.</span>
            </h1>

            <p className="mt-5 max-w-md text-[15px] leading-relaxed text-foreground/65 md:text-[16px]">
              AI understands your body, finds what fits you best.{" "}
              <span className="block sm:inline">
                Wear your{" "}
                <MoodTicker
                  onPick={(word) =>
                    navigate(`/discover?mood=${encodeURIComponent(word)}&source=homepage`)
                  }
                />
                .
              </span>
            </p>

            {/* Command bar */}
            <div className="mt-7 max-w-md">
              <div
                className={`flex items-center gap-3 rounded-full border bg-card/70 px-5 py-2.5 backdrop-blur-md transition-all ${
                  isFocused
                    ? "border-primary/60 shadow-[0_0_0_4px_hsl(var(--primary)/0.12)]"
                    : "border-border"
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
                  className="flex-1 bg-transparent py-1.5 text-[15px] font-medium text-foreground outline-none placeholder:text-foreground/40"
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
            </div>

            {/* Primary CTAs */}
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                onClick={() => navigate("/discover")}
                className="inline-flex h-11 items-center gap-2 rounded-full bg-foreground px-6 text-[13px] font-semibold text-background transition-transform hover:scale-[1.02]"
              >
                Explore Now <ArrowRight className="h-4 w-4" />
              </button>
              <button
                onClick={() => navigate("/fit")}
                className="inline-flex h-11 items-center gap-2 rounded-full border border-border bg-card/50 px-6 text-[13px] font-semibold text-foreground/85 transition-colors hover:border-primary/60 hover:text-primary"
              >
                Try Fit Hub
              </button>
              <StyleMeButton variant="pill" />
            </div>

            {/* Weather + diary */}
            <div className="mt-6 flex flex-wrap items-center gap-4">
              {!weather.loading && (
                <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.24em] text-foreground/50">
                  <span className="h-1 w-1 rounded-full bg-primary/70" />
                  <span>
                    {weather.temp}° · {weatherLabel}
                    {weather.location && !weather.error ? ` · ${weather.location}` : ""}
                  </span>
                </div>
              )}
              <div className="md:hidden">
                <OOTDDiaryButton compact />
              </div>
            </div>
          </motion.div>

          {/* Right — portrait */}
          <motion.div
            initial={{ opacity: 0, scale: 1.02 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            className="order-1 md:order-2"
          >
            <div className="relative aspect-[3/4] w-full overflow-hidden rounded-3xl bg-muted shadow-elevated">
              <img
                src={heroPortrait}
                alt="Editorial fashion portrait"
                className="h-full w-full object-cover"
                width={1080}
                height={1440}
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/40 via-transparent to-transparent" />
              {/* Floating tag */}
              <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-full border border-background/30 bg-background/70 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-foreground/80 backdrop-blur-md">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                Editorial · AW
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Section tiles — quick paths into the 5 cores ── */}
      <section className="mx-auto w-full max-w-[1240px] px-5 pb-12 md:px-10 md:pb-20">
        <div className="mb-5 flex items-end justify-between">
          <h2 className="font-display text-[22px] font-black tracking-tight md:text-[28px]">
            Where to next.
          </h2>
          <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-foreground/45">
            5 core spaces
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {sections.map(({ to, label, caption, icon: Icon }, i) => (
            <motion.button
              key={to}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * i, duration: 0.5 }}
              onClick={() => navigate(to)}
              className="group relative flex h-[140px] flex-col justify-between overflow-hidden rounded-2xl border border-border bg-card/60 p-5 text-left transition-all hover:border-primary/50 hover:shadow-soft"
            >
              <Icon className="h-5 w-5 text-foreground/55 transition-colors group-hover:text-primary" strokeWidth={1.5} />
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-foreground/45">
                  {caption}
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="font-display text-[20px] font-bold tracking-tight">
                    {label}
                  </span>
                  <ArrowRight className="h-4 w-4 text-foreground/40 transition-all group-hover:translate-x-1 group-hover:text-primary" />
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      </section>

      {/* ── Footer actions ── */}
      <div className="mx-auto mt-auto flex w-full max-w-[1240px] flex-wrap items-center justify-center gap-3 px-5 pb-8 md:px-10 md:pb-10">
        <button
          onClick={() => setAffOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-foreground/60 transition-colors hover:border-primary/50 hover:text-primary"
        >
          <Handshake className="h-3 w-3" />
          Affiliate
        </button>
        <ShareButton
          title="Share, Explore, and Edge your style. Join My'myon."
          url="https://www.mymyon.com"
          label="Share"
        />
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event("mymyon:open-tour"))}
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-foreground/60 transition-colors hover:border-accent hover:text-accent"
        >
          <span className="font-mono italic">i</span>
          Intro
        </button>
      </div>

      <ContactUsDialog open={affOpen} onOpenChange={setAffOpen} topic="Affiliate / Ad" />

      <div className="hidden md:block">
        <Footer />
      </div>
    </div>
  );
};

export default HomePage;
