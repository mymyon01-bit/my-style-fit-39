import { useState, useRef, useCallback } from "react";
import { useI18n } from "@/lib/i18n";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth";
import { ArrowRight, Loader2 } from "lucide-react";
import WeatherAmbience from "@/components/WeatherAmbience";
import { useWeather } from "@/hooks/useWeather";
import LanguageSelector from "@/components/LanguageSelector";

const HomePage = () => {
  const { t } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const weather = useWeather();

  const handleSubmit = useCallback(async () => {
    if (!query.trim()) return;
    setIsLoading(true);
    await new Promise(r => setTimeout(r, 600));
    setIsLoading(false);
    navigate(`/discover?mood=${encodeURIComponent(query.trim())}&source=homepage`);
  }, [query, navigate]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSubmit();
  };

  const weatherLabel = weather.condition.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());

  return (
    <div className="min-h-screen bg-background">
      <section className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden">
        <WeatherAmbience condition={weather.condition} />

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.5 }}
          className="absolute top-8 z-10 flex w-full items-center justify-between px-8 lg:hidden"
        >
          <span className="font-display text-[12px] font-semibold tracking-[0.4em] text-foreground/60 md:text-[13px]">
            WARDROBE
          </span>
          <LanguageSelector />
        </motion.div>

        <div className="relative z-10 w-full max-w-md px-8 sm:max-w-lg md:max-w-xl lg:max-w-2xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              onKeyDown={handleKeyDown}
              placeholder={t("howAreYouFeeling")}
              className={`w-full bg-transparent py-5 text-center font-display text-[22px] font-light tracking-wide text-foreground outline-none transition-all duration-700 placeholder:text-foreground/50 md:py-7 md:text-[26px] lg:py-8 lg:text-[32px] ${
                isFocused ? "placeholder:text-foreground/35" : ""
              }`}
            />
            <div className={`mx-auto h-px transition-all duration-700 ${
              isFocused ? "w-full bg-foreground/12" : "w-1/3 bg-accent/20"
            }`} />

            {isLoading && (
              <div className="mt-7 flex justify-center md:mt-8 lg:mt-10">
                <Loader2 className="h-4 w-4 animate-spin text-foreground/50" />
              </div>
            )}

            <AnimatePresence>
              {query.length > 0 && !isLoading && (
                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={handleSubmit}
                  className="hover-burgundy mx-auto mt-7 flex items-center gap-2 text-[10px] font-semibold tracking-[0.25em] text-foreground/60 md:mt-8 lg:mt-10"
                >
                  ENTER
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
            className="hover-burgundy rounded-lg border border-accent/15 bg-accent/[0.04] px-5 py-2.5 text-[9px] font-semibold tracking-[0.2em] text-foreground/50 transition-all hover:bg-accent/[0.08]"
          >
            EXPLORE STYLES
          </button>
          <button
            onClick={() => navigate("/about")}
            className="hover-burgundy rounded-lg border border-border/30 px-5 py-2.5 text-[9px] font-semibold tracking-[0.2em] text-foreground/35 transition-all hover:text-foreground/50"
          >
            ABOUT
          </button>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 1.2 }}
          className="absolute bottom-14 z-10 text-[11px] font-medium tracking-[0.18em] text-foreground/40 md:bottom-18 md:text-[12px] lg:bottom-22 lg:text-[13px]"
        >
          {weather.loading
            ? "…"
            : weather.error
              ? `${weather.temp}° · ${weatherLabel}`
              : `${weather.location} · ${weather.temp}° · ${weatherLabel}`}
        </motion.p>
      </section>
    </div>
  );
};

export default HomePage;
