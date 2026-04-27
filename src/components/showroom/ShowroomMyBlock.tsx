import { Link, useNavigate } from "react-router-dom";
import { LayoutGrid, Plus, Star, Users } from "lucide-react";
import { useUserShowrooms } from "@/hooks/useShowrooms";
import type { Showroom } from "@/lib/showroom/types";

const ShowroomMyBlock = ({ userId }: { userId?: string | null }) => {
  const navigate = useNavigate();
  const { rooms, loading } = useUserShowrooms(userId);

  const handleCreate = () => {
    if (!userId) {
      navigate("/auth?redirect=/showroom/new");
      return;
    }
    navigate("/showroom/new");
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LayoutGrid className="h-3.5 w-3.5 text-foreground/70" />
          <p className="text-[10px] font-medium tracking-[0.25em] text-foreground/70">MY SHOWROOM</p>
        </div>
        <button
          type="button"
          onClick={handleCreate}
          className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/10 px-2.5 py-1 text-[9px] font-semibold tracking-[0.2em] text-accent transition-colors hover:bg-accent/20"
        >
          <Plus className="h-3 w-3" /> NEW
        </button>
      </div>

      {/* Primary CTA — always visible, large, obvious */}
      <button
        type="button"
        onClick={handleCreate}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-foreground/25 bg-background/40 py-3 text-[11px] font-medium tracking-[0.18em] text-foreground/70 uppercase transition-colors hover:border-accent/50 hover:bg-accent/[0.06] hover:text-accent"
      >
        <Plus className="h-4 w-4" />
        Create New Showroom
      </button>

      {userId && !loading && rooms.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {rooms.slice(0, 6).map((r) => <MinimalShowroomCard key={r.id} room={r} />)}
        </div>
      )}

      {!userId && (
        <p className="text-center text-[10px] text-foreground/45">
          Sign in to curate your own style room.
        </p>
      )}
    </div>
  );
};

const MinimalShowroomCard = ({ room }: { room: Showroom }) => (
  <Link
    to={`/showroom/${room.id}`}
    className="group block overflow-hidden rounded-xl border border-border/40 bg-card transition-all hover:-translate-y-0.5 hover:border-foreground/30"
  >
    <div className="relative aspect-square overflow-hidden bg-muted/30">
      {room.banner_url ? (
        <img src={room.banner_url} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-foreground/30">
          <LayoutGrid className="h-5 w-5" />
        </div>
      )}
    </div>
    <div className="space-y-1 p-2">
      <h3 className="line-clamp-1 text-[11px] font-medium text-foreground">{room.title}</h3>
      <div className="flex items-center gap-2 text-[9px] text-foreground/55">
        <span className="inline-flex items-center gap-0.5"><Star className="h-2.5 w-2.5" />{room.star_count}</span>
        <span className="inline-flex items-center gap-0.5"><Users className="h-2.5 w-2.5" />{room.follower_count}</span>
      </div>
    </div>
  </Link>
);

export default ShowroomMyBlock;
