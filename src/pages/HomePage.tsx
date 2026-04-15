import { useState, useRef, useCallback } from "react";
import { useI18n } from "@/lib/i18n";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import WeatherAmbience from "@/components/WeatherAmbience";
import OutfitComposition from "@/components/OutfitComposition";
import { mockProducts } from "@/lib/mockData";

// Build an outfit from weather context
const buildOutfit = (condition: string) => {
  const tops = mockProducts.filter(p => p.category === "tops");
  const bottoms = mockProducts.filter(p => p.category === "bottoms");
  const shoes = mockProducts.filter(p => p.category === "shoes");
  const outerwear = mockProducts.filter(p => p.category === "outerwear");

  const needsOuterwear = ["rain", "light-rain", "snow", "cloudy", "storm", "cold"].some(c => condition.includes(c));

  const pieces = [
    { ...tops[0], label: tops[0].name, category: "tops" },
    ...(needsOuterwear && outerwear.length > 0
      ? [{ ...outerwear[0], label: outerwear[0].name, category: "outerwear" }]
      : [{ ...mockProducts.find(p => p.category === "accessories")!, label: "Canvas Tote", category: "accessories" }]),
    { ...bottoms[0], label: bottoms[0].name, category: "bottoms" },
    { ...shoes[0], label: shoes[0].name, category: "shoes" },
  ];

  return pieces;
};

const HomePage = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [aiCaption, setAiCaption] = useState<string | null>(null);
  const [outfitPieces, setOutfitPieces] = useState<any[] | null>(null);
  const [weather] = useState({ temp: 22, condition: "partly-cloudy", location: "Seoul" });

  const handleSubmit = useCallback(async () => {
    if (!query.trim()) return;
    setIsLoading(true);
    setAiCaption(null);
    setOutfitPieces(null);

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
      setAiCaption(data?.response?.split("\n")[0] || "A look that fits your mood.");
    } catch {
      setAiCaption("Clean silhouette that works with your body and today's weather.");
    }

    // Build visual outfit
    setOutfitPieces(buildOutfit(weather.condition));
    setIsLoading(false);
  }, [query, weather]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSubmit();
  };

  const weatherLabel = weather.condition
    .replace(/-/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase());

  const moodTags = query.trim()
    ? query.split(/\s+/).slice(0, 3).map(w => w.toLowerCase())
    : ["minimal", "relaxed"];

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
          {!outfitPieces ? (
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
              key="outfit"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6 }}
              className="w-full max-w-sm"
            >
              <OutfitComposition
                pieces={outfitPieces}
                caption={aiCaption || "A look curated for you."}
                tags={moodTags}
              />

              {/* Reset */}
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
                onClick={() => { setOutfitPieces(null); setAiCaption(null); setQuery(""); }}
                className="mx-auto mt-6 block text-[10px] tracking-[0.15em] text-foreground/20 transition-colors hover:text-foreground/40"
              >
                ASK AGAIN
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Weather widget */}
      {!outfitPieces && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.8 }}
          className="relative z-10 pb-20 text-center"
        >
          <p className="text-[12px] font-light tracking-[0.12em] text-foreground/25">
            {weather.location} · {weather.temp}°C · {weatherLabel}
          </p>
        </motion.div>
      )}
    </div>
  );
};

export default HomePage;
