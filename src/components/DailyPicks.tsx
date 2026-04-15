import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useSubscription } from "@/hooks/useSubscription";
import { useWeather } from "@/hooks/useWeather";
import { Loader2, Sparkles, Eye, ShoppingBag } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";

interface OutfitPiece {
  name: string;
  color: string;
  style: string;
}

interface DailyOutfit {
  label: string;
  outfit: {
    top: OutfitPiece;
    bottom: OutfitPiece;
    shoes: OutfitPiece;
    outerwear?: OutfitPiece | null;
    accessories?: OutfitPiece | null;
  };
  explanation: string;
}

const PIECE_LABELS = ["top", "bottom", "shoes", "outerwear", "accessories"] as const;

const PieceRow = ({ piece, label }: { piece: OutfitPiece; label: string }) => (
  <div className="flex items-center gap-3 py-2.5 lg:py-3">
    <div
      className="h-3 w-3 rounded-full shrink-0"
      style={{ backgroundColor: piece.color?.toLowerCase() || "#888" }}
    />
    <div className="flex-1 min-w-0">
      <p className="text-[12px] text-foreground/60 truncate lg:text-[13px]">{piece.name}</p>
    </div>
    <p className="text-[9px] text-foreground/25 capitalize lg:text-[10px]">{label}</p>
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
      const { data: cached } = await supabase
        .from("daily_recommendations")
        .select("outfits")
        .eq("user_id", user!.id)
        .eq("recommendation_date", today)
        .eq("recommendation_type", "daily")
        .maybeSingle();

      if (cached && Array.isArray(cached.outfits) && cached.outfits.length > 0) {
        setOutfits(cached.outfits as unknown as DailyOutfit[]);
        setLoading(false);
        return;
      }

      const { data, error: fnError } = await supabase.functions.invoke("daily-stylist", {
        body: { type: "daily", weather: { temp: weather.temp, condition: weather.condition }, location: weather.location, mood: null },
      });
      if (fnError) throw fnError;
      if (data?.error === "premium_required") { setError("premium_required"); return; }
      setOutfits(data?.outfits || []);
    } catch (e) {
      console.error("Daily fetch error:", e);
      setError("Failed to load");
    } finally {
      setLoading(false);
    }
  };

  // Passive discovery for non-premium — not aggressive
  if (!user || !subscription.isPremium) {
    return (
      <div className="space-y-5 lg:space-y-6">
        <div className="flex items-center gap-3">
          <Sparkles className="h-3.5 w-3.5 text-accent/30" />
          <p className="text-[9px] font-medium tracking-[0.25em] text-foreground/25 lg:text-[10px]">TODAY'S PICKS</p>
        </div>
        <p className="font-display text-base text-foreground/45 lg:text-lg">
          Personalized outfits curated for your day.
        </p>
        <p className="text-[11px] leading-[1.8] text-foreground/25 max-w-[280px] lg:text-[12px] lg:max-w-sm">
          Weather-aware, mood-driven styling that adapts to you — available with your daily plan.
        </p>
        <button
          onClick={() => navigate(user ? "/profile" : "/auth")}
          className="text-[9px] font-medium tracking-[0.2em] text-foreground/30 transition-colors hover:text-foreground/50 lg:text-[10px]"
        >
          {user ? "CONTINUE WITH PREMIUM" : "GET STARTED"}
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 lg:py-24">
        <Loader2 className="h-4 w-4 animate-spin text-foreground/12" />
        <span className="ml-3 text-[10px] text-foreground/20">Curating…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-12 text-center">
        <p className="text-[10px] text-foreground/25">{error}</p>
        <button onClick={fetchDaily} className="mt-2 text-[9px] text-accent/50 hover:text-accent">Retry</button>
      </div>
    );
  }

  if (outfits.length === 0) return null;
  const current = outfits[activeIndex];

  return (
    <div className="space-y-6 lg:space-y-8">
      <div className="flex items-center gap-3">
        <Sparkles className="h-3.5 w-3.5 text-accent/40" />
        <p className="text-[9px] font-medium tracking-[0.25em] text-foreground/25 lg:text-[10px]">TODAY'S PICKS</p>
      </div>

      {/* Selector */}
      <div className="flex gap-5 lg:gap-8">
        {outfits.map((o, i) => (
          <button
            key={i}
            onClick={() => setActiveIndex(i)}
            className={`text-[11px] font-light transition-colors duration-300 lg:text-[12px] ${
              i === activeIndex ? "text-foreground/65" : "text-foreground/18"
            }`}
          >
            {o.label || `Look ${i + 1}`}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeIndex}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.4 }}
          className="space-y-6 lg:space-y-8"
        >
          {/* Pieces */}
          <div>
            {PIECE_LABELS.map(key => {
              const piece = current.outfit[key];
              if (!piece) return null;
              return <PieceRow key={key} piece={piece} label={key} />;
            })}
          </div>

          {/* Explanation */}
          <p className="text-[11px] font-light leading-[1.9] text-foreground/35 lg:text-[12px] lg:leading-[2]">{current.explanation}</p>

          {/* Actions */}
          <div className="flex gap-6 lg:gap-8">
            <button className="flex items-center gap-1.5 text-[9px] font-medium tracking-[0.15em] text-foreground/30 hover:text-foreground/50 transition-colors lg:text-[10px]">
              <Eye className="h-3 w-3 lg:h-3.5 lg:w-3.5" /> TRY LOOK
            </button>
            <button className="flex items-center gap-1.5 text-[9px] font-medium tracking-[0.15em] text-foreground/30 hover:text-foreground/50 transition-colors lg:text-[10px]">
              <ShoppingBag className="h-3 w-3 lg:h-3.5 lg:w-3.5" /> VIEW ITEMS
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default DailyPicks;
