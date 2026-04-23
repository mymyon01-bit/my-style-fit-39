import { memo, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import type { Product } from "@/lib/search/types";

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
  for (let i = 0; i < Math.min(3, Math.floor(products.length / 4)); i += 1) {
    const slice = products.slice(i * 4, i * 4 + 4);
    if (slice.length < 4) break;

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
  const looks = useMemo(() => buildLooks(products), [products]);

  if (looks.length === 0) return null;

  return (
    <section aria-label="Styled looks" className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <p className="text-[10px] font-semibold tracking-[0.25em] text-foreground/75">STYLED LOOKS</p>
          <span className="rounded-full bg-foreground/[0.06] px-1.5 py-0.5 text-[9px] font-medium text-foreground/55">
            {looks.length}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="inline-flex items-center gap-2 rounded-full border border-border/40 bg-background px-3 py-1.5 text-[10px] font-semibold tracking-[0.14em] text-foreground transition-colors hover:bg-muted/40"
          aria-expanded={open}
          aria-controls="styled-looks-panel"
        >
          <Sparkles className="h-3 w-3 text-accent/80" />
          {open ? "CLOSE LOOKS" : "OPEN LOOKS"}
        </button>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id="styled-looks-panel"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 lg:gap-4"
          >
            {looks.map((look, index) => (
              <LookTileView
                key={`look-${look.hero.id}-${index}`}
                tile={look}
                onSelect={onSelect}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};

function LookTileView({
  tile,
  onSelect,
}: {
  tile: LookTile;
  onSelect?: (product: Product) => void;
}) {
  const heroSrc = tile.hero.imageUrl?.startsWith("http") ? tile.hero.imageUrl : "/placeholder.svg";

  return (
    <div className="grid aspect-[5/3] grid-cols-2 gap-1.5 overflow-hidden rounded-xl border border-border/15 bg-muted/30 p-1.5">
      <button
        type="button"
        onClick={() => onSelect?.(tile.hero)}
        className="relative overflow-hidden rounded-lg bg-muted/40 text-left"
        aria-label={`View ${tile.hero.title}`}
      >
        <img
          src={heroSrc}
          alt={tile.hero.title}
          loading="lazy"
          decoding="async"
          sizes="(max-width: 640px) 50vw, 25vw"
          className="h-full w-full object-cover transition-transform duration-500 hover:scale-[1.03]"
          onError={(e) => {
            e.currentTarget.src = "/placeholder.svg";
          }}
        />
        <div className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded-full bg-background/80 px-2 py-0.5 text-[9px] font-semibold tracking-[0.15em] text-foreground/80 backdrop-blur-sm">
          <Sparkles className="h-2.5 w-2.5 text-accent/70" />
          {tile.label.toUpperCase()}
        </div>
      </button>

      <div className="grid grid-rows-3 gap-1.5">
        {tile.side.map((item, idx) => {
          const sideSrc = item.imageUrl?.startsWith("http") ? item.imageUrl : "/placeholder.svg";

          return (
            <button
              type="button"
              key={`${tile.hero.id}-side-${idx}`}
              onClick={() => onSelect?.(item)}
              className="overflow-hidden rounded-lg bg-muted/40 text-left"
              aria-label={`View ${item.title}`}
            >
              <img
                src={sideSrc}
                alt={item.title}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover transition-transform duration-500 hover:scale-[1.05]"
                onError={(e) => {
                  e.currentTarget.src = "/placeholder.svg";
                }}
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
