import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useSubscription } from "@/hooks/useSubscription";
import { useWeather } from "@/hooks/useWeather";
import { Loader2, CalendarDays } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

interface OutfitPiece { name: string; color: string; style: string; }
interface WeekDay {
  day: string; label: string; mood_tag?: string;
  outfit: { top: OutfitPiece; bottom: OutfitPiece; shoes: OutfitPiece; outerwear?: OutfitPiece | null; accessories?: OutfitPiece | null; };
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
      const { data: cached } = await supabase.from("daily_recommendations").select("outfits").eq("user_id", user!.id).eq("recommendation_date", today).eq("recommendation_type", "weekly").maybeSingle();
      if (cached && Array.isArray(cached.outfits) && cached.outfits.length > 0) { setDays(cached.outfits as unknown as WeekDay[]); setLoading(false); return; }
      const { data, error: fnError } = await supabase.functions.invoke("daily-stylist", { body: { type: "weekly", weather: { temp: weather.temp, condition: weather.condition }, location: weather.location } });
      if (fnError) throw fnError;
      if (data?.error === "premium_required") { setError("premium_required"); return; }
      setDays(data?.plan || []);
    } catch (e) { console.error("Weekly fetch error:", e); setError("Failed to load"); } finally { setLoading(false); }
  };

  if (!user || !subscription.isPremium) {
    return (
      <div className="space-y-5 md:space-y-6">
        <div className="flex items-center gap-3">
          <CalendarDays className="h-4 w-4 text-accent/30" />
          <p className="text-[10px] font-medium tracking-[0.25em] text-foreground/28 md:text-[11px]">WEEKLY PLAN</p>
        </div>
        <p className="font-display text-lg text-foreground/50 md:text-xl">A week of styling, planned for you.</p>
        <p className="text-[12px] leading-[1.8] text-foreground/28 max-w-[300px] md:text-[13px] md:max-w-sm">
          Five days of curated direction — less decision fatigue, more confidence.
        </p>
        <button onClick={() => navigate(user ? "/profile" : "/auth")} className="text-[10px] font-medium tracking-[0.2em] text-foreground/32 transition-colors hover:text-foreground/55 md:text-[11px]">
          {user ? "KEEP YOUR WEEKLY PLAN ACTIVE" : "GET STARTED"}
        </button>
      </div>
    );
  }

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-4 w-4 animate-spin text-foreground/15" /><span className="ml-3 text-[11px] text-foreground/22">Planning…</span></div>;
  if (error) return <div className="py-14 text-center"><p className="text-[11px] text-foreground/28">{error}</p><button onClick={fetchWeekly} className="mt-2 text-[10px] text-accent/50 hover:text-accent">Retry</button></div>;
  if (days.length === 0) return null;

  return (
    <div className="space-y-7 md:space-y-8">
      <div className="flex items-center gap-3">
        <CalendarDays className="h-4 w-4 text-accent/40" />
        <p className="text-[10px] font-medium tracking-[0.25em] text-foreground/28 md:text-[11px]">WEEKLY PLAN</p>
      </div>
      <div className="space-y-1">
        {days.map((day, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
            <button onClick={() => setExpandedDay(expandedDay === i ? null : i)} className="flex w-full items-center gap-5 py-4.5 text-left transition-colors md:py-5">
              <span className="text-[10px] font-medium tracking-wider text-accent/40 w-10 shrink-0 md:text-[11px] md:w-12">
                {day.day?.slice(0, 3)?.toUpperCase() || `D${i + 1}`}
              </span>
              <div className="flex-1 min-w-0">
                <p className={`text-[13px] transition-colors duration-300 md:text-[14px] ${expandedDay === i ? "text-foreground/68" : "text-foreground/38"}`}>{day.label}</p>
              </div>
              <div className={`h-1.5 w-1.5 rounded-full transition-colors ${expandedDay === i ? "bg-accent/50" : "bg-foreground/10"}`} />
            </button>
            {expandedDay === i && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="pb-6 pl-14 space-y-3 md:pl-16">
                {(["top", "bottom", "shoes", "outerwear", "accessories"] as const).map(key => {
                  const piece = day.outfit?.[key];
                  if (!piece) return null;
                  return (
                    <div key={key} className="flex items-center gap-3">
                      <div className="h-2.5 w-2.5 rounded-full shrink-0 md:h-3 md:w-3" style={{ backgroundColor: piece.color?.toLowerCase() || "#888" }} />
                      <span className="text-[12px] text-foreground/48 md:text-[13px]">{piece.name}</span>
                      <span className="text-[9px] text-foreground/20 capitalize md:text-[10px]">{key}</span>
                    </div>
                  );
                })}
                <p className="text-[11px] font-light leading-[1.8] text-foreground/28 pt-1 md:text-[12px]">{day.explanation}</p>
              </motion.div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default WeeklyPlan;
