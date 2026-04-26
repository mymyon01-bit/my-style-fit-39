import { Link, useNavigate } from "react-router-dom";
import { LayoutGrid, Plus, Star, Users } from "lucide-react";
import { useUserShowrooms } from "@/hooks/useShowrooms";
import type { Showroom } from "@/lib/showroom/types";

const ShowroomMyBlock = ({ userId }: { userId?: string | null }) => {
  const navigate = useNavigate();
  const { rooms, loading } = useUserShowrooms(userId);
  if (!userId || loading) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LayoutGrid className="h-3.5 w-3.5 text-foreground/70" />
          <p className="text-[10px] font-medium tracking-[0.25em] text-foreground/70">MY SHOWROOM</p>
        </div>
      </div>

      {/* BUILD YOUR OWN — gentle nudge above the + tile */}
      <p className="text-center text-[10px] font-medium tracking-[0.22em] text-foreground/45 uppercase">
        Build your own
      </p>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <button
          onClick={() => navigate("/showroom/new")}
          className="flex aspect-square items-center justify-center rounded-xl border border-dashed border-foreground/20 text-foreground/55 transition-colors hover:border-foreground/40 hover:text-foreground"
          aria-label="Create new Showroom"
        >
          <Plus className="h-5 w-5" />
        </button>
        {rooms.slice(0, 5).map((r) => <MinimalShowroomCard key={r.id} room={r} />)}
      </div>
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
