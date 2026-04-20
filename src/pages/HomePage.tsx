/**
 * HomePage — desktop & mobile entry.
 *
 * Layout (top to bottom):
 *   [1] Hero transformation block (snap section on lg+)
 *   [2] Mood/search section — original centered input + weather
 *   [3] PND INC footer
 *
 * Performance:
 *  - Hero is its own snap section so the original mood entry stays
 *    one-tap-reachable on desktop via scroll-snap.
 *  - Search input + weather render immediately (no media dependency).
 */
import { useState, useRef, useCallback } from "react";
import { useI18n } from "@/lib/i18n";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Loader2, Search, Share2 } from "lucide-react";
import { toast } from "sonner";
import WeatherAmbience from "@/components/WeatherAmbience";
import { useWeather } from "@/hooks/useWeather";
import LanguageSelector from "@/components/LanguageSelector";
import Footer from "@/components/Footer";

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
      title: "WARDROBE — AI fashion stylist",
      text: "Discover your style on WARDROBE",
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
      // user cancelled — no-op
    }
  }, []);

  const weatherLabel = weather.condition
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background pb-20 md:pb-0">
      {/* Mood entry — fills remaining space above the footer */}
      <section className="relative flex flex-1 flex-col items-center justify-center overflow-hidden">
        <WeatherAmbience condition={weather.condition} />

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.5 }}
          className="absolute top-8 z-10 flex w-full items-center justify-between px-8 lg:hidden"
        >
          <span className="font-display text-[12px] font-semibold tracking-[0.4em] text-foreground md:text-[13px]">
            WARDROBE
          </span>
          <LanguageSelector />
        </motion.div>

        <div className="relative z-10 w-full max-w-[420px] px-6 sm:max-w-[460px] md:max-w-[520px]">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="relative"
          >
            {/* Pill search bar — magnifier left, submit arrow right */}
            <div
              className={`group relative flex items-center rounded-full border bg-background/60 backdrop-blur-md transition-all duration-300 ${
                isFocused
                  ? "border-accent/60 shadow-[0_0_0_4px_hsl(var(--accent)/0.08)]"
                  : "border-foreground/15 hover:border-foreground/25"
              }`}
            >
              <Search
                className={`ml-4 h-4 w-4 shrink-0 transition-colors ${
                  isFocused ? "text-accent" : "text-foreground/50"
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
                className="flex-1 bg-transparent px-3 py-3 font-display text-[15px] font-semibold tracking-tight text-foreground outline-none placeholder:text-foreground/70 placeholder:font-semibold md:py-3.5 md:text-[17px]"
              />
              <button
                onClick={handleSubmit}
                disabled={!query.trim() || isLoading}
                aria-label={t("enter")}
                className="mr-1.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-foreground text-background transition-all hover:bg-foreground/85 disabled:cursor-not-allowed disabled:bg-foreground/20 disabled:text-foreground/40 md:h-10 md:w-10"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="h-4 w-4" />
                )}
              </button>
            </div>

            {!weather.loading && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6, duration: 1 }}
                className="mt-4 text-center text-[10px] font-medium tracking-[0.18em] text-foreground/80 md:text-[11px]"
              >
                {weather.temp}° · {weatherLabel.toUpperCase()}
                {weather.location && !weather.error ? ` · ${weather.location.toUpperCase()}` : ""}
              </motion.p>
            )}
          </motion.div>
        </div>

        {/* Quick action buttons */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.8 }}
          className="absolute bottom-28 z-10 flex gap-4 md:bottom-32 lg:bottom-36"
        >
          <button
            onClick={() => navigate("/discover")}
            className="hover-burgundy rounded-lg border border-accent/15 bg-accent/[0.04] px-5 py-2.5 text-[11px] font-semibold tracking-[0.2em] text-foreground transition-all hover:bg-accent/[0.08]"
          >
            {t("exploreStyles").toUpperCase()}
          </button>
          <button
            onClick={() => navigate("/about")}
            className="hover-burgundy rounded-lg border border-border/30 px-5 py-2.5 text-[11px] font-semibold tracking-[0.2em] text-foreground transition-all hover:text-foreground"
          >
            {t("about").toUpperCase()}
          </button>
          <button
            onClick={handleShareApp}
            aria-label="Share WARDROBE with friends"
            className="hover-burgundy flex items-center gap-1.5 rounded-lg border border-accent/20 bg-accent/[0.06] px-5 py-2.5 text-[11px] font-semibold tracking-[0.2em] text-foreground transition-all hover:bg-accent/[0.1]"
          >
            <Share2 className="h-3 w-3" /> SHARE
          </button>
        </motion.div>
      </section>

      {/* [3] Footer — minimal PND INC mark */}
      <Footer />
    </div>
  );
};

export default HomePage;
