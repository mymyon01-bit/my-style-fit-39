import { useState, useRef, useCallback } from "react";
import { useI18n } from "@/lib/i18n";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Loader2 } from "lucide-react";
import WeatherAmbience from "@/components/WeatherAmbience";
import { useWeather } from "@/hooks/useWeather";
import OutfitComposition from "@/components/OutfitComposition";
import { mockProducts } from "@/lib/mockData";
import {
  rankProducts, defaultUserProfile, defaultBodyProfile,
  defaultBehavior, getDefaultContext,
} from "@/lib/recommendation";

const HomePage = () => {
  const { t } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [moodContext, setMoodContext] = useState<string | null>(null);
  const weather = useWeather();

  // Generate visual recommendations based on mood
  const handleSubmit = useCallback(async () => {
    if (!query.trim()) return;
    setIsLoading(true);
    setMoodContext(query);

    // Small delay for feel
    await new Promise(r => setTimeout(r, 800));
    setIsLoading(false);
    setShowResults(true);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSubmit();
  };

  const weatherLabel = weather.condition.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());

  // Rank products using the mood as context
  const context = getDefaultContext(moodContext);
  context.weather = { temp: weather.temp, condition: weather.condition };
  const ranked = rankProducts(mockProducts, defaultUserProfile, defaultBodyProfile, context, defaultBehavior);
  const topPicks = ranked.slice(0, 4).map(p => ({
    id: p.id, label: p.name, category: p.category, image: p.image, brand: p.brand,
  }));

  return (
    <div className="min-h-screen bg-background">
      <section className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden">
        <WeatherAmbience condition={weather.condition} />

        {/* Brand mark — mobile + tablet only */}
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.5 }}
          className="absolute top-10 z-10 font-display text-[12px] font-medium tracking-[0.4em] text-foreground/35 md:text-[13px] lg:hidden"
        >
          WARDROBE
        </motion.span>

        {/* Input + Results */}
        <div className="relative z-10 w-full max-w-md px-8 sm:max-w-lg md:max-w-xl lg:max-w-2xl">
          <AnimatePresence mode="wait">
            {!showResults ? (
              <motion.div
                key="input"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
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
                  className={`w-full bg-transparent py-5 text-center font-display text-[22px] font-light tracking-wide text-foreground outline-none transition-all duration-700 placeholder:text-foreground/30 md:py-7 md:text-[26px] lg:py-8 lg:text-[32px] ${
                    isFocused ? "placeholder:text-foreground/18" : ""
                  }`}
                />
                <div className={`mx-auto h-px transition-all duration-700 ${
                  isFocused ? "w-full bg-foreground/12" : "w-1/3 bg-accent/[0.10]"
                }`} />

                {isLoading && (
                  <div className="mt-7 flex justify-center md:mt-8 lg:mt-10">
                    <Loader2 className="h-4 w-4 animate-spin text-foreground/25" />
                  </div>
                )}

                <AnimatePresence>
                  {query.length > 0 && !isLoading && (
                    <motion.button
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={handleSubmit}
                      className="mx-auto mt-7 block text-[10px] font-medium tracking-[0.25em] text-foreground/30 transition-colors hover:text-foreground/50 md:mt-8 md:text-[11px] lg:mt-10"
                    >
                      ENTER ↵
                    </motion.button>
                  )}
                </AnimatePresence>
              </motion.div>
            ) : (
              <motion.div
                key="results"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
                className="space-y-8 md:space-y-10"
              >
                <div className="text-center">
                  <p className="text-[10px] font-medium tracking-[0.3em] text-accent/70 mb-3 md:text-[11px]">
                    STYLED FOR "{moodContext?.toUpperCase()}"
                  </p>
                </div>

                {/* Visual outfit composition instead of text */}
                <OutfitComposition
                  pieces={topPicks}
                  caption={`A curated look for your ${moodContext} mood`}
                  tags={[moodContext || "", `${weather.temp}°`, weatherLabel]}
                />

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => navigate("/discover")}
                    className="flex-1 py-4 text-[10px] font-semibold tracking-[0.15em] text-foreground/70 transition-colors hover:text-foreground md:text-[11px]"
                  >
                    EXPLORE MORE
                  </button>
                  <div className="w-px bg-accent/[0.10]" />
                  <button
                    onClick={() => navigate("/fit")}
                    className="flex-1 py-4 text-[10px] font-semibold tracking-[0.15em] text-foreground/70 transition-colors hover:text-foreground md:text-[11px]"
                  >
                    CHECK FIT
                  </button>
                </div>

                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.8 }}
                  onClick={() => { setShowResults(false); setQuery(""); setMoodContext(null); }}
                  className="mx-auto block text-[9px] tracking-[0.3em] text-foreground/18 transition-colors hover:text-foreground/35"
                >
                  ASK AGAIN
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {!showResults && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8, duration: 1.2 }}
            className="absolute bottom-16 z-10 text-[11px] font-light tracking-[0.18em] text-foreground/30 md:bottom-20 md:text-[12px] lg:bottom-24 lg:text-[13px]"
          >
            {weather.loading
              ? "…"
              : weather.error
                ? `${weather.temp}° · ${weatherLabel}`
                : `${weather.location} · ${weather.temp}° · ${weatherLabel}`}
          </motion.p>
        )}
      </section>
    </div>
  );
};

export default HomePage;
