import { Link } from "react-router-dom";
import { Flame, Plus } from "lucide-react";
import { useHotShowrooms } from "@/hooks/useShowrooms";
import { ShowroomCard } from "./ShowroomCard";

const HotShowroomSection = () => {
  const { rooms, loading } = useHotShowrooms(8);
  if (loading) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flame className="h-4 w-4 text-orange-500" />
          <p className="text-[10px] font-medium tracking-[0.25em] text-foreground/70">HOT SHOWROOM</p>
        </div>
        <Link to="/showroom" className="text-[11px] font-medium text-accent/70 hover:text-accent">VIEW ALL</Link>
      </div>
      {rooms.length === 0 ? (
        <Link to="/showroom/new" className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-foreground/15 p-6 text-xs text-foreground/60 hover:border-foreground/30">
          <Plus className="h-4 w-4" /> Create the first Showroom
        </Link>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {rooms.map((r) => <ShowroomCard key={r.id} room={r} />)}
        </div>
      )}
    </section>
  );
};

export default HotShowroomSection;
