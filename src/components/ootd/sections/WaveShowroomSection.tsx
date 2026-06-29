/**
 * WaveShowroomSection — Combined Wave + Showroom hub.
 * Reference: image 3 (hero card + Wave Highlights row + Trending Showrooms list).
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Loader2, Plus, Sparkles, LayoutGrid } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatCount } from "@/lib/formatCount";
import { useMyWaves, type Wave } from "@/hooks/useWaves";
import { useUserShowrooms } from "@/hooks/useShowrooms";
import { useAuth } from "@/lib/auth";
import CreateWaveDialog from "@/components/ootd/CreateWaveDialog";
import WaveModal from "@/components/ootd/WaveModal";
import { Button } from "@/components/ui/button";

type Sub = "wave" | "showroom";

interface ShowroomRow {
  id: string;
  name: string;
  owner_id: string;
  cover_image_url: string | null;
  item_count: number | null;
  owner_username?: string | null;
  thumbs?: string[];
}

interface Props {
  sub: Sub;
  onSubChange: (s: Sub) => void;
}

const WaveShowroomSection = ({ sub, onSubChange }: Props) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { rooms: myRooms, loading: myRoomsLoading } = useUserShowrooms(user?.id);
  const { waves, loading: wavesLoading, refresh } = useMyWaves();
  const [activeWave, setActiveWave] = useState<Wave | null>(null);
  const [creatingWave, setCreatingWave] = useState(false);
  const [highlights, setHighlights] = useState<{ id: string; image_url: string; star_count: number; caption: string | null }[]>([]);
  const [showrooms, setShowrooms] = useState<ShowroomRow[]>([]);
  const [loadingHighlights, setLoadingHighlights] = useState(true);
  const [loadingShowrooms, setLoadingShowrooms] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("ootd_posts")
        .select("id, image_url, star_count, caption")
        .not("image_url", "is", null)
        .order("star_count", { ascending: false })
        .limit(6);
      if (!cancelled) {
        setHighlights((data ?? []) as any);
        setLoadingHighlights(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("showrooms" as any)
        .select("id, name, owner_id, cover_image_url, item_count")
        .order("item_count", { ascending: false })
        .limit(8);
      if (cancelled) return;
      const rows = (data ?? []) as any as ShowroomRow[];
      if (rows.length) {
        const ids = rows.map((r) => r.owner_id);
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, username")
          .in("user_id", ids);
        const map = new Map((profs ?? []).map((p: any) => [p.user_id, p.username]));
        rows.forEach((r) => { r.owner_username = map.get(r.owner_id) ?? null; });
      }
      if (!cancelled) {
        setShowrooms(rows);
        setLoadingShowrooms(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="mx-auto max-w-md px-5 pb-10 lg:max-w-none lg:px-0">
      {/* Hero banner */}
      <button
        type="button"
        onClick={() => (sub === "wave" ? setCreatingWave(true) : navigate("/showroom/new"))}
        className="mt-4 flex w-full items-stretch overflow-hidden rounded-2xl border border-border bg-card text-left shadow-[var(--shadow-1)]"
      >
        <div className="flex flex-1 flex-col justify-between p-4">
          <div>
            <h2 className="font-display text-[18px] font-medium leading-tight tracking-tight text-foreground">
              {sub === "wave" ? "Share Your Look,\nInspire the World." : "Curate Your Own\nShowroom."}
            </h2>
            <p className="mt-1.5 text-[11.5px] leading-snug text-foreground/55">
              {sub === "wave"
                ? "Join the WAVE. Express your style and get discovered."
                : "Build a themed shop window of your favorite pieces."}
            </p>
          </div>
          <span className="mt-3 inline-flex w-fit items-center gap-1 rounded-full border border-foreground/20 bg-background/80 px-3 py-1.5 text-[11px] font-medium text-foreground">
            {sub === "wave" ? "Join the WAVE" : "New Showroom"}
            <ArrowRight className="h-3 w-3" strokeWidth={1.6} />
          </span>
        </div>
        <div className="relative w-[42%] shrink-0 bg-foreground/[0.05]">
          {highlights[0]?.image_url ? (
            <img
              src={highlights[0].image_url}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              loading="lazy"
            />
          ) : null}
        </div>
      </button>

      {sub === "wave" ? (
        <>
          {/* Wave Highlights */}
          <SectionHeader title="Wave Highlights" onSeeAll={() => onSubChange("wave")} />
          <div className="-mx-5 mt-3 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex gap-3 pb-1">
              {loadingHighlights && Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-[170px] w-[130px] shrink-0 animate-pulse rounded-2xl bg-foreground/[0.06]" />
              ))}
              {highlights.map((h, i) => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => navigate(`/ootd?post=${h.id}`)}
                  className="relative shrink-0 overflow-hidden rounded-2xl bg-foreground/[0.04]"
                  style={{ width: 140, aspectRatio: "3 / 4" }}
                >
                  <img src={h.image_url} alt="" loading="lazy" className="h-full w-full object-cover" />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/90 via-background/40 to-transparent p-2.5">
                    <div className="line-clamp-2 font-display text-[13px] font-medium leading-tight text-foreground">
                      {h.caption ?? ["Minimal Monday", "Neutral Lovers", "All Black Everything", "Soft Summer", "City Minimal", "Monochrome"][i % 6]}
                    </div>
                    <div className="mt-0.5 text-[10px] text-foreground/65">{formatCount(h.star_count)} looks</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* My Waves shortcut */}
          <SectionHeader title="Your Waves" onSeeAll={() => setCreatingWave(true)} seeAllLabel="New" />
          <div className="mt-3 space-y-2">
            {wavesLoading && (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-accent/65" />
              </div>
            )}
            {!wavesLoading && waves.length === 0 && (
              <div className="rounded-xl border border-border bg-card p-5 text-center text-sm text-foreground/55">
                You haven't joined any waves yet.
              </div>
            )}
            {waves.slice(0, 5).map((w) => (
              <button
                key={w.id}
                type="button"
                onClick={() => setActiveWave(w)}
                className="flex w-full items-center justify-between rounded-xl border border-border bg-card p-3 text-left"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-foreground">{w.name}</span>
                  <span className="block text-[11px] text-foreground/55">Tap to open</span>
                </span>
                <ArrowRight className="h-4 w-4 text-foreground/45" strokeWidth={1.6} />
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          {/* Trending Showrooms */}
          <SectionHeader title="Trending Showrooms" onSeeAll={() => navigate("/showroom")} />
          <div className="mt-3 grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
            {loadingShowrooms && (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-accent/65" />
              </div>
            )}
            {!loadingShowrooms && showrooms.length === 0 && (
              <div className="rounded-xl border border-border bg-card p-5 text-center text-sm text-foreground/55 lg:col-span-2 xl:col-span-3">
                No showrooms yet — be the first to curate one.
              </div>
            )}
            {showrooms.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => navigate(`/showroom/${s.id}`)}
                className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-2.5 text-left"
              >
                <span className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-foreground/[0.06]">
                  {s.cover_image_url && (
                    <img src={s.cover_image_url} alt="" className="h-full w-full object-cover" loading="lazy" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-display text-[14px] font-medium text-foreground">{s.name}</span>
                  {s.owner_username && (
                    <span className="block truncate text-[11px] text-foreground/55">by @{s.owner_username}</span>
                  )}
                  <span className="mt-0.5 block text-[10.5px] text-foreground/45">{s.item_count ?? 0} items</span>
                </span>
                <Button size="sm" variant="outline" className="h-7 rounded-full border-border px-3 text-[11px]">
                  Follow
                </Button>
              </button>
            ))}
          </div>
        </>
      )}

      {creatingWave && (
        <CreateWaveDialog
          open={creatingWave}
          onClose={() => setCreatingWave(false)}
          onCreated={() => { refresh(); setCreatingWave(false); }}
        />
      )}
      {activeWave && (
        <WaveModal wave={activeWave} open={!!activeWave} onClose={() => setActiveWave(null)} />
      )}
    </div>
  );
};

const SectionHeader = ({
  title,
  onSeeAll,
  seeAllLabel = "See All",
}: {
  title: string;
  onSeeAll: () => void;
  seeAllLabel?: string;
}) => (
  <div className="mt-6 flex items-baseline justify-between">
    <h3 className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-foreground/75">
      {title}
    </h3>
    <button type="button" onClick={onSeeAll} className="text-[11px] font-medium text-foreground/55 hover:text-accent">
      {seeAllLabel}
    </button>
  </div>
);

export default WaveShowroomSection;
