import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useSubscription } from "@/hooks/useSubscription";
import { useWeather } from "@/hooks/useWeather";
import { Loader2, CalendarDays, Lock } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

interface OutfitPiece {
  name: string;
  color: string;
  style: string;
}

interface WeekDay {
  day: string;
  label: string;
  mood_tag?: string;
  outfit: {
    top: OutfitPiece;
    bottom: OutfitPiece;
    shoes: OutfitPiece;
    outerwear?: OutfitPiece | null;
    accessories?: OutfitPiece | null;
  };
  explanation: string;
}

const WeeklyPlan = () => {
  const { user } = useAuth();
  const { subscription } = useSubscription();
  const weather = useWeather();
  const navigate = useNavigate();
  const [days, setDays] = useState<WeekDay[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedDay, setExpandedDay] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !subscription.isPremium) return;
    fetchWeekly();
  }, [user, subscription.isPremium, weather.loading]);

  const fetchWeekly = async () => {
    if (weather.loading) return;
    setLoading(true);
    setError(null);

    try {
      const today = new Date().toISOString().split("T")[0];
      const { data: cached } = await supabase
        .from("daily_recommendations")
        .select("outfits")
        .eq("user_id", user!.id)
        .eq("recommendation_date", today)
        .eq("recommendation_type", "weekly")
        .maybeSingle();

      if (cached && Array.isArray(cached.outfits) && cached.outfits.length > 0) {
        setDays(cached.outfits as unknown as WeekDay[]);
        setLoading(false);
        return;
      }

      const { data, error: fnError } = await supabase.functions.invoke("daily-stylist", {
        body: {
          type: "weekly",
          weather: { temp: weather.temp, condition: weather.condition },
          location: weather.location,
        },
      });

      if (fnError) throw fnError;
      if (data?.error === "premium_required") {
        setError("premium_required");
        return;
      }
      setDays(data?.plan || []);
    } catch (e) {
      console.error("Weekly fetch error:", e);
      setError("Failed to load weekly plan");
    } finally {
      setLoading(false);
    }
  };

  if (!user || !subscription.isPremium) {
    return (
      <div className="rounded-2xl border border-accent/20 bg-accent/5 p-6 text-center space-y-3">
        <Lock className="mx-auto h-6 w-6 text-accent/60" />
        <p className="font-display text-sm font-semibold text-foreground">Weekly Style Plan</p>
        <p className="text-xs text-foreground/50 max-w-[260px] mx-auto">
          Plan your week with AI-curated outfits. Reduce decision fatigue.
        </p>
        <button
          onClick={() => navigate(user ? "/profile" : "/auth")}
          className="mt-2 rounded-xl bg-accent px-5 py-2.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
        >
          {user ? "Continue with Premium" : "Sign Up Free"}
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-accent/50" />
        <span className="ml-2 text-xs text-foreground/40">Planning your week…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-foreground/[0.06] bg-card/40 p-6 text-center">
        <p className="text-xs text-foreground/40">{error}</p>
        <button onClick={fetchWeekly} className="mt-2 text-[10px] font-semibold text-accent">Try Again</button>
      </div>
    );
  }

  if (days.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <CalendarDays className="h-4 w-4 text-accent" />
        <p className="text-[10px] font-semibold tracking-[0.2em] text-foreground/50">WEEKLY PLAN</p>
      </div>

      <div className="space-y-2">
        {days.map((day, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <button
              onClick={() => setExpandedDay(expandedDay === i ? null : i)}
              className="flex w-full items-center gap-3 rounded-xl border border-foreground/[0.04] bg-card/40 px-4 py-3 text-left transition-colors hover:bg-card/60"
            >
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-accent/10">
                <span className="text-[10px] font-bold text-accent">{day.day?.slice(0, 3)?.toUpperCase() || `D${i + 1}`}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground truncate">{day.label}</p>
                <p className="text-[10px] text-foreground/40 truncate">{day.outfit?.top?.name} + {day.outfit?.bottom?.name}</p>
              </div>
              <div className={`h-2 w-2 rounded-full transition-colors ${expandedDay === i ? "bg-accent" : "bg-foreground/10"}`} />
            </button>

            {expandedDay === i && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="mx-2 mt-1 rounded-xl bg-card/30 p-4 space-y-3"
              >
                <div className="grid grid-cols-2 gap-2">
                  {(["top", "bottom", "shoes", "outerwear", "accessories"] as const).map(key => {
                    const piece = day.outfit?.[key];
                    if (!piece) return null;
                    return (
                      <div key={key} className="flex items-center gap-2 rounded-lg bg-background/50 px-2.5 py-2">
                        <div className="h-2.5 w-2.5 rounded-full border border-foreground/10" style={{ backgroundColor: piece.color?.toLowerCase() || "#888" }} />
                        <div>
                          <p className="text-[10px] font-medium text-foreground/70">{piece.name}</p>
                          <p className="text-[8px] text-foreground/30 capitalize">{key}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="text-[11px] text-foreground/50 leading-relaxed">{day.explanation}</p>
              </motion.div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default WeeklyPlan;
