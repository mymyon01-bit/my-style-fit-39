import { memo } from "react";
import { Sparkles } from "lucide-react";
import type { Product } from "@/lib/search/types";

/**
 * LAYER 2 — Hardcoded Styled Looks shell.
 *
 * This shell NEVER reorders or rebuilds itself based on incoming search
 * data. It composes editorial "look" tiles from whatever Layer 1 / Layer 3
 * inventory is already loaded so the user always sees a styled grouping
 * even before live discovery completes.
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
  const looks = buildLooks(products);
  // Render fixed-height shell even when looks are empty — layer never collapses.
  return (
    <section aria-label="Styled looks" className="space-y-3">
      <div className="flex items-baseline justify-between">
        <p className="text-[10px] font-semibold tracking-[0.25em] text-foreground/75">STYLED LOOKS</p>
        <p className="text-[10px] text-foreground/55">Editorial pairings from current inventory</p>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 lg:gap-4">
        {looks.length === 0
          ? Array.from({ length: 3 }).map((_, i) => (
              <div
                key={`look-skeleton-${i}`}
                className="aspect-[5/3] overflow-hidden rounded-xl border border-border/15 bg-foreground/[0.03]"
              />
            ))
          : looks.map((look, index) => <LookTileView key={`look-${look.hero.id}-${index}`} tile={look} />)}
      </div>
    </section>
  );
};

function LookTileView({ tile }: { tile: LookTile }) {
  return (
    <div className="group relative grid aspect-[5/3] grid-cols-2 gap-1.5 overflow-hidden rounded-xl border border-border/15 bg-foreground/[0.03] p-1.5">
      <div className="relative overflow-hidden rounded-lg bg-foreground/[0.05]">
        {tile.hero.imageUrl && (
          <img
            src={tile.hero.imageUrl}
            alt={tile.hero.title}
            loading="lazy"
            decoding="async"
            sizes="(max-width: 640px) 50vw, 25vw"
            className="h-full w-full object-cover"
          />
        )}
        <div className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded-full bg-background/80 px-2 py-0.5 text-[9px] font-semibold tracking-[0.15em] text-foreground/80 backdrop-blur-sm">
          <Sparkles className="h-2.5 w-2.5 text-accent/70" />
          {tile.label.toUpperCase()}
        </div>
      </div>
      <div className="grid grid-rows-3 gap-1.5">
        {tile.side.map((item, idx) => (
          <div key={`${tile.hero.id}-side-${idx}`} className="overflow-hidden rounded-lg bg-foreground/[0.05]">
            {item.imageUrl && (
              <img
                src={item.imageUrl}
                alt={item.title}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover"
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const StyledLooksRow = memo(StyledLooksRowImpl);
StyledLooksRow.displayName = "StyledLooksRow";
export default StyledLooksRow;
