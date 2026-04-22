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
import { useState, useRef, useCallback } from "react";
import { useI18n } from "@/lib/i18n";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Loader2, Sparkles, Share2, Zap } from "lucide-react";
import { toast } from "sonner";
import WeatherAmbience from "@/components/WeatherAmbience";
import { useWeather } from "@/hooks/useWeather";
import LanguageSelector from "@/components/LanguageSelector";
import Footer from "@/components/Footer";

const TICKER_WORDS = ["mood", "weather", "moment", "story", "mood"];
const MARQUEE_WORDS = ["WEAR YOUR MOOD", "★", "AI STYLIST", "★", "MADE IN 2026", "★", "MYMYON", "★", "TRY IT ON", "★", "FEEL FIRST"];

const HomePage = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const weather = useWeather();

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

  const handleShareApp = useCallback(async () => {
    const shareData = {
      title: "mymyon — AI fashion stylist",
      text: "Discover your style on mymyon",
      url: typeof window !== "undefined" ? window.location.origin : "https://mymyon.com",
    };
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share(shareData);
      } else if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(shareData.url);
        toast.success("Link copied — share with friends");
      }
    } catch {
      // user cancelled
    }
  }, []);

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
          className="absolute top-6 z-20 flex w-full items-center justify-between px-6 lg:hidden"
        >
          <span className="flex items-baseline font-display text-[18px] italic font-medium leading-none text-foreground">
            <span className="tracking-[-0.04em]">my</span>
            <span aria-hidden className="mx-[0.18em] inline-block h-[5px] w-[5px] translate-y-[-0.55em] rounded-full bg-accent" />
            <span className="tracking-[-0.04em]">myon</span>
          </span>
          <LanguageSelector />
        </motion.div>

        {/* Main column */}
        <div className="relative z-10 mx-auto w-full max-w-[640px] px-6 pt-20 lg:pt-0">
          {/* Top label — mono tag */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mb-8 flex items-center justify-center gap-3"
          >
            <span className="h-px w-8 bg-foreground/40" />
            <span className="label-mono text-foreground/70">
              <Zap className="mr-1 inline h-3 w-3" />
              AI STYLIST · EST. 2026
            </span>
            <span className="h-px w-8 bg-foreground/40" />
          </motion.div>

          {/* Oversized italic display headline with rotating ticker */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="text-center font-display text-[44px] font-medium italic leading-[0.92] tracking-[-0.05em] text-foreground sm:text-[58px] md:text-[78px] lg:text-[94px]"
          >
            <span className="block">wear your</span>
            <span
              className="relative inline-block h-[1em] overflow-hidden align-bottom"
              style={{ width: "4.2ch" }}
              aria-label="mood, weather, moment, story"
            >
              <span className="ticker-track text-gradient">
                {TICKER_WORDS.map((w, i) => (
                  <span key={i} className="block leading-[1em]">
                    {w}
                  </span>
                ))}
              </span>
            </span>
          </motion.h1>

          {/* Sub */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="mx-auto mt-6 max-w-md text-center text-[14px] font-medium leading-relaxed text-foreground/70 md:text-[15px]"
          >
            Type how you feel. We turn it into outfits — fitted, sized, ready.
          </motion.p>

          {/* Brutalist command bar */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="mt-10"
          >
            <div
              className={`luxe-command group flex items-center gap-3 px-5 py-3 ${
                isFocused ? "" : ""
              }`}
            >
              <Sparkles
                className={`h-4 w-4 shrink-0 transition-all duration-300 ${
                  isFocused ? "text-primary scale-110" : "text-foreground/50"
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
                className="flex-1 bg-transparent py-2 font-display text-[18px] font-medium tracking-tight text-foreground outline-none placeholder:text-foreground/35 placeholder:italic placeholder:font-light md:text-[22px]"
              />
              <button
                onClick={handleSubmit}
                disabled={!query.trim() || isLoading}
                aria-label={t("enter")}
                className="flex h-10 w-10 shrink-0 items-center justify-center border-[1.5px] border-foreground bg-foreground text-background transition-all duration-200 hover:bg-primary hover:text-primary-foreground disabled:cursor-not-allowed disabled:border-foreground/15 disabled:bg-transparent disabled:text-foreground/30"
                style={{ borderRadius: "var(--radius)" }}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="h-4 w-4" />
                )}
              </button>
            </div>

            {/* Weather meta */}
            {!weather.loading && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7, duration: 0.8 }}
                className="mt-4 text-center label-mono text-foreground/65"
              >
                <span className="inline-block h-1.5 w-1.5 translate-y-[-1px] rounded-full bg-primary mr-2 animate-pulse" />
                {weather.temp}° · {weatherLabel.toUpperCase()}
                {weather.location && !weather.error ? ` · ${weather.location.toUpperCase()}` : ""}
              </motion.p>
            )}
          </motion.div>

          {/* Quick action pill row */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7, duration: 0.6 }}
            className="mt-12 flex flex-wrap items-center justify-center gap-3"
          >
            <button
              onClick={() => navigate("/discover")}
              className="btn-brutalist"
            >
              {t("exploreStyles")}
              <ArrowRight className="h-3 w-3" />
            </button>
            <button
              onClick={() => navigate("/about")}
              className="border-[1.5px] border-foreground/20 px-5 py-3 label-mono text-foreground/75 transition-all duration-200 hover:border-foreground hover:bg-foreground hover:text-background"
              style={{ borderRadius: "var(--radius)" }}
            >
              {t("about")}
            </button>
            <button
              onClick={handleShareApp}
              aria-label="Share mymyon with friends"
              className="flex items-center gap-2 border-[1.5px] border-foreground/20 px-5 py-3 label-mono text-foreground/75 transition-all duration-200 hover:border-accent hover:bg-accent hover:text-accent-foreground"
              style={{ borderRadius: "var(--radius)" }}
            >
              <Share2 className="h-3 w-3" /> SHARE
            </button>
          </motion.div>
        </div>

        {/* Bottom marquee — manifesto */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.8 }}
          className="absolute bottom-6 left-0 right-0 z-10 lg:bottom-10"
        >
          <div className="marquee py-3 border-y border-foreground/10 bg-background/30 backdrop-blur-sm">
            {[0, 1].map((dup) => (
              <div key={dup} className="marquee-track" aria-hidden={dup === 1}>
                {MARQUEE_WORDS.map((word, i) => (
                  <span
                    key={i}
                    className={`label-mono whitespace-nowrap ${
                      word === "★" ? "text-accent" : "text-foreground/70"
                    }`}
                  >
                    {word}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      <Footer />
    </div>
  );
};

export default HomePage;
