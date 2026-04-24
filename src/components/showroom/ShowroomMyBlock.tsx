import { Link, useNavigate } from "react-router-dom";
import { LayoutGrid, Plus } from "lucide-react";
import { useUserShowrooms } from "@/hooks/useShowrooms";
import { ShowroomCard } from "./ShowroomCard";

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
        <button onClick={() => navigate("/showroom/new")} className="flex items-center gap-1 text-[11px] font-medium text-accent/70 hover:text-accent">
          <Plus className="h-3 w-3" /> NEW
        </button>
      </div>
      {rooms.length === 0 ? (
        <Link to="/showroom/new" className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-foreground/15 p-6 text-xs text-foreground/60 hover:border-foreground/30">
          <Plus className="h-4 w-4" /> Create your first Showroom
        </Link>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {rooms.slice(0, 6).map((r) => <ShowroomCard key={r.id} room={r} />)}
        </div>
      )}
    </div>
  );
};

export default ShowroomMyBlock;
