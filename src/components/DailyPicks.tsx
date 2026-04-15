import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useSubscription } from "@/hooks/useSubscription";
import { useWeather } from "@/hooks/useWeather";
import { Loader2, Sparkles, Eye, ShoppingBag } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";

interface OutfitPiece { name: string; color: string; style: string; }
interface DailyOutfit {
  label: string;
  outfit: { top: OutfitPiece; bottom: OutfitPiece; shoes: OutfitPiece; outerwear?: OutfitPiece | null; accessories?: OutfitPiece | null; };
  explanation: string;
}

const PIECE_LABELS = ["top", "bottom", "shoes", "outerwear", "accessories"] as const;

const PieceRow = ({ piece, label }: { piece: OutfitPiece; label: string }) => (
  <div className="flex items-center gap-4 py-3 md:py-3.5">
    <div className="h-3 w-3 rounded-full shrink-0 md:h-3.5 md:w-3.5" style={{ backgroundColor: piece.color?.toLowerCase() || "#888" }} />
    <div className="flex-1 min-w-0">
      <p className="text-[13px] text-foreground/60 truncate md:text-[14px]">{piece.name}</p>
    </div>
    <p className="text-[10px] text-foreground/48 capitalize md:text-[11px]">{label}</p>
  </div>
);

const DailyPicks = () => {
  const { user } = useAuth();
  const { subscription } = useSubscription();
  const weather = useWeather();
  const navigate = useNavigate();
  const [outfits, setOutfits] = useState<DailyOutfit[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !subscription.isPremium) return;
    fetchDaily();
  }, [user, subscription.isPremium, weather.loading]);

  const fetchDaily = async () => {
    if (weather.loading) return;
    setLoading(true);
    setError(null);
    try {
      const today = new Date().toISOString().split("T")[0];
      const { data: cached } = await supabase.from("daily_recommendations").select("outfits").eq("user_id", user!.id).eq("recommendation_date", today).eq("recommendation_type", "daily").maybeSingle();
      if (cached && Array.isArray(cached.outfits) && cached.outfits.length > 0) { setOutfits(cached.outfits as unknown as DailyOutfit[]); setLoading(false); return; }
      const { data, error: fnError } = await supabase.functions.invoke("daily-stylist", { body: { type: "daily", weather: { temp: weather.temp, condition: weather.condition }, location: weather.location, mood: null } });
      if (fnError) throw fnError;
      if (data?.error === "premium_required") { setError("premium_required"); return; }
      setOutfits(data?.outfits || []);
    } catch (e) { console.error("Daily fetch error:", e); setError("Failed to load"); } finally { setLoading(false); }
  };

  if (!user || !subscription.isPremium) {
    return (
      <div className="space-y-5 md:space-y-6">
        <div className="flex items-center gap-3">
          <Sparkles className="h-4 w-4 text-accent/70" />
          <p className="text-[10px] font-medium tracking-[0.25em] text-foreground/48 md:text-[11px]">TODAY'S PICKS</p>
        </div>
        <p className="font-display text-lg text-foreground/80 md:text-xl">Personalized outfits curated for your day.</p>
        <p className="text-[12px] leading-[1.8] text-foreground/48 max-w-[300px] md:text-[13px] md:max-w-sm">
          Weather-aware, mood-driven styling that adapts to you — available with your daily plan.
        </p>
        <button onClick={() => navigate(user ? "/profile" : "/auth")} className="text-[10px] font-medium tracking-[0.2em] text-foreground/32 transition-colors hover:text-foreground/68 md:text-[11px]">
          {user ? "CONTINUE WITH PREMIUM" : "GET STARTED"}
        </button>
      </div>
    );
  }

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-4 w-4 animate-spin text-foreground/80" /><span className="ml-3 text-[11px] text-foreground/60">Curating…</span></div>;
  if (error) return <div className="py-14 text-center"><p className="text-[11px] text-foreground/48">{error}</p><button onClick={fetchDaily} className="mt-2 text-[10px] text-accent/70 hover:text-accent">Retry</button></div>;
  if (outfits.length === 0) return null;

  const current = outfits[activeIndex];

  return (
    <div className="space-y-7 md:space-y-8">
      <div className="flex items-center gap-3">
        <Sparkles className="h-4 w-4 text-accent/80" />
        <p className="text-[10px] font-medium tracking-[0.25em] text-foreground/48 md:text-[11px]">TODAY'S PICKS</p>
      </div>
      <div className="flex gap-6 md:gap-8">
        {outfits.map((o, i) => (
          <button key={i} onClick={() => setActiveIndex(i)} className={`text-[12px] font-light transition-colors duration-300 md:text-[13px] ${i === activeIndex ? "text-foreground/68" : "text-foreground/60"}`}>
            {o.label || `Look ${i + 1}`}
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={activeIndex} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.4 }} className="space-y-7 md:space-y-8">
          <div>{PIECE_LABELS.map(key => { const piece = current.outfit[key]; if (!piece) return null; return <PieceRow key={key} piece={piece} label={key} />; })}</div>
          <p className="text-[12px] font-light leading-[1.9] text-foreground/68 md:text-[13px] md:leading-[2]">{current.explanation}</p>
          <div className="flex gap-7 md:gap-9">
            <button className="flex items-center gap-2 text-[10px] font-medium tracking-[0.15em] text-foreground/32 hover:text-foreground/68 transition-colors md:text-[11px]">
              <Eye className="h-3.5 w-3.5" /> TRY LOOK
            </button>
            <button className="flex items-center gap-2 text-[10px] font-medium tracking-[0.15em] text-foreground/32 hover:text-foreground/68 transition-colors md:text-[11px]">
              <ShoppingBag className="h-3.5 w-3.5" /> VIEW ITEMS
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default DailyPicks;
