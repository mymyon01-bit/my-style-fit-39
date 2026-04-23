/**
 * StyleLookModal — full-screen card view of an outfit:
 *   - AI generated lookbook image (Nano Banana)
 *   - Outfit pieces breakdown
 *   - 2-3 alternative variations (tabbable)
 */
import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Sparkles, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface OutfitPiece { name: string; color: string; style: string; }
export interface StyleLookOutfit {
  label?: string;
  outfit: {
    top?: OutfitPiece; bottom?: OutfitPiece; shoes?: OutfitPiece;
    outerwear?: OutfitPiece | null; accessories?: OutfitPiece | null;
  };
  explanation?: string;
}

const PIECE_KEYS = ["top", "bottom", "shoes", "outerwear", "accessories"] as const;

const PieceRow = ({ piece, label }: { piece: OutfitPiece; label: string }) => (
  <div className="flex items-center gap-3 py-2.5 border-b border-foreground/5 last:border-0">
    <div
      className="h-3 w-3 rounded-full shrink-0 ring-1 ring-foreground/10"
      style={{ backgroundColor: piece.color?.toLowerCase() || "#888" }}
    />
    <p className="flex-1 min-w-0 truncate text-[13px] text-foreground/85">{piece.name}</p>
    <p className="text-[9px] uppercase tracking-[0.2em] text-foreground/40">{label}</p>
  </div>
);

export default function StyleLookModal({
  open,
  onOpenChange,
  baseOutfit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  baseOutfit: StyleLookOutfit | null;
}) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [variations, setVariations] = useState<StyleLookOutfit[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0); // 0 = base, 1..n = variations

  useEffect(() => {
    if (!open || !baseOutfit) return;
    setImageUrl(null);
    setVariations([]);
    setActiveIdx(0);
    setLoading(true);
    supabase.functions
      .invoke("style-look-expand", { body: { outfit: baseOutfit } })
      .then(({ data, error }) => {
        if (error) { console.warn(error); return; }
        setImageUrl(data?.imageUrl || null);
        setVariations(Array.isArray(data?.variations) ? data.variations : []);
      })
      .finally(() => setLoading(false));
  }, [open, baseOutfit]);

  if (!baseOutfit) return null;

  const all: StyleLookOutfit[] = [baseOutfit, ...variations];
  const current = all[activeIdx] || baseOutfit;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden border-foreground/10 bg-background">
        <div className="grid md:grid-cols-2 max-h-[85vh] overflow-y-auto">
          {/* Image */}
          <div className="relative aspect-[3/4] md:aspect-auto md:min-h-[520px] bg-foreground/[0.04] overflow-hidden">
            {loading && !imageUrl && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-foreground/40" />
                <p className="text-[10px] uppercase tracking-[0.2em] text-foreground/45">
                  Generating look…
                </p>
              </div>
            )}
            {imageUrl && (
              <motion.img
                key={imageUrl}
                src={imageUrl}
                alt={current.label || "Style look"}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6 }}
                className="absolute inset-0 h-full w-full object-cover"
              />
            )}
            <button
              onClick={() => onOpenChange(false)}
              className="absolute top-3 right-3 z-10 h-8 w-8 rounded-full bg-background/80 backdrop-blur flex items-center justify-center hover:bg-background"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Details */}
          <div className="p-6 md:p-7 flex flex-col">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <p className="text-[10px] font-semibold tracking-[0.22em] uppercase text-foreground/55">
                {activeIdx === 0 ? "Your Look" : `Variation ${activeIdx}`}
              </p>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={activeIdx}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.25 }}
              >
                <p className="font-display text-[22px] italic text-foreground/90 mb-4 md:text-[24px]">
                  {current.label || "Untitled look"}
                </p>
                <div className="mb-5">
                  {PIECE_KEYS.map((k) => {
                    const p = current.outfit[k];
                    if (!p) return null;
                    return <PieceRow key={k} piece={p} label={k} />;
                  })}
                </div>
                {current.explanation && (
                  <p className="text-[12.5px] leading-[1.7] text-foreground/65 md:text-[13px]">
                    {current.explanation}
                  </p>
                )}
              </motion.div>
            </AnimatePresence>

            {/* Variation tabs */}
            {all.length > 1 && (
              <div className="mt-6 pt-5 border-t border-foreground/10">
                <p className="text-[9px] uppercase tracking-[0.22em] text-foreground/45 mb-3">
                  Style variations
                </p>
                <div className="flex flex-wrap gap-2">
                  {all.map((o, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveIdx(i)}
                      className={`px-3 py-1.5 rounded-full text-[11px] transition-colors ${
                        i === activeIdx
                          ? "bg-foreground text-background"
                          : "bg-foreground/[0.06] text-foreground/65 hover:bg-foreground/10"
                      }`}
                    >
                      {i === 0 ? "Original" : (o.label || `Look ${i}`)}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {loading && variations.length === 0 && (
              <p className="mt-4 text-[10px] uppercase tracking-[0.2em] text-foreground/40">
                Crafting variations…
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
