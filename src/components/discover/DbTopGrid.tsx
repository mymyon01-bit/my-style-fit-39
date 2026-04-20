import { memo } from "react";
import type { Product } from "@/lib/search/types";

/**
 * LAYER 1 — Hardcoded top DB recommendation grid.
 *
 * Renders a fixed 4-column (responsive: 2/3/4) grid shell. Content swaps
 * inside, the shell never re-mounts. Skeletons fill empty slots so layout
 * never collapses while the DB query is in-flight.
 */
interface DbTopGridProps {
  products: Product[];
  loading: boolean;
  onSelect: (product: Product) => void;
}

const SLOT_COUNT = 8;

const DbTopGridImpl = ({ products, loading, onSelect }: DbTopGridProps) => {
  const slots: (Product | null)[] = Array.from({ length: SLOT_COUNT }, (_, i) => products[i] ?? null);

  return (
    <section aria-label="Top picks from inventory" className="space-y-3">
      <div className="flex items-baseline justify-between">
        <p className="text-[10px] font-semibold tracking-[0.25em] text-foreground/75">TOP PICKS</p>
        <p className="text-[10px] text-foreground/55">Instant from inventory</p>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 lg:gap-4">
        {slots.map((product, index) => (
          <DbTopGridSlot key={product?.id ?? `db-slot-${index}`} product={product} loading={loading && !product} onSelect={onSelect} />
        ))}
      </div>
    </section>
  );
};

interface SlotProps {
  product: Product | null;
  loading: boolean;
  onSelect: (product: Product) => void;
}

function DbTopGridSlot({ product, loading, onSelect }: SlotProps) {
  if (!product) {
    return (
      <div className="aspect-[3/4] overflow-hidden rounded-xl bg-foreground/[0.04]">
        {loading && <div className="h-full w-full animate-pulse bg-gradient-to-br from-foreground/[0.06] to-foreground/[0.02]" aria-hidden />}
      </div>
    );
  }
  const src = product.imageUrl && product.imageUrl.startsWith("http") ? product.imageUrl : null;
  if (!src && typeof window !== "undefined") {
    console.log("PRODUCT IMAGE:", product.id, product.imageUrl);
  }
  return (
    <button
      type="button"
      onClick={() => onSelect(product)}
      className="group relative block w-full text-left"
    >
      <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-muted/40">
        <img
          src={src || "/placeholder.svg"}
          alt={product.title}
          loading="lazy"
          decoding="async"
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          className="h-full w-full object-cover transition-all duration-500 group-hover:scale-105"
          onError={(e) => { e.currentTarget.src = "/placeholder.svg"; }}
        />
        <div className="absolute left-2 top-2 rounded-full bg-background/80 px-2 py-0.5 text-[9px] font-semibold tracking-[0.12em] text-foreground/75 backdrop-blur-sm">
          {(product.source || "store").toUpperCase()}
        </div>
      </div>
      <div className="mt-2 space-y-0.5 px-0.5">
        {product.brand && <p className="text-[11px] font-medium tracking-[0.1em] text-foreground">{product.brand}</p>}
        <p className="line-clamp-2 text-[12px] font-medium leading-tight text-foreground/90">{product.title}</p>
        {product.price && <p className="text-[11px] font-semibold text-foreground">{product.price}</p>}
      </div>
    </button>
  );
}

const DbTopGrid = memo(DbTopGridImpl);
DbTopGrid.displayName = "DbTopGrid";
export default DbTopGrid;
