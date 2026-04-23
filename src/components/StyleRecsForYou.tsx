/**
 * StyleRecsForYou
 * ----------------
 * Always-on style recommendations panel — open to guests, trial users and
 * premium subscribers. Combines:
 *   - User style profile (when logged in)
 *   - Live search signal (query + tags + currently-browsed products)
 *   - Weather context
 *
 * Free / guest tier uses Lovable AI; premium auto-uses Perplexity (handled
 * server-side in the daily-stylist edge function).
 */
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWeather } from "@/hooks/useWeather";
import { Loader2, Plus, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import StyleLookModal, { type StyleLookOutfit } from "./StyleLookModal";

interface OutfitPiece { name: string; color: string; style: string; }
interface StyleOutfit {
  label: string;
  outfit: {
    top?: OutfitPiece;
    bottom?: OutfitPiece;
    shoes?: OutfitPiece;
    outerwear?: OutfitPiece | null;
    accessories?: OutfitPiece | null;
  };
  explanation: string;
}

interface Props {
  /** Optional: current search query — drives "based on what you're looking at" */
  searchQuery?: string | null;
  /** Optional: tags currently active in the search (style/color/category) */
  searchTags?: string[];
  /** Optional: a sample of products currently shown to the user */
  searchProducts?: Array<{ name?: string; title?: string; brand?: string }>;
  /** Visual variant — `inline` for Discover top, `panel` for HomePage section */
  variant?: "inline" | "panel";
  /** Section title override */
  title?: string;
}

const PIECE_LABELS = ["top", "bottom", "shoes", "outerwear", "accessories"] as const;

const PieceRow = ({ piece, label }: { piece: OutfitPiece; label: string }) => (
  <div className="flex items-center gap-3 py-2.5">
    <div
      className="h-2.5 w-2.5 rounded-full shrink-0 ring-1 ring-foreground/10"
      style={{ backgroundColor: piece.color?.toLowerCase() || "#888" }}
    />
    <p className="flex-1 min-w-0 truncate text-[12px] text-foreground/80 md:text-[13px]">
      {piece.name}
    </p>
    <p className="text-[9px] uppercase tracking-[0.2em] text-foreground/40 md:text-[10px]">
      {label}
    </p>
  </div>
);

export default function StyleRecsForYou({
  searchQuery,
  searchTags,
  searchProducts,
  variant = "panel",
  title,
}: Props) {
  const weather = useWeather();
  const [outfits, setOutfits] = useState<StyleOutfit[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const lastKeyRef = useRef<string>("");
  const [expanded, setExpanded] = useState<StyleLookOutfit | null>(null);

  // Build a dedupe key so we don't re-fetch on every render
  const fetchKey = JSON.stringify({
    q: searchQuery || "",
    t: (searchTags || []).slice(0, 5).sort().join(","),
    p: (searchProducts || []).slice(0, 3).map(p => p.name || p.title).join(","),
    w: Math.round(weather.temp || 0),
  });

  useEffect(() => {
    if (weather.loading) return;
    if (lastKeyRef.current === fetchKey) return;
    lastKeyRef.current = fetchKey;
    fetchRecs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchKey, weather.loading]);

  async function fetchRecs() {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("daily-stylist", {
        body: {
          type: "daily",
          weather: { temp: weather.temp, condition: weather.condition },
          location: weather.location,
          mood: searchQuery || null,
          searchQuery: searchQuery || null,
          searchTags: searchTags || [],
          searchProducts: searchProducts || [],
        },
      });
      if (fnError) throw fnError;
      if (data?.error === "rate_limited") {
        setError("Too many requests — try again in a moment.");
        return;
      }
      if (data?.error === "payment_required") {
        setError("AI quota reached.");
        return;
      }
      const arr: StyleOutfit[] = Array.isArray(data?.outfits) ? data.outfits : [];
      setOutfits(arr);
      setActiveIndex(0);
    } catch (e) {
      console.warn("StyleRecsForYou fetch failed", e);
      setError("Couldn't load recommendations.");
    } finally {
      setLoading(false);
    }
  }

  const headline = title || (searchQuery ? "Looks that suit you" : "Styled for you today");
  const subtitle = searchQuery
    ? `Curated around "${searchQuery}"`
    : "Personalised by weather and taste";

  const wrapperCls = variant === "inline"
    ? "rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-5 md:p-6"
    : "rounded-3xl border border-foreground/10 bg-background/80 p-6 md:p-8 backdrop-blur";

  return (
    <div className={wrapperCls}>
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="text-[10px] font-semibold tracking-[0.22em] uppercase text-foreground/55 truncate">
              {headline}
            </p>
            <p className="text-[10px] text-foreground/45 truncate md:text-[11px]">
              {subtitle}
            </p>
          </div>
        </div>
        {outfits.length > 1 && (
          <div className="flex items-center gap-1.5 shrink-0">
            {outfits.map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveIndex(i)}
                aria-label={`Look ${i + 1}`}
                className={`h-1.5 rounded-full transition-all ${
                  i === activeIndex ? "w-5 bg-foreground" : "w-1.5 bg-foreground/20"
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-4 w-4 animate-spin text-foreground/50" />
          <span className="ml-3 text-[11px] text-foreground/55">Curating your looks…</span>
        </div>
      )}

      {!loading && error && (
        <div className="py-6 text-center">
          <p className="text-[11px] text-foreground/55">{error}</p>
          <button
            onClick={fetchRecs}
            className="mt-2 text-[10px] font-medium tracking-[0.2em] uppercase text-primary hover:underline"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && outfits.length > 0 && (
        <AnimatePresence mode="wait">
          <motion.div
            key={activeIndex}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.3 }}
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <p className="font-display text-[18px] italic text-foreground/85 md:text-[20px]">
                {outfits[activeIndex].label}
              </p>
              <button
                onClick={() => setExpanded(outfits[activeIndex])}
                aria-label="Expand look with AI image"
                className="shrink-0 h-8 w-8 rounded-full border border-foreground/15 flex items-center justify-center hover:bg-foreground hover:text-background transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="divide-y divide-foreground/5">
              {PIECE_LABELS.map((key) => {
                const p = outfits[activeIndex].outfit[key];
                if (!p) return null;
                return <PieceRow key={key} piece={p} label={key} />;
              })}
            </div>
            <p className="mt-4 text-[12px] leading-[1.7] text-foreground/65 md:text-[13px]">
              {outfits[activeIndex].explanation}
            </p>
          </motion.div>
        </AnimatePresence>
      )}

      {!loading && !error && outfits.length === 0 && (
        <p className="py-6 text-center text-[11px] text-foreground/45">
          No recommendations yet — try searching for a vibe.
        </p>
      )}

      <StyleLookModal
        open={!!expanded}
        onOpenChange={(v) => { if (!v) setExpanded(null); }}
        baseOutfit={expanded}
      />
    </div>
  );
}
