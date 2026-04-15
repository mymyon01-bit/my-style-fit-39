import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useSubscription } from "@/hooks/useSubscription";
import { useWeather } from "@/hooks/useWeather";
import { Loader2, Sparkles, ChevronRight, Lock, ShoppingBag, Eye } from "lucide-react";
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

const PieceChip = ({ piece, label }: { piece: OutfitPiece; label: string }) => (
  <div className="flex items-center gap-2 rounded-xl bg-background/60 px-3 py-2">
    <div className="h-3 w-3 rounded-full border border-foreground/10" style={{ backgroundColor: piece.color?.toLowerCase() || "#888" }} />
    <div className="min-w-0 flex-1">
      <p className="truncate text-[11px] font-medium text-foreground/80">{piece.name}</p>
      <p className="text-[9px] text-foreground/35 capitalize">{label}</p>
    </div>
  </div>
);

const UpgradePrompt = () => {
  const navigate = useNavigate();
  return (
    <div className="rounded-2xl border border-accent/20 bg-accent/5 p-6 text-center space-y-3">
      <Lock className="mx-auto h-6 w-6 text-accent/60" />
      <p className="font-display text-sm font-semibold text-foreground">Daily Styling — Premium</p>
      <p className="text-xs text-foreground/50 max-w-[260px] mx-auto">
        Get personalized daily outfits and weekly plans tailored to your style, body, and weather.
      </p>
      <button
        onClick={() => navigate("/profile")}
        className="mt-2 rounded-xl bg-accent px-5 py-2.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
      >
        Continue with Premium
      </button>
    </div>
  );
};

const DailyPicks = () => {
  const { user } = useAuth();
  const { subscription } = useSubscription();
  const weather = useWeather();
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
      // Check cache first
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
        body: {
          type: "daily",
          weather: { temp: weather.temp, condition: weather.condition },
          location: weather.location,
          mood: null,
        },
      });

      if (fnError) throw fnError;
      if (data?.error === "premium_required") {
        setError("premium_required");
        return;
      }
      setOutfits(data?.outfits || []);
    } catch (e) {
      console.error("Daily fetch error:", e);
      setError("Failed to load recommendations");
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;
  if (!subscription.isPremium) return <UpgradePrompt />;
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-accent/50" />
        <span className="ml-2 text-xs text-foreground/40">Curating today's looks…</span>
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-2xl border border-foreground/[0.06] bg-card/40 p-6 text-center">
        <p className="text-xs text-foreground/40">{error}</p>
        <button onClick={fetchDaily} className="mt-2 text-[10px] font-semibold text-accent">Try Again</button>
      </div>
    );
  }
  if (outfits.length === 0) return null;

  const current = outfits[activeIndex];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-accent" />
        <p className="text-[10px] font-semibold tracking-[0.2em] text-foreground/50">TODAY'S PICKS</p>
      </div>

      {/* Outfit selector dots */}
      <div className="flex justify-center gap-2">
        {outfits.map((o, i) => (
          <button
            key={i}
            onClick={() => setActiveIndex(i)}
            className={`rounded-full px-3 py-1 text-[10px] font-medium transition-all ${
              i === activeIndex ? "bg-accent text-white" : "bg-card text-foreground/40"
            }`}
          >
            {o.label || `Look ${i + 1}`}
          </button>
        ))}
      </div>

      {/* Active outfit */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeIndex}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="rounded-2xl border border-foreground/[0.06] bg-card/50 p-5 space-y-4"
        >
          {/* Pieces */}
          <div className="grid grid-cols-2 gap-2">
            {PIECE_LABELS.map(key => {
              const piece = current.outfit[key];
              if (!piece) return null;
              return <PieceChip key={key} piece={piece} label={key} />;
            })}
          </div>

          {/* Explanation */}
          <p className="text-xs text-foreground/60 leading-relaxed">{current.explanation}</p>

          {/* Actions */}
          <div className="flex gap-2">
            <button className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-foreground py-2.5 text-[10px] font-semibold text-background transition-opacity hover:opacity-90">
              <Eye className="h-3.5 w-3.5" /> Try This Look
            </button>
            <button className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-foreground/10 py-2.5 text-[10px] font-semibold text-foreground/60 transition-colors hover:bg-foreground/5">
              <ShoppingBag className="h-3.5 w-3.5" /> View Items
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default DailyPicks;
