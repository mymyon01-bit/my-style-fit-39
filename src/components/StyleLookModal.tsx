/**
 * StyleLookModal — shows three personalized Style Me product recommendations.
 * The ranking happens before opening, so this modal never calls try-on generation.
 */
import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Sparkles, X, ExternalLink, Square, Circle, Heart, ShoppingBag } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const SHAPE_KEY = "stylelook-card-shape";
type CardShape = "rounded" | "square";

export interface StyleLookProduct {
  id: string;
  name: string;
  brand?: string | null;
  image_url?: string | null;
  source_url?: string | null;
  price?: string | null;
  category?: string | null;
  reason?: string | null;
  match_score?: number | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  product: StyleLookProduct | null;
  /** Optional list of alternative products to switch between. */
  alternatives?: StyleLookProduct[];
}

export default function StyleLookModal({
  open,
  onOpenChange,
  product,
  alternatives = [],
}: Props) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [shape, setShape] = useState<CardShape>(() => {
    if (typeof window === "undefined") return "rounded";
    return (localStorage.getItem(SHAPE_KEY) as CardShape) || "rounded";
  });
  useEffect(() => {
    try { localStorage.setItem(SHAPE_KEY, shape); } catch {}
  }, [shape]);
  const radiusClass = shape === "rounded" ? "rounded-2xl" : "rounded-none";

  const all = product ? [product, ...alternatives] : [];
  const current = all[activeIdx] || product;

  // Reset to first product whenever modal re-opens or product changes.
  useEffect(() => {
    if (open) setActiveIdx(0);
  }, [open, product?.id]);

  if (!product) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`max-w-3xl p-0 overflow-hidden border-foreground/10 bg-background ${radiusClass}`}>
        <div className="grid md:grid-cols-2 max-h-[85vh] overflow-y-auto">
          {/* Mannequin image */}
          <div className={`relative aspect-[3/4] md:aspect-auto md:min-h-[520px] bg-foreground/[0.04] overflow-hidden ${radiusClass}`}>
            <AnimatePresence mode="wait">
              {fit.imageUrl ? (
                <motion.img
                  key={fit.imageUrl}
                  src={fit.imageUrl}
                  alt={current.name}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.5 }}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                <motion.div
                  key="placeholder"
                  className="absolute inset-0 flex items-center justify-center"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  {current.image_url && (
                    <img
                      src={current.image_url}
                      alt={current.name}
                      className="h-full w-full object-contain opacity-30 blur-sm"
                    />
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Loading overlay */}
            {isLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/60 backdrop-blur-sm">
                <Loader2 className="h-5 w-5 animate-spin text-foreground/60" />
                <p className="text-[10px] uppercase tracking-[0.22em] text-foreground/55">
                  Fitting on mannequin…
                </p>
              </div>
            )}

            {/* Failed state — always show a friendly message, never raw codes */}
            {fit.stage === "failed" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/80 p-6 text-center">
                <p className="text-[12px] text-foreground/70 max-w-[260px]">
                  Couldn't render your look right now. Please try again.
                </p>
                <button
                  onClick={() => fit.retry()}
                  className="inline-flex items-center gap-1.5 rounded-full border border-foreground/25 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide hover:bg-foreground hover:text-background transition-colors"
                >
                  <RotateCw className="h-3 w-3" /> Retry
                </button>
              </div>
            )}

            {/* Top-right controls: shape toggle + close */}
            <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5">
              <button
                onClick={() => setShape((s) => (s === "rounded" ? "square" : "rounded"))}
                className="h-8 w-8 rounded-full bg-background/80 backdrop-blur flex items-center justify-center hover:bg-background transition-colors"
                aria-label={shape === "rounded" ? "Switch to square card" : "Switch to rounded card"}
                title={shape === "rounded" ? "Square card" : "Rounded card"}
              >
                {shape === "rounded" ? (
                  <Square className="h-3.5 w-3.5" />
                ) : (
                  <Circle className="h-3.5 w-3.5" />
                )}
              </button>
              <button
                onClick={() => onOpenChange(false)}
                className="h-8 w-8 rounded-full bg-background/80 backdrop-blur flex items-center justify-center hover:bg-background"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Details */}
          <div className="p-6 md:p-7 flex flex-col">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <p className="text-[10px] font-semibold tracking-[0.22em] uppercase text-foreground/55">
                Styled for you
              </p>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={current.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.25 }}
              >
                {current.brand && (
                  <p className="text-[10px] uppercase tracking-[0.22em] text-foreground/55 mb-1">
                    {current.brand}
                  </p>
                )}
                <p className="font-display text-[20px] italic text-foreground/90 mb-3 md:text-[22px] leading-tight">
                  {current.name}
                </p>
                {current.price && (
                  <p className="text-[13px] text-foreground/75 mb-4">{current.price}</p>
                )}
                {current.reason && (
                  <p className="text-[12.5px] leading-[1.7] text-foreground/65 md:text-[13px] mb-5">
                    {(() => {
                      const r = String(current.reason).trim();
                      // Strip markdown code fences / inline backticks / json blobs
                      const clean = r
                        .replace(/```[\s\S]*?```/g, "")
                        .replace(/`([^`]*)`/g, "$1")
                        .replace(/^\s*[{\[][\s\S]*[}\]]\s*$/g, "")
                        .trim();
                      return clean.slice(0, 280);
                    })()}
                  </p>
                )}
                {current.source_url && (
                  <a
                    href={current.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-foreground/80 hover:text-foreground"
                  >
                    View product <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </motion.div>
            </AnimatePresence>

            {/* Alternatives */}
            {all.length > 1 && (
              <div className="mt-6 pt-5 border-t border-foreground/10">
                <p className="text-[9px] uppercase tracking-[0.22em] text-foreground/45 mb-3">
                  More like this
                </p>
                <div className="flex flex-wrap gap-2">
                  {all.map((p, i) => (
                    <button
                      key={p.id}
                      onClick={() => setActiveIdx(i)}
                      className={`px-3 py-1.5 rounded-full text-[11px] transition-colors max-w-[180px] truncate ${
                        i === activeIdx
                          ? "bg-foreground text-background"
                          : "bg-foreground/[0.06] text-foreground/65 hover:bg-foreground/10"
                      }`}
                      title={p.name}
                    >
                      {i === 0 ? "Original" : (p.brand || `Look ${i}`)}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
