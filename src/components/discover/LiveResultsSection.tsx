import { memo, useState } from "react";
import { Loader2, Sparkles, Heart, HeartOff, Bookmark } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import FreshnessPill from "@/components/FreshnessPill";
import type { DiscoverRenderableProduct } from "@/lib/search/discover-feed";

/**
 * LAYER 3 — Hardcoded LIVE search result section.
 *
 * Append-only render surface. The shell (header, status pill, grid frame,
 * load-more) never re-mounts — only the children of the grid swap as new
 * fresh products stream in from the search runner.
 */
interface LiveResultsSectionProps {
  query: string;
  visible: DiscoverRenderableProduct[];
  totalAvailable: number;
  isSearching: boolean;
  liveStatus: string;
  freshFlash: { count: number; label: string } | null;
  savedIds: Set<string>;
  feedbackMap: Record<string, "like" | "dislike">;
  onLoadMore: () => void;
  onSelect: (item: DiscoverRenderableProduct) => void;
  onSave: (id: string) => void;
  onFeedback: (id: string, type: "like" | "dislike") => void;
  hasMore: boolean;
}

const LiveResultsSectionImpl = ({
  query,
  visible,
  totalAvailable,
  isSearching,
  liveStatus,
  freshFlash,
  savedIds,
  feedbackMap,
  onLoadMore,
  onSelect,
  onSave,
  onFeedback,
  hasMore,
}: LiveResultsSectionProps) => {
  return (
    <section aria-label="Live discovery" className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.25em] text-foreground/75">
            {query.trim() ? `LIVE RESULTS · "${query.trim().toUpperCase()}"` : "LIVE DISCOVERY"}
          </p>
          <p className="mt-1 text-[10px] text-foreground/55">
            Appending fresh items as they arrive from external stores.
          </p>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-foreground/60">
          <span>{visible.length} / {totalAvailable}</span>
          {isSearching && <Loader2 className="h-3 w-3 animate-spin text-accent/60" />}
        </div>
      </div>

      <FreshnessPill active={isSearching} />

      <div
        className="flex items-center gap-2 rounded-lg border border-accent/10 bg-accent/[0.03] px-3 py-2 text-[10px] tracking-[0.12em] text-accent/70"
        aria-live="polite"
      >
        {isSearching ? <Loader2 className="h-3 w-3 animate-spin" /> : <span className="h-1.5 w-1.5 rounded-full bg-accent/50" />}
        <span>{liveStatus.toUpperCase()}</span>
      </div>

      <AnimatePresence>
        {freshFlash && (
          <motion.div
            key={`${freshFlash.label}-${freshFlash.count}`}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="flex items-center gap-2 rounded-lg border border-accent/30 bg-accent/[0.08] px-3 py-2 text-[10px] font-semibold tracking-[0.18em] text-accent"
          >
            <Sparkles className="h-3 w-3" />
            <span>+{freshFlash.count} {freshFlash.label.toUpperCase()}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 lg:gap-4">
        {visible.length === 0 && isSearching
          ? Array.from({ length: 8 }).map((_, i) => (
              <div key={`live-skeleton-${i}`} className="aspect-[3/4] overflow-hidden rounded-xl bg-foreground/[0.04]">
                <div className="h-full w-full animate-pulse bg-gradient-to-br from-foreground/[0.06] to-foreground/[0.02]" />
              </div>
            ))
          : visible.map((item, index) => (
              <LiveCard
                key={item.id}
                item={item}
                index={index}
                isSaved={savedIds.has(item.id)}
                feedback={feedbackMap[item.id]}
                onFeedback={onFeedback}
                onSelect={onSelect}
                onSave={onSave}
              />
            ))}
      </div>

      {visible.length === 0 && !isSearching && (
        <div className="rounded-xl border border-border/20 bg-card/30 px-5 py-10 text-center">
          <p className="text-[12px] text-foreground/70">No fresh matches surfaced for that search yet.</p>
          <p className="mt-1 text-[10px] text-foreground/50">Try a broader query or another category while inventory expands.</p>
        </div>
      )}

      {hasMore && (
        <div className="flex justify-center pt-2">
          <button
            onClick={onLoadMore}
            className="rounded-full border border-border/30 px-4 py-2 text-[10px] font-semibold tracking-[0.15em] text-foreground/70"
          >
            LOAD MORE
          </button>
        </div>
      )}
    </section>
  );
};

interface LiveCardProps {
  item: DiscoverRenderableProduct;
  index: number;
  isSaved: boolean;
  feedback: "like" | "dislike" | undefined;
  onFeedback: (id: string, type: "like" | "dislike") => void;
  onSave: (id: string) => void;
  onSelect: (item: DiscoverRenderableProduct) => void;
}

function LiveCard({ item, index, isSaved, feedback, onFeedback, onSave, onSelect }: LiveCardProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  if (!item.imageUrl || !item.imageUrl.startsWith("http") || imgFailed) return null;
  const isAboveFold = index < 4;

  return (
    <div className="group cursor-pointer" onClick={() => onSelect(item)}>
      <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-foreground/[0.04]">
        {!imgLoaded && <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-foreground/[0.05] to-foreground/[0.02]" aria-hidden />}
        <img
          src={item.imageUrl}
          alt={item.title}
          className={`h-full w-full object-cover transition-all duration-500 group-hover:scale-105 ${imgLoaded ? "opacity-100" : "opacity-0"}`}
          loading={isAboveFold ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={isAboveFold ? "high" : "low"}
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          onLoad={() => setImgLoaded(true)}
          onError={() => setImgFailed(true)}
        />
        <div className="absolute left-2 top-2 rounded-full bg-background/80 px-2 py-0.5 text-[9px] font-semibold tracking-[0.12em] text-foreground/75 backdrop-blur-sm">
          {item.sourceKey.toUpperCase()}
        </div>
        {item.isUnseen && item.isFresh && (
          <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-accent/90 px-2 py-0.5 text-[9px] font-bold tracking-[0.12em] text-accent-foreground shadow-lg shadow-accent/30">
            <Sparkles className="h-2.5 w-2.5" />
            NEW
          </div>
        )}
        <div className="absolute right-2 top-10 flex flex-col gap-1.5 opacity-0 transition-all group-hover:opacity-100">
          <button
            onClick={(event) => { event.stopPropagation(); onFeedback(item.id, "like"); }}
            className={`flex h-7 w-7 items-center justify-center rounded-full backdrop-blur-md transition-colors ${
              feedback === "like" ? "bg-accent/30 text-accent" : "bg-black/30 text-white/70 hover:text-white"
            }`}
          >
            <Heart className="h-3 w-3" fill={feedback === "like" ? "currentColor" : "none"} />
          </button>
          <button
            onClick={(event) => { event.stopPropagation(); onFeedback(item.id, "dislike"); }}
            className={`flex h-7 w-7 items-center justify-center rounded-full backdrop-blur-md transition-colors ${
              feedback === "dislike" ? "bg-destructive/30 text-destructive" : "bg-black/30 text-white/70 hover:text-white"
            }`}
          >
            <HeartOff className="h-3 w-3" />
          </button>
          <button
            onClick={(event) => { event.stopPropagation(); onSave(item.id); }}
            className={`flex h-7 w-7 items-center justify-center rounded-full backdrop-blur-md transition-colors ${
              isSaved ? "bg-accent/30 text-accent" : "bg-black/30 text-white/70 hover:text-white"
            }`}
          >
            <Bookmark className="h-3 w-3" fill={isSaved ? "currentColor" : "none"} />
          </button>
        </div>
        {item.externalUrl && (
          <div
            onClick={(event) => {
              event.stopPropagation();
              window.open(item.externalUrl!, "_blank", "noopener,noreferrer");
            }}
            className="absolute bottom-2 right-2 rounded-full bg-black/40 px-2.5 py-1 text-[10px] font-medium text-white/80 opacity-0 transition-opacity group-hover:opacity-100"
          >
            SHOP →
          </div>
        )}
      </div>
      <div className="mt-2.5 space-y-0.5 px-0.5">
        {item.brand && <p className="text-[11px] font-medium tracking-[0.1em] text-foreground">{item.brand}</p>}
        <p className="line-clamp-2 text-[12px] font-medium leading-tight text-foreground/90">{item.title}</p>
        {item.price && <p className="text-[11px] font-semibold text-foreground">{item.price}</p>}
        <p className="text-[10px] text-foreground/60">{item.storeName || item.sourceDomain}</p>
      </div>
    </div>
  );
}

const LiveResultsSection = memo(LiveResultsSectionImpl);
LiveResultsSection.displayName = "LiveResultsSection";
export default LiveResultsSection;
