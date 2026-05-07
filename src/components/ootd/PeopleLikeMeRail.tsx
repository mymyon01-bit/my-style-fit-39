import { usePeopleLikeMe } from "@/hooks/usePeopleLikeMe";

interface Props {
  onOpen: (postId: string) => void;
}

/**
 * Editorial rail of OOTD looks from users with similar body proportions
 * or style preferences. Falls back to top curated when no match.
 */
export default function PeopleLikeMeRail({ onOpen }: Props) {
  const { posts, loading } = usePeopleLikeMe(10);

  if (loading) {
    return (
      <div className="space-y-2">
        <div className="h-3 w-44 bg-foreground/[0.06] rounded animate-pulse" />
        <div className="flex gap-2 overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] w-32 shrink-0 rounded-lg bg-foreground/[0.04] animate-pulse" />
          ))}
        </div>
      </div>
    );
  }
  if (posts.length === 0) return null;
  const reason = posts[0]?.reason || "Curated for you";

  return (
    <section className="space-y-2.5">
      <div className="flex items-baseline justify-between">
        <div>
          <h3 className="font-serif text-[15px] tracking-tight text-foreground/90">People like you</h3>
          <p className="text-[10px] text-foreground/50">{reason}</p>
        </div>
        <span className="text-[9px] tracking-[0.22em] text-foreground/35">FIT REFERENCE</span>
      </div>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-hide snap-x">
        {posts.map((p) => (
          <button
            key={p.id}
            onClick={() => onOpen(p.id)}
            className="relative aspect-[3/4] w-36 shrink-0 overflow-hidden rounded-lg bg-foreground/[0.04] ring-1 ring-accent/10 snap-start group"
          >
            <img
              src={p.image_url}
              alt={p.caption || "look"}
              loading="lazy"
              className="w-full h-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.03]"
            />
          </button>
        ))}
      </div>
    </section>
  );
}
