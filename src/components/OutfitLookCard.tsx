import SafeImage, { resolveImageUrl } from "@/components/SafeImage";
import type { GeneratedOutfit } from "@/lib/outfitGenerator";
import { useState, memo, useMemo } from "react";
import { ChevronRight, ImageOff } from "lucide-react";

interface OutfitLookCardProps {
  outfit: GeneratedOutfit;
  index: number;
}

const STYLE_LABELS: Record<string, string> = {
  minimal: "Minimal",
  street: "Streetwear",
  formal: "Formal",
  sporty: "Sporty",
  bohemian: "Bohemian",
  casual: "Casual",
};

/**
 * HARDCODED styled-look card frame.
 * Layout never regenerates: 1 hero (left) + 3 stacked side slots (right).
 * Empty slots are placeholders so the frame never collapses.
 */
const PLACEHOLDER_SLOT = "__placeholder__";

const OutfitLookCardImpl = ({ outfit, index }: OutfitLookCardProps) => {
  const [expanded, setExpanded] = useState(false);

  const { hero, sides, allItems } = useMemo(() => {
    const { top, bottom, shoes, bag, accessory } = outfit.items;
    const items = [top, bottom, shoes, ...(bag ? [bag] : []), ...(accessory ? [accessory] : [])];

    // Pick the best hero: first item with a valid image, else top
    const heroCandidate =
      items.find((it) => resolveImageUrl(it?.image_url)) || top;

    const sideCandidates = items.filter((it) => it && it !== heroCandidate);
    // Always 3 side slots
    while (sideCandidates.length < 3) sideCandidates.push(null as never);

    return {
      hero: heroCandidate,
      sides: sideCandidates.slice(0, 3),
      allItems: items.filter(Boolean),
    };
  }, [outfit]);

  const handleItemClick = (url?: string | null) => {
    if (url) window.open(url, "_blank", "noopener");
  };

  // Fallbacks: try sibling images if hero/side image fails
  const heroFallbacks = useMemo(
    () => allItems.map((it) => it?.image_url).filter(Boolean) as string[],
    [allItems]
  );

  return (
    // Plain div — no enter animation. The frame must stay stable; cards must
    // never re-animate when results stream in or memoization invalidates.
    // Subtle lift on hover/tap is the only motion (premium, not gimmicky).
    <div
      className="overflow-hidden rounded-2xl border border-border/20 bg-card/60 shadow-sm backdrop-blur-sm transition-[transform,box-shadow] duration-200 ease-out animate-fade-in hover:-translate-y-1 hover:shadow-lg active:translate-y-0"
    >

      {/* Header — hardcoded structure */}
      <div className="flex items-center justify-between px-4 pb-2 pt-3.5">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent/70">
            {STYLE_LABELS[outfit.styleLabel] || outfit.styleLabel} look
          </span>
          {/* Match badge — single-shot pulse on first paint, then static */}
          <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[9px] font-medium text-accent/80 animate-badge-pulse-once">
            {outfit.score}% match
          </span>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-[10px] text-foreground/50 transition-colors hover:text-foreground/70"
        >
          {expanded ? "Collapse" : "Details"}
          <ChevronRight className={`h-3 w-3 transition-transform ${expanded ? "rotate-90" : ""}`} />
        </button>
      </div>

      {/* Body — fixed grid: hero + 3 side slots */}
      <div className="flex gap-1 px-1 pb-1">
        {/* Hero */}
        <button
          onClick={() => handleItemClick(hero?.source_url)}
          className="group relative flex-[1.3] overflow-hidden rounded-xl"
        >
          <SafeImage
            src={hero?.image_url || ""}
            alt={hero?.name || "Outfit hero"}
            fallbackSrcs={heroFallbacks}
            eager={index < 2}
            className="aspect-[3/4] w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
          {hero && (
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 to-transparent p-2.5 pt-8">
              <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-white/60">
                {hero.brand}
              </p>
              <p className="line-clamp-1 text-[10px] font-medium text-white/90">{hero.name}</p>
            </div>
          )}
        </button>

        {/* Side items */}
        <div className="flex flex-1 flex-col gap-1">
          {sides.map((item, i) => {
            if (!item) {
              return (
                <div
                  key={`${PLACEHOLDER_SLOT}-${i}`}
                  className="flex flex-1 items-center justify-center rounded-xl bg-foreground/[0.04]"
                  aria-hidden
                >
                  <ImageOff className="h-4 w-4 text-foreground/30" />
                </div>
              );
            }
            return (
              <button
                key={item.id + i}
                onClick={() => handleItemClick(item.source_url)}
                className="group relative flex-1 overflow-hidden rounded-xl"
              >
                <SafeImage
                  src={item.image_url || ""}
                  alt={item.name}
                  fallbackSrcs={heroFallbacks.filter((u) => u !== item.image_url)}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-1.5 pt-5">
                  <p className="line-clamp-1 text-[8px] font-medium text-white/80">{item.name}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Expanded details — fixed list shape */}
      {expanded && (
        <div className="space-y-2 border-t border-border/10 px-4 py-3 animate-fade-in">
          {allItems.map((item, i) => (
            <button
              key={item.id + i}
              onClick={() => handleItemClick(item.source_url)}
              className="flex w-full items-center gap-3 rounded-lg p-1.5 text-left transition-colors hover:bg-foreground/[0.03]"
            >
              <SafeImage
                src={item.image_url || ""}
                alt={item.name}
                fallbackSrcs={heroFallbacks.filter((u) => u !== item.image_url)}
                className="h-10 w-10 rounded-lg object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="line-clamp-1 text-[10px] font-medium text-foreground/80">{item.name}</p>
                <p className="text-[9px] text-foreground/50">
                  {item.brand} · {item.price}
                </p>
              </div>
              <ChevronRight className="h-3 w-3 flex-shrink-0 text-foreground/30" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// Memoize on outfit identity only — index changes (reorder) must not re-render
// the card tree. The frame stays put; only the data inside ever changes.
const OutfitLookCard = memo(OutfitLookCardImpl, (prev, next) => {
  return prev.outfit.id === next.outfit.id;
});

export default OutfitLookCard;
