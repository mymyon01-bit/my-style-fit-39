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
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Loader2 } from "lucide-react";
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
            {/* Edgy corner label */}
            <div className="mb-3 flex items-center gap-2">
              <span className="h-px w-6 bg-accent/60" />
              <span className="font-display text-[9px] font-bold uppercase tracking-[0.4em] text-accent/90">
                Tell us
              </span>
            </div>

            {/* Prompt frame — sharp corners, asymmetric accent */}
            <div className="relative border border-foreground/15 bg-background/40 backdrop-blur-sm">
              {/* corner ticks */}
              <span className="absolute -left-[1px] -top-[1px] h-2 w-2 border-l border-t border-accent" />
              <span className="absolute -right-[1px] -top-[1px] h-2 w-2 border-r border-t border-accent" />
              <span className="absolute -bottom-[1px] -left-[1px] h-2 w-2 border-b border-l border-accent" />
              <span className="absolute -bottom-[1px] -right-[1px] h-2 w-2 border-b border-r border-accent" />

              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                onKeyDown={handleKeyDown}
                placeholder={t("howAreYouFeeling")}
                className="w-full bg-transparent px-5 py-5 text-center font-display text-[18px] font-semibold tracking-tight text-foreground outline-none placeholder:text-foreground/85 placeholder:font-semibold md:px-6 md:py-6 md:text-[22px]"
              />
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

            {isLoading && (
              <div className="mt-6 flex justify-center">
                <Loader2 className="h-4 w-4 animate-spin text-foreground/70" />
              </div>
            )}

            <AnimatePresence>
              {query.length > 0 && !isLoading && (
                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={handleSubmit}
                  className="hover-burgundy mx-auto mt-6 flex items-center gap-2 text-[10px] font-semibold tracking-[0.3em] text-foreground"
                >
                  {t("enter").toUpperCase()}
                  <ArrowRight className="h-3.5 w-3.5" />
                </motion.button>
              )}
            </AnimatePresence>
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
        </motion.div>
      </section>

      {/* [3] Footer — minimal PND INC mark */}
      <Footer />
    </div>
  );
};

export default HomePage;
