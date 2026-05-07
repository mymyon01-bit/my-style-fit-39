import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Sparkles, ArrowUpRight } from "lucide-react";
import { useWeather } from "@/hooks/useWeather";
import { useAuth } from "@/lib/auth";

/**
 * V4.3 Today's Inspo — personal dashboard strip on the homepage.
 * Adapts to weather, recent activity, and saved boards.
 *
 * Lightweight, opt-in entry point that links into Discover with mood seeds.
 */
const MOODS = [
  { label: "Quiet luxury", q: "quiet luxury" },
  { label: "Clean fit", q: "clean fit" },
  { label: "Old money", q: "old money" },
  { label: "Gorpcore", q: "gorpcore" },
  { label: "Minimal outerwear", q: "minimal outerwear" },
  { label: "Airport look", q: "airport look" },
];

export default function TodayInspoStrip() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const weather = useWeather();

  const weatherHint = !weather.loading && weather.temp != null
    ? weather.temp < 8 ? "warm layers" : weather.temp > 24 ? "lightweight pieces" : "transitional fits"
    : null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.55, duration: 0.6 }}
      className="mt-12 w-full"
    >
      <div className="mx-auto w-full max-w-[600px] px-6">
        <div className="flex items-end justify-between gap-3 border-b border-foreground/10 pb-2">
          <div>
            <p className="text-[8.5px] font-semibold uppercase tracking-[0.34em] text-foreground/50">
              {user ? "Today's Inspo" : "Trending Today"}
            </p>
            <p className="mt-1 font-display text-[18px] italic tracking-tight text-foreground/85">
              {weatherHint ? `Curated for ${weatherHint}` : "Curated for your next look"}
            </p>
          </div>
          <button
            onClick={() => navigate("/discover")}
            className="inline-flex items-center gap-1 pb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-foreground/60 hover:text-foreground"
          >
            See all <ArrowUpRight className="h-3 w-3" />
          </button>
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {MOODS.map(m => (
            <button
              key={m.q}
              onClick={() => navigate(`/discover?mood=${encodeURIComponent(m.q)}&source=today_inspo`)}
              className="group relative flex shrink-0 items-center gap-1.5 rounded-full border border-foreground/15 bg-background/50 px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider text-foreground/75 backdrop-blur transition-colors hover:border-foreground/50 hover:text-foreground"
            >
              <Sparkles className="h-2.5 w-2.5 text-primary/70 transition-transform group-hover:rotate-12" />
              {m.label}
            </button>
          ))}
        </div>
      </div>
    </motion.section>
  );
}
