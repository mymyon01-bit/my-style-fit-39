import { motion } from "framer-motion";
import SafeImage from "@/components/SafeImage";
import type { GeneratedOutfit } from "@/lib/outfitGenerator";
import { useState } from "react";
import { ChevronRight } from "lucide-react";

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

const OutfitLookCard = ({ outfit, index }: OutfitLookCardProps) => {
  const [expanded, setExpanded] = useState(false);
  const { top, bottom, shoes, bag, accessory } = outfit.items;
  const allItems = [top, bottom, shoes, ...(bag ? [bag] : []), ...(accessory ? [accessory] : [])];
  const heroItem = top;
  const sideItems = [bottom, shoes, ...(bag ? [bag] : []), ...(accessory ? [accessory] : [])];

  const handleItemClick = (url?: string | null) => {
    if (url) window.open(url, "_blank", "noopener");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.45, ease: [0.23, 1, 0.32, 1] }}
      className="overflow-hidden rounded-2xl border border-border/20 bg-card/60 backdrop-blur-sm"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold tracking-[0.2em] text-accent/70 uppercase">
            {STYLE_LABELS[outfit.styleLabel] || outfit.styleLabel} look
          </span>
          <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[9px] font-medium text-accent/80">
            {outfit.score}% match
          </span>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-[10px] text-foreground/50 hover:text-foreground/70 transition-colors"
        >
          {expanded ? "Collapse" : "Details"}
          <ChevronRight className={`h-3 w-3 transition-transform ${expanded ? "rotate-90" : ""}`} />
        </button>
      </div>

      {/* Outfit grid: hero + side items */}
      <div className="flex gap-1 px-1 pb-1">
        {/* Hero (top) */}
        <button
          onClick={() => handleItemClick(heroItem.source_url)}
          className="relative flex-[1.3] overflow-hidden rounded-xl group"
        >
          <SafeImage
            src={heroItem.image_url || ""}
            alt={heroItem.name}
            className="aspect-[3/4] w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 to-transparent p-2.5 pt-8">
            <p className="text-[9px] font-semibold tracking-[0.12em] text-white/60 uppercase">{heroItem.brand}</p>
            <p className="text-[10px] font-medium text-white/90 line-clamp-1">{heroItem.name}</p>
          </div>
        </button>

        {/* Side items */}
        <div className="flex flex-1 flex-col gap-1">
          {sideItems.slice(0, 3).map((item, i) => (
            <button
              key={item.id + i}
              onClick={() => handleItemClick(item.source_url)}
              className="relative flex-1 overflow-hidden rounded-xl group"
            >
              <SafeImage
                src={item.image_url || ""}
                alt={item.name}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-1.5 pt-5">
                <p className="text-[8px] font-medium text-white/80 line-clamp-1">{item.name}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="border-t border-border/10 px-4 py-3 space-y-2"
        >
          {allItems.map((item, i) => (
            <button
              key={item.id + i}
              onClick={() => handleItemClick(item.source_url)}
              className="flex w-full items-center gap-3 rounded-lg p-1.5 text-left hover:bg-foreground/[0.03] transition-colors"
            >
              <SafeImage
                src={item.image_url || ""}
                alt={item.name}
                className="h-10 w-10 rounded-lg object-cover"
              />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-medium text-foreground/80 line-clamp-1">{item.name}</p>
                <p className="text-[9px] text-foreground/50">{item.brand} · {item.price}</p>
              </div>
              <ChevronRight className="h-3 w-3 text-foreground/30 flex-shrink-0" />
            </button>
          ))}
        </motion.div>
      )}
    </motion.div>
  );
};

export default OutfitLookCard;
