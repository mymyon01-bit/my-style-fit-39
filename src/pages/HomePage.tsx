import { useState, useRef, useCallback } from "react";
import { useI18n } from "@/lib/i18n";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Loader2, Scan, Camera, ChevronRight, ArrowRight } from "lucide-react";
import WeatherAmbience from "@/components/WeatherAmbience";
import { useWeather } from "@/hooks/useWeather";
import DailyPicks from "@/components/DailyPicks";
import WeeklyPlan from "@/components/WeeklyPlan";

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
    <div className="min-h-screen bg-background">
      {/* ─── HERO ─── */}
      <section className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden">
        <WeatherAmbience condition={weather.condition} />

        {/* Logo */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.2 }}
          className="absolute top-8 z-10"
        >
          <span className="font-display text-[11px] font-semibold tracking-[0.35em] text-foreground/50 sm:text-[13px]">
            WARDROBE
          </span>
        </motion.div>

        {/* Center */}
        <div className="relative z-10 w-full max-w-lg px-6">
          <AnimatePresence mode="wait">
            {!aiResponse ? (
              <motion.div
                key="input"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="space-y-6"
              >
                <div className={`relative transition-all duration-500 ${isFocused ? "scale-[1.01]" : ""}`}>
                  <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    onKeyDown={handleKeyDown}
                    placeholder={t("howAreYouFeeling")}
                    className={`w-full rounded-2xl border-0 bg-card/50 px-7 py-5 text-center font-display text-lg font-light tracking-wide text-foreground outline-none backdrop-blur-md transition-all duration-500 placeholder:text-foreground/30 sm:text-xl ${
                      isFocused
                        ? "shadow-[0_0_60px_-12px_hsl(var(--accent)_/_0.12)] ring-1 ring-accent/10"
                        : "shadow-elevated"
                    }`}
                  />
                  {isLoading && (
                    <div className="absolute right-6 top-1/2 -translate-y-1/2">
                      <Loader2 className="h-4 w-4 animate-spin text-foreground/30" />
                    </div>
                  )}
                </div>

                <AnimatePresence>
                  {query.length > 0 && !isLoading && (
                    <motion.button
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 6 }}
                      onClick={handleSubmit}
                      className="mx-auto block text-[10px] font-medium tracking-[0.2em] text-foreground/30 transition-colors hover:text-foreground/50"
                    >
                      PRESS ENTER ↵
                    </motion.button>
                  )}
                </AnimatePresence>
              </motion.div>
            ) : (
              <motion.div
                key="response"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7 }}
                className="space-y-6"
              >
                <div className="rounded-2xl border border-foreground/[0.04] bg-card/50 p-7 backdrop-blur-md shadow-elevated">
                  <p className="text-[9px] font-semibold tracking-[0.25em] text-accent mb-4">YOUR STYLIST</p>
                  <p className="font-display text-[15px] font-light leading-[1.8] tracking-wide text-foreground/85 whitespace-pre-line">
                    {aiResponse}
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => navigate("/discover")}
                    className="flex-1 rounded-xl bg-foreground py-3.5 text-[10px] font-semibold tracking-[0.12em] text-background transition-opacity hover:opacity-90"
                  >
                    EXPLORE PICKS
                  </button>
                  <button
                    onClick={() => navigate("/fit")}
                    className="flex-1 rounded-xl border border-foreground/8 py-3.5 text-[10px] font-semibold tracking-[0.12em] text-foreground/60 transition-colors hover:bg-foreground/[0.03]"
                  >
                    CHECK FIT
                  </button>
                </div>

                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6 }}
                  onClick={() => { setAiResponse(null); setQuery(""); }}
                  className="mx-auto block text-[9px] tracking-[0.2em] text-foreground/25 transition-colors hover:text-foreground/45"
                >
                  ASK AGAIN
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Weather pill */}
        {!aiResponse && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 1 }}
            className="absolute bottom-12 z-10"
          >
            <p className="text-[11px] font-light tracking-[0.15em] text-foreground/35">
              {weather.loading
                ? "Detecting location…"
                : weather.error
                  ? `${weather.temp}°C · ${weatherLabel}`
                  : `${weather.location} · ${weather.temp}°C · ${weatherLabel}`}
            </p>
          </motion.div>
        )}
      </section>

      {/* ─── SCROLLABLE CONTENT ─── */}
      <div className="relative z-10 mx-auto max-w-lg space-y-16 px-6 pb-28 pt-8 sm:max-w-xl md:max-w-2xl">

        {/* Today's Picks */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6 }}
        >
          <DailyPicks />
        </motion.section>

        {/* Weekly Plan */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6 }}
        >
          <WeeklyPlan />
        </motion.section>

        {/* Try FIT */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6 }}
        >
          <button
            onClick={() => navigate("/fit")}
            className="group flex w-full items-center gap-5 rounded-2xl border border-foreground/[0.04] bg-card/40 p-6 text-left transition-all hover:bg-card/60 hover:shadow-elevated"
          >
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-accent/8">
              <Scan className="h-5 w-5 text-accent" />
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-semibold tracking-[0.2em] text-foreground/40">BODY FIT</p>
              <p className="mt-1 text-sm text-foreground/70">Find your perfect size with AI body analysis</p>
            </div>
            <ChevronRight className="h-4 w-4 text-foreground/15 transition-transform group-hover:translate-x-0.5" />
          </button>
        </motion.section>

        {/* OOTD Community */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6 }}
        >
          <button
            onClick={() => navigate("/ootd")}
            className="group flex w-full items-center gap-5 rounded-2xl border border-foreground/[0.04] bg-card/40 p-6 text-left transition-all hover:bg-card/60 hover:shadow-elevated"
          >
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-accent/8">
              <Camera className="h-5 w-5 text-accent" />
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-semibold tracking-[0.2em] text-foreground/40">OOTD</p>
              <p className="mt-1 text-sm text-foreground/70">Share your look. Discover community style.</p>
            </div>
            <ChevronRight className="h-4 w-4 text-foreground/15 transition-transform group-hover:translate-x-0.5" />
          </button>
        </motion.section>

        {/* Sign Up CTA — only for guests */}
        {!user && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.6 }}
          >
            <div className="rounded-2xl border border-accent/15 bg-accent/[0.04] p-8 text-center space-y-4">
              <p className="font-display text-xl font-semibold text-foreground sm:text-2xl">
                Your style, remembered.
              </p>
              <p className="mx-auto max-w-xs text-sm leading-relaxed text-foreground/45">
                Create a free account to save your preferences, unlock daily AI styling, and get a 3-month Premium trial.
              </p>
              <button
                onClick={() => navigate("/auth")}
                className="inline-flex items-center gap-2 rounded-xl bg-accent px-6 py-3 text-[11px] font-semibold tracking-[0.1em] text-white transition-opacity hover:opacity-90"
              >
                GET STARTED <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </motion.section>
        )}

        {/* Footer */}
        <div className="pt-8 pb-4 text-center">
          <span className="font-display text-[10px] tracking-[0.3em] text-foreground/15">WARDROBE</span>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
