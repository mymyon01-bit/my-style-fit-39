const Skeleton = ({ className = "" }: { className?: string }) => (
  <div className={`animate-pulse rounded-lg bg-muted ${className}`} />
);

export const ProductCardSkeleton = () => (
  <div className="animate-fade-up">
    <Skeleton className="aspect-[3/4] w-full rounded-xl" />
    <div className="mt-2.5 space-y-1.5">
      <Skeleton className="h-3 w-16" />
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-4 w-14" />
      <Skeleton className="h-3 w-full" />
    </div>
  </div>
);

export const OutfitCardSkeleton = () => (
  <div className="min-w-[280px] rounded-xl border border-border bg-card p-3">
    <div className="flex gap-2">
      <Skeleton className="h-28 w-20 rounded-lg" />
      <Skeleton className="h-28 w-20 rounded-lg" />
      <Skeleton className="h-28 w-20 rounded-lg" />
    </div>
    <div className="mt-2.5 space-y-1.5">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-3 w-16" />
    </div>
  </div>
);

export const OOTDPostSkeleton = () => (
  <div className="overflow-hidden rounded-2xl border border-border bg-card">
    <Skeleton className="aspect-[3/4] w-full" />
    <div className="p-3 space-y-2">
      <div className="flex gap-1.5">
        <Skeleton className="h-5 w-14 rounded-full" />
        <Skeleton className="h-5 w-14 rounded-full" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-9 flex-1 rounded-lg" />
        <Skeleton className="h-9 flex-1 rounded-lg" />
      </div>
    </div>
  </div>
);

export default Skeleton;
