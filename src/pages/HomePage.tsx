import { useState, useRef, useCallback } from "react";
import { useI18n } from "@/lib/i18n";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth";
import { Loader2 } from "lucide-react";
import WeatherAmbience from "@/components/WeatherAmbience";
import { useWeather } from "@/hooks/useWeather";

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
    // Navigate to discover with mood as query param
    navigate(`/discover?mood=${encodeURIComponent(query.trim())}`);
  }, [query, navigate]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSubmit();
  };

  const weatherLabel = weather.condition.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());

  return (
    <div className="min-h-screen bg-background">
      <section className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden">
        <WeatherAmbience condition={weather.condition} />

        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.5 }}
          className="absolute top-10 z-10 font-display text-[12px] font-medium tracking-[0.4em] text-foreground/68 md:text-[13px] lg:hidden"
        >
          WARDROBE
        </motion.span>

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
              className={`w-full bg-transparent py-5 text-center font-display text-[22px] font-light tracking-wide text-foreground outline-none transition-all duration-700 placeholder:text-foreground/80 md:py-7 md:text-[26px] lg:py-8 lg:text-[32px] ${
                isFocused ? "placeholder:text-foreground/68" : ""
              }`}
            />
            <div className={`mx-auto h-px transition-all duration-700 ${
              isFocused ? "w-full bg-foreground/12" : "w-1/3 bg-accent/[0.16]"
            }`} />

            {isLoading && (
              <div className="mt-7 flex justify-center md:mt-8 lg:mt-10">
                <Loader2 className="h-4 w-4 animate-spin text-foreground/62" />
              </div>
            )}

            <AnimatePresence>
              {query.length > 0 && !isLoading && (
                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={handleSubmit}
                  className="mx-auto mt-7 block text-[10px] font-medium tracking-[0.25em] text-foreground/80 transition-colors hover:text-foreground/80 md:mt-8 md:text-[11px] lg:mt-10"
                >
                  ENTER ↵
                </motion.button>
              )}
            </AnimatePresence>
          </motion.div>
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 1.2 }}
          className="absolute bottom-16 z-10 text-[11px] font-light tracking-[0.18em] text-foreground/80 md:bottom-20 md:text-[12px] lg:bottom-24 lg:text-[13px]"
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
