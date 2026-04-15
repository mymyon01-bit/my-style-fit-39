import { useState, useEffect, useRef, useCallback } from "react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

// Ambient weather particles
const WeatherAmbience = ({ condition }: { condition: string }) => {
  if (condition === "rain" || condition === "light-rain") {
    return (
      <div className="pointer-events-none fixed inset-0 overflow-hidden opacity-[0.04]">
        {Array.from({ length: 40 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute h-12 w-px bg-foreground"
            style={{ left: `${Math.random() * 100}%`, top: `-${Math.random() * 20}%` }}
            animate={{ y: ["0vh", "120vh"] }}
            transition={{ duration: 1.5 + Math.random(), repeat: Infinity, delay: Math.random() * 2, ease: "linear" }}
          />
        ))}
      </div>
    );
  }
  if (condition === "snow") {
    return (
      <div className="pointer-events-none fixed inset-0 overflow-hidden opacity-[0.06]">
        {Array.from({ length: 25 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute h-1.5 w-1.5 rounded-full bg-foreground"
            style={{ left: `${Math.random() * 100}%`, top: `-5%` }}
            animate={{ y: ["0vh", "105vh"], x: [0, Math.sin(i) * 30] }}
            transition={{ duration: 8 + Math.random() * 6, repeat: Infinity, delay: Math.random() * 5, ease: "linear" }}
          />
        ))}
      </div>
    );
  }
  if (condition === "sunny" || condition === "clear") {
    return (
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-gradient-to-b from-[hsl(40_60%_95%_/_0.03)] via-transparent to-transparent dark:from-[hsl(40_40%_20%_/_0.04)]" />
      </div>
    );
  }
  return null;
};

const HomePage = () => {
  const { t } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [weather] = useState({ temp: 22, condition: "partly-cloudy", location: "Seoul" });

  const handleSubmit = useCallback(async () => {
    if (!query.trim()) return;

    setIsLoading(true);
    setAiResponse(null);

    try {
      const { data, error } = await supabase.functions.invoke("ai-stylist", {
        body: {
          mood: query,
          weather: { temp: weather.temp, condition: weather.condition },
          location: weather.location,
          styles: ["minimal", "clean"],
          bodyType: "balanced proportions",
          occasion: "daily",
        },
      });

      if (error) throw error;
      setAiResponse(data?.response || "Let me think about your style today...");
    } catch (err) {
      console.error("AI stylist error:", err);
      setAiResponse("Take it easy today — soft layers, neutral palette, comfortable silhouettes. Let the clothes breathe with you.");
    }
    setIsLoading(false);
  }, [query, weather]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSubmit();
  };

  // Derive weather display
  const weatherLabel = weather.condition
    .replace(/-/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase());

  return (
    <div className="fixed inset-0 flex flex-col bg-background">
      <WeatherAmbience condition={weather.condition} />

      {/* Subtle top bar — only sign up for guests */}
      <div className="relative z-10 flex items-center justify-between px-6 pt-5">
        <span className="font-display text-[13px] font-semibold tracking-[0.25em] text-foreground/40">
          WARDROBE
        </span>
        {!user ? (
          <button
            onClick={() => navigate("/auth")}
            className="text-[11px] font-medium tracking-wide text-foreground/30 transition-colors hover:text-foreground/60"
          >
            Sign in
          </button>
        ) : (
          <button
            onClick={() => navigate("/discover")}
            className="text-[11px] font-medium tracking-wide text-foreground/30 transition-colors hover:text-foreground/60"
          >
            Browse →
          </button>
        )}
      </div>

      {/* Center content */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-8">
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
              {/* AI Input */}
              <div
                className={`relative transition-all duration-500 ${
                  isFocused ? "scale-[1.02]" : "scale-100"
                }`}
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

              {/* Submit hint */}
              <AnimatePresence>
                {query.length > 0 && (
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
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="w-full max-w-md"
            >
              {/* AI Response */}
              <p className="text-center font-display text-lg font-light leading-relaxed tracking-wide text-foreground/80">
                {aiResponse}
              </p>

              {/* Actions */}
              <div className="mt-10 flex flex-col items-center gap-3">
                <button
                  onClick={() => navigate("/discover")}
                  className="text-[12px] font-semibold tracking-[0.15em] text-foreground/50 transition-colors hover:text-foreground/80"
                >
                  EXPLORE PICKS →
                </button>
                <button
                  onClick={() => {
                    setAiResponse(null);
                    setQuery("");
                  }}
                  className="text-[11px] tracking-wide text-foreground/20 transition-colors hover:text-foreground/40"
                >
                  ask again
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Weather widget — bottom center */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.8 }}
        className="relative z-10 pb-10 text-center"
      >
        <p className="text-[12px] font-light tracking-[0.12em] text-foreground/25">
          {weather.location} · {weather.temp}°C · {weatherLabel}
        </p>
      </motion.div>
    </div>
  );
};

export default HomePage;
