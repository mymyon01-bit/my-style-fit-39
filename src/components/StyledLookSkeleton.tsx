/**
 * Hardcoded skeleton that matches the OutfitLookCard frame exactly.
 * Used while outfit combinations are still being computed so the
 * Styled Looks section never collapses or rebuilds its layout.
 *
 *   [ header row ]
 *   [ hero (3:4) | 3 stacked side slots ]
 */
const StyledLookSkeleton = () => (
  <div className="overflow-hidden rounded-2xl border border-border/20 bg-card/60 backdrop-blur-sm">
    <div className="flex items-center justify-between px-4 pb-2 pt-3.5">
      <div className="flex items-center gap-2">
        <div className="h-3 w-20 rounded bg-foreground/[0.08] animate-pulse" />
        <div className="h-3 w-12 rounded-full bg-foreground/[0.06] animate-pulse" />
      </div>
      <div className="h-3 w-12 rounded bg-foreground/[0.06] animate-pulse" />
    </div>
    <div className="flex gap-1 px-1 pb-1">
      <div className="flex-[1.3] aspect-[3/4] rounded-xl bg-foreground/[0.05] animate-pulse" />
      <div className="flex flex-1 flex-col gap-1">
        <div className="flex-1 rounded-xl bg-foreground/[0.05] animate-pulse" />
        <div className="flex-1 rounded-xl bg-foreground/[0.05] animate-pulse" />
        <div className="flex-1 rounded-xl bg-foreground/[0.05] animate-pulse" />
      </div>
    </div>
  </div>
);

export default StyledLookSkeleton;
