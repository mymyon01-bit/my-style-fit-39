import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Plus, Sparkles, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUserShowrooms, useHotShowrooms, usePublicShowrooms } from "@/hooks/useShowrooms";
import { ShowroomCard } from "@/components/showroom/ShowroomCard";

const ShowroomBrowsePage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { rooms: mine } = useUserShowrooms(user?.id);
  const { rooms: hot } = useHotShowrooms(8);
  const { rooms: latest } = usePublicShowrooms(24);

  return (
    <div className="min-h-screen bg-background pb-28">
      {/* Header */}
      <div className="sticky-header sticky top-0 z-10 border-b border-foreground/10 bg-background/90 px-3 pb-2.5 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="font-display text-base sm:text-lg truncate">Showroom</h1>
            <p className="text-[9px] uppercase tracking-widest text-foreground/50 truncate">Curate your taste · not a store</p>
          </div>
          <Button size="sm" onClick={() => navigate("/showroom/new")} className="h-8 gap-1 px-2.5 text-[11px]">
            <Plus className="h-3.5 w-3.5" /> New
          </Button>
        </div>
      </div>

      <div className="mx-auto max-w-6xl space-y-10 px-4 py-6">
        {/* Mine */}
        {user && (
          <section>
            <header className="mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-accent" />
              <h2 className="font-display text-base">My Showrooms</h2>
            </header>
            {mine.length === 0 ? (
              <div className="rounded-xl border border-dashed border-foreground/15 p-10 text-center">
                <p className="text-sm text-foreground/60">You haven't created a showroom yet.</p>
                <Button size="sm" variant="outline" onClick={() => navigate("/showroom/new")} className="mt-3 gap-1.5">
                  <Plus className="h-4 w-4" /> Create your first room
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {mine.map((r) => <ShowroomCard key={r.id} room={r} />)}
              </div>
            )}
          </section>
        )}

        {/* Hot */}
        {hot.length > 0 && (
          <section>
            <header className="mb-3 flex items-center gap-2">
              <Flame className="h-4 w-4 text-orange-500" />
              <h2 className="font-display text-base">Hot Showrooms</h2>
            </header>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {hot.map((r) => <ShowroomCard key={r.id} room={r} />)}
            </div>
          </section>
        )}

        {/* Latest */}
        {latest.length > 0 && (
          <section>
            <header className="mb-3">
              <h2 className="font-display text-base">New rooms</h2>
            </header>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {latest.map((r) => <ShowroomCard key={r.id} room={r} />)}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default ShowroomBrowsePage;
