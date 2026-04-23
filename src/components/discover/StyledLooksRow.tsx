import { memo, useState } from "react";
import { Sparkles, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { Product } from "@/lib/search/types";

/**
 * LAYER 2 — Styled Looks shell (collapsible).
 *
 * Collapsed by default. Tapping a tile opens the same ProductDetailSheet
 * the rest of Discover uses, so the user gets the full detail card with
 * the real outbound source link — consistent with DbTopGrid.
 */
interface StyledLooksRowProps {
  products: Product[];
  onSelect?: (product: Product) => void;
}

interface LookTile {
  hero: Product;
  side: Product[];
  label: string;
}

const LOOK_LABELS = ["Editor's pick", "Daily edit", "Styled set"];

function buildLooks(products: Product[]): LookTile[] {
  if (products.length < 4) return [];
  const looks: LookTile[] = [];
  for (let i = 0; i < Math.min(3, Math.floor(products.length / 4)); i++) {
    const slice = products.slice(i * 4, i * 4 + 4);
    looks.push({
      hero: slice[0],
      side: slice.slice(1, 4),
      label: LOOK_LABELS[i] ?? "Curated look",
    });
  }
  return looks;
}

const StyledLooksRowImpl = ({ products, onSelect }: StyledLooksRowProps) => {
  const [open, setOpen] = useState(false);
  const looks = buildLooks(products);

  const handleSelect = (p: Product) => {
    if (onSelect) onSelect(p);
  };

  return (
    <section aria-label="Styled looks" className="space-y-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="styled-looks-grid"
        className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left transition-colors hover:bg-foreground/[0.04] active:bg-foreground/[0.06]"
      >
        <span className="flex items-center gap-2">
          <p className="text-[10px] font-semibold tracking-[0.25em] text-foreground/75">STYLED LOOKS</p>
          <span className="rounded-full bg-foreground/[0.06] px-1.5 py-0.5 text-[9px] font-medium text-foreground/55">
            {looks.length || "—"}
          </span>
        </span>
        <span className="flex items-center gap-1.5 text-[10px] font-medium text-foreground/70">
          <span>{open ? "Hide" : "Show"}</span>
          <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown className="h-3.5 w-3.5" />
          </motion.span>
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id="styled-looks-grid"
            key="looks-grid"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-1 gap-3 pt-1 md:grid-cols-2 lg:grid-cols-3 lg:gap-4">
              {looks.length === 0
                ? Array.from({ length: 3 }).map((_, i) => (
                    <div
                      key={`look-skeleton-${i}`}
                      className="aspect-[5/3] overflow-hidden rounded-xl border border-border/15 bg-foreground/[0.03]"
                    />
                  ))
                : looks.map((look, index) => (
                    <LookTileView
                      key={`look-${look.hero.id}-${index}`}
                      tile={look}
                      onSelect={handleSelect}
                    />
                  ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};

function LookTileView({ tile, onSelect }: { tile: LookTile; onSelect: (p: Product) => void }) {
  const heroSrc = tile.hero.imageUrl && tile.hero.imageUrl.startsWith("http") ? tile.hero.imageUrl : "/placeholder.svg";
  return (
    <div className="group relative grid aspect-[5/3] grid-cols-2 gap-1.5 overflow-hidden rounded-xl border border-border/15 bg-muted/30 p-1.5">
      <button
        type="button"
        onClick={() => onSelect(tile.hero)}
        className="relative overflow-hidden rounded-lg bg-muted/40 text-left"
        aria-label={`View ${tile.hero.title}`}
      >
        <img
          src={heroSrc}
          alt={tile.hero.title}
          loading="lazy"
          decoding="async"
          sizes="(max-width: 640px) 50vw, 25vw"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          onError={(e) => { e.currentTarget.src = "/placeholder.svg"; }}
        />
        <div className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded-full bg-background/80 px-2 py-0.5 text-[9px] font-semibold tracking-[0.15em] text-foreground/80 backdrop-blur-sm">
          <Sparkles className="h-2.5 w-2.5 text-accent/70" />
          {tile.label.toUpperCase()}
        </div>
      </button>
      <div className="grid grid-rows-3 gap-1.5">
        {tile.side.map((item, idx) => {
          const sideSrc = item.imageUrl && item.imageUrl.startsWith("http") ? item.imageUrl : "/placeholder.svg";
          return (
            <button
              type="button"
              key={`${tile.hero.id}-side-${idx}`}
              onClick={() => onSelect(item)}
              className="overflow-hidden rounded-lg bg-muted/40 text-left"
              aria-label={`View ${item.title}`}
            >
              <img
                src={sideSrc}
                alt={item.title}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover transition-transform duration-500 hover:scale-[1.05]"
                onError={(e) => { e.currentTarget.src = "/placeholder.svg"; }}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

const StyledLooksRow = memo(StyledLooksRowImpl);
StyledLooksRow.displayName = "StyledLooksRow";
export default StyledLooksRow;
