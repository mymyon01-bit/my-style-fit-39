import { useState, useRef, useCallback } from "react";
import { useI18n } from "@/lib/i18n";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Loader2 } from "lucide-react";
import WeatherAmbience from "@/components/WeatherAmbience";
import { useWeather } from "@/hooks/useWeather";

interface AiOutfitPiece {
  name: string;
  category: string;
  style: string;
  color: string;
}

const HomePage = () => {
  const { t } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const weather = useWeather();

  const handleSubmit = useCallback(async () => {
    if (!query.trim()) return;
    setIsLoading(true);
    setAiResponse(null);

    try {
      const { data, error } = await supabase.functions.invoke("wardrobe-ai", {
        body: {
          type: "mood-styling",
          context: {
            mood: query,
            weather: { temp: weather.temp, condition: weather.condition },
            location: weather.location,
            occasion: "daily",
          },
        },
      });
      if (error) throw error;
      setAiResponse(data?.response || "Something went wrong. Try again.");
    } catch (e) {
      console.error("AI error:", e);
      setAiResponse("Could not reach the stylist right now. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [query, weather]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSubmit();
  };

  const weatherLabel = weather.condition
    .replace(/-/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase());

  return (
    <div className="fixed inset-0 flex flex-col bg-background">
      <WeatherAmbience condition={weather.condition} />

      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-center px-6 pt-5">
        <span className="font-display text-[13px] font-semibold tracking-[0.25em] text-foreground/40">
          WARDROBE
        </span>
      </div>

      {/* Center content */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center overflow-y-auto px-6 pb-20">
        <AnimatePresence mode="wait">
          {!aiResponse ? (
            <motion.div
              key="input"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="w-full max-w-md"
            >
              <div className={`relative transition-all duration-500 ${isFocused ? "scale-[1.02]" : "scale-100"}`}>
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  onKeyDown={handleKeyDown}
                  placeholder={t("howAreYouFeeling")}
                  className={`w-full rounded-2xl border-0 bg-card/60 px-6 py-4.5 text-center font-display text-lg font-light tracking-wide text-foreground outline-none backdrop-blur-sm transition-all duration-500 placeholder:text-foreground/20 ${
                    isFocused
                      ? "shadow-[0_0_40px_-10px_hsl(var(--accent)_/_0.1)] ring-1 ring-foreground/5"
                      : "shadow-[0_2px_20px_-6px_hsl(0_0%_0%_/_0.06)]"
                  }`}
                />
                {isLoading && (
                  <div className="absolute right-5 top-1/2 -translate-y-1/2">
                    <Loader2 className="h-4 w-4 animate-spin text-foreground/20" />
                  </div>
                )}
              </div>

              <AnimatePresence>
                {query.length > 0 && !isLoading && (
                  <motion.button
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    onClick={handleSubmit}
                    className="mx-auto mt-4 block text-[11px] font-medium tracking-widest text-foreground/20 transition-colors hover:text-foreground/40"
                  >
                    PRESS ENTER ↵
                  </motion.button>
                )}
              </AnimatePresence>
            </motion.div>
          ) : (
            <motion.div
              key="response"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="w-full max-w-md space-y-6"
            >
              {/* AI Response */}
              <div className="rounded-2xl border border-foreground/[0.06] bg-card/40 p-6 backdrop-blur-sm">
                <p className="text-[10px] font-semibold tracking-[0.2em] text-accent/60 mb-3">YOUR STYLIST</p>
                <p className="font-display text-sm font-light leading-relaxed tracking-wide text-foreground/70 whitespace-pre-line">
                  {aiResponse}
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => navigate("/discover")}
                  className="flex-1 rounded-xl bg-foreground py-3 text-[11px] font-semibold tracking-[0.1em] text-background transition-opacity hover:opacity-90"
                >
                  EXPLORE PICKS
                </button>
                <button
                  onClick={() => navigate("/fit")}
                  className="flex-1 rounded-xl border border-foreground/10 py-3 text-[11px] font-semibold tracking-[0.1em] text-foreground/50 transition-colors hover:bg-foreground/5"
                >
                  CHECK FIT
                </button>
              </div>

              {/* Reset */}
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                onClick={() => { setAiResponse(null); setQuery(""); }}
                className="mx-auto block text-[10px] tracking-[0.15em] text-foreground/20 transition-colors hover:text-foreground/40"
              >
                ASK AGAIN
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Weather widget */}
      {!aiResponse && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.8 }}
          className="relative z-10 pb-20 text-center"
        >
          <p className="text-[12px] font-light tracking-[0.12em] text-foreground/25">
            {weather.loading
              ? "Detecting location…"
              : weather.error
                ? `${weather.temp}°C · ${weatherLabel}`
                : `${weather.location} · ${weather.temp}°C · ${weatherLabel}`}
          </p>
        </motion.div>
      )}
    </div>
  );
};

export default HomePage;
