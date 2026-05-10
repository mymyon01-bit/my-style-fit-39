import { useEffect, useRef, useState, useCallback } from "react";
import { Heart, Plus, Loader2, Volume2, VolumeX, Film, Play } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { formatCount } from "@/lib/formatCount";
import { filterCssById } from "@/lib/videoFilters";
import OOTDShortUploadSheet from "./OOTDShortUploadSheet";

interface VideoRow {
  id: string;
  user_id: string;
  video_url: string;
  thumb_url: string | null;
  caption: string | null;
  duration_s: number;
  like_count: number;
  view_count: number;
  created_at: string;
  tags?: string[] | null;
  filter?: string | null;
  profile?: { display_name: string | null; username: string | null; avatar_url: string | null } | null;
  liked?: boolean;
}

const PAGE_SIZE = 20;

const VideoCard = ({
  v,
  active,
  muted,
  onToggleMute,
  onLike,
  onAuthorClick,
}: {
  v: VideoRow;
  active: boolean;
  muted: boolean;
  onToggleMute: () => void;
  onLike: () => void;
  onAuthorClick: (uid: string) => void;
}) => {
  const ref = useRef<HTMLVideoElement>(null);
  const [showPlay, setShowPlay] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (active) {
      el.currentTime = 0;
      const p = el.play();
      if (p && typeof p.then === "function") {
        p.catch(() => setShowPlay(true));
      }
    } else {
      el.pause();
    }
  }, [active]);

  return (
    <div className="relative h-full w-full snap-start snap-always flex items-center justify-center bg-black">
      <video
        ref={ref}
        src={v.video_url}
        poster={v.thumb_url || undefined}
        playsInline
        loop
        muted={muted}
        preload={active ? "auto" : "metadata"}
        onClick={() => {
          const el = ref.current;
          if (!el) return;
          if (el.paused) {
            el.play();
            setShowPlay(false);
          } else {
            el.pause();
            setShowPlay(true);
          }
        }}
        style={{ filter: filterCssById(v.filter) }}
        className="h-full w-full object-contain"
      />
      {showPlay && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="rounded-full bg-black/45 p-4 backdrop-blur-sm">
            <Play className="h-8 w-8 fill-white text-white" />
          </div>
        </div>
      )}

      {/* Mute toggle */}
      <button
        onClick={onToggleMute}
        className="absolute top-3 right-3 rounded-full bg-black/45 p-1.5 text-white backdrop-blur-md"
      >
        {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
      </button>

      {/* Right rail: like — pushed above bottom nav on mobile */}
      <div className="absolute right-3 bottom-[calc(6rem+72px+env(safe-area-inset-bottom))] md:bottom-24 flex flex-col items-center gap-4">
        <button
          onClick={onLike}
          className="flex flex-col items-center gap-1 active:scale-90 transition-transform"
        >
          <span className="rounded-full bg-black/45 p-2.5 backdrop-blur-md">
            <Heart
              className={`h-6 w-6 ${v.liked ? "fill-rose-500 text-rose-500" : "text-white"}`}
              strokeWidth={2}
            />
          </span>
          <span className="text-[11px] font-semibold text-white drop-shadow">
            {formatCount(v.like_count)}
          </span>
        </button>
      </div>

      {/* Bottom: author + caption + tags */}
      <div className="absolute bottom-0 inset-x-0 px-3 pb-[calc(1.5rem+72px+env(safe-area-inset-bottom))] md:pb-6 pt-12 bg-gradient-to-t from-black/80 to-transparent">
        <button
          onClick={() => onAuthorClick(v.user_id)}
          className="flex items-center gap-2 mb-2"
        >
          <div className="h-8 w-8 rounded-full overflow-hidden bg-white/15 ring-1 ring-white/30">
            {v.profile?.avatar_url ? (
              <img src={v.profile.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[11px] text-white font-medium">
                {(v.profile?.display_name || v.profile?.username || "?")[0]?.toUpperCase()}
              </div>
            )}
          </div>
          <span className="text-[13px] font-semibold text-white drop-shadow">
            @{v.profile?.username || v.profile?.display_name || "user"}
          </span>
        </button>
        {v.caption && (
          <p className="text-[12px] text-white/95 drop-shadow line-clamp-3">{v.caption}</p>
        )}
        {v.tags && v.tags.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {v.tags.slice(0, 6).map((t) => (
              <span key={t} className="text-[11px] font-semibold text-white/95 drop-shadow">
                #{t}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default function OOTDShortsFeed() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [videos, setVideos] = useState<VideoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [muted, setMuted] = useState(true);
  const [activeIdx, setActiveIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("ootd_videos")
      .select("id, user_id, video_url, thumb_url, caption, duration_s, like_count, view_count, created_at")
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE);
    if (error) {
      toast.error("Couldn't load videos");
      setLoading(false);
      return;
    }
    const rows = (data || []) as VideoRow[];
    const ids = [...new Set(rows.map((r) => r.user_id))];
    let profiles: Record<string, any> = {};
    if (ids.length) {
      const { data: ps } = await supabase
        .from("profiles")
        .select("user_id, display_name, username, avatar_url")
        .in("user_id", ids);
      for (const p of ps || []) profiles[(p as any).user_id] = p;
    }
    let liked: Set<string> = new Set();
    if (user && rows.length) {
      const { data: ls } = await supabase
        .from("ootd_video_likes")
        .select("video_id")
        .eq("user_id", user.id)
        .in("video_id", rows.map((r) => r.id));
      liked = new Set((ls || []).map((l: any) => l.video_id));
    }
    setVideos(
      rows.map((r) => ({
        ...r,
        profile: profiles[r.user_id] || null,
        liked: liked.has(r.id),
      })),
    );
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  // Track which video is in view
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting && e.intersectionRatio > 0.6) {
            const idx = Number((e.target as HTMLElement).dataset.idx);
            if (!Number.isNaN(idx)) setActiveIdx(idx);
          }
        });
      },
      { root, threshold: [0.6] },
    );
    root.querySelectorAll("[data-idx]").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [videos]);

  const handleLike = async (idx: number) => {
    if (!user) {
      toast.error("Sign in to like");
      return;
    }
    const v = videos[idx];
    const wasLiked = !!v.liked;
    setVideos((prev) =>
      prev.map((x, i) =>
        i === idx
          ? { ...x, liked: !wasLiked, like_count: Math.max(0, x.like_count + (wasLiked ? -1 : 1)) }
          : x,
      ),
    );
    if (wasLiked) {
      await supabase
        .from("ootd_video_likes")
        .delete()
        .eq("video_id", v.id)
        .eq("user_id", user.id);
    } else {
      await supabase
        .from("ootd_video_likes")
        .insert({ video_id: v.id, user_id: user.id });
    }
  };

  return (
    <div className="relative -mx-4 md:-mx-10 lg:-mx-12">
      <div
        ref={containerRef}
        className="relative h-[calc(100dvh-200px)] md:h-[calc(100dvh-180px)] overflow-y-scroll snap-y snap-mandatory scrollbar-hide rounded-2xl bg-black"
      >
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-white/60" />
          </div>
        ) : videos.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-center px-6">
            <Film className="h-8 w-8 text-white/50" />
            <p className="text-[13px] text-white/85">No #OOTD videos yet</p>
            <p className="text-[11px] text-white/50">Be the first to drop a 60-second look</p>
            <button
              onClick={() => (user ? setUploadOpen(true) : navigate("/auth"))}
              className="mt-2 rounded-full bg-white text-black px-4 py-2 text-[12px] font-semibold"
            >
              Upload video
            </button>
          </div>
        ) : (
          videos.map((v, i) => (
            <div key={v.id} data-idx={i} className="relative h-full w-full">
              <VideoCard
                v={v}
                active={i === activeIdx}
                muted={muted}
                onToggleMute={() => setMuted((m) => !m)}
                onLike={() => handleLike(i)}
                onAuthorClick={(uid) => navigate(`/user/${uid}`)}
              />
            </div>
          ))
        )}

        {/* Floating upload button */}
        <button
          onClick={() => (user ? setUploadOpen(true) : navigate("/auth"))}
          aria-label="Upload OOTD video"
          className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 rounded-full bg-gradient-to-r from-[hsl(330_85%_60%)] to-[hsl(280_70%_55%)] px-4 py-2.5 text-[12px] font-semibold text-white shadow-xl shadow-black/40"
        >
          <Plus className="h-4 w-4" />
          Post #OOTD
        </button>
      </div>

      <OOTDShortUploadSheet
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onPosted={load}
      />
    </div>
  );
}
