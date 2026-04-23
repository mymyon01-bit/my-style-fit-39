import { memo, useState } from "react";
import { Sparkles, ChevronDown } from "lucide-react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import type { Product } from "@/lib/search/types";

/**
 * LAYER 2 — Styled Looks shell (collapsible).
 *
 * Collapsed by default to keep Discover lightweight. User taps the header
 * to expand and see editorial pairings. Each tile links to the product
 * detail page (`/fit/:id`) so users land on our internal page, which then
 * deep-links to the real source product.
 */
interface StyledLooksRowProps {
  products: Product[];
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

const StyledLooksRowImpl = ({ products }: StyledLooksRowProps) => {
  const [open, setOpen] = useState(false);
  const looks = buildLooks(products);

  return (
    <section aria-label="Styled looks" className="space-y-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-baseline justify-between rounded-lg px-1 py-1 text-left transition-colors hover:bg-foreground/[0.03]"
      >
        <span className="flex items-center gap-2">
          <p className="text-[10px] font-semibold tracking-[0.25em] text-foreground/75">STYLED LOOKS</p>
          <span className="rounded-full bg-foreground/[0.06] px-1.5 py-0.5 text-[9px] font-medium text-foreground/55">
            {looks.length || "—"}
          </span>
        </span>
        <span className="flex items-center gap-1.5 text-[10px] text-foreground/55">
          <span>{open ? "Hide" : "Show"}</span>
          <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown className="h-3 w-3" />
          </motion.span>
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="looks-grid"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 lg:gap-4">
              {looks.length === 0
                ? Array.from({ length: 3 }).map((_, i) => (
                    <div
                      key={`look-skeleton-${i}`}
                      className="aspect-[5/3] overflow-hidden rounded-xl border border-border/15 bg-foreground/[0.03]"
                    />
                  ))
                : looks.map((look, index) => (
                    <LookTileView key={`look-${look.hero.id}-${index}`} tile={look} />
                  ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};

function LookTileView({ tile }: { tile: LookTile }) {
  const heroSrc = tile.hero.imageUrl && tile.hero.imageUrl.startsWith("http") ? tile.hero.imageUrl : "/placeholder.svg";
  return (
    <div className="group relative grid aspect-[5/3] grid-cols-2 gap-1.5 overflow-hidden rounded-xl border border-border/15 bg-muted/30 p-1.5">
      <Link
        to={`/fit/${tile.hero.id}`}
        className="relative overflow-hidden rounded-lg bg-muted/40"
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
      </Link>
      <div className="grid grid-rows-3 gap-1.5">
        {tile.side.map((item, idx) => {
          const sideSrc = item.imageUrl && item.imageUrl.startsWith("http") ? item.imageUrl : "/placeholder.svg";
          return (
            <Link
              key={`${tile.hero.id}-side-${idx}`}
              to={`/fit/${item.id}`}
              className="overflow-hidden rounded-lg bg-muted/40"
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
            </Link>
          );
        })}
      </div>
    </div>
  );
}

const StyledLooksRow = memo(StyledLooksRowImpl);
StyledLooksRow.displayName = "StyledLooksRow";
export default StyledLooksRow;
