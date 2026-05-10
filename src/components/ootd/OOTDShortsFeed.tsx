import { useEffect, useRef, useState, useCallback } from "react";
import { Heart, Loader2, Volume2, VolumeX, Film, Play, ThumbsDown, Bookmark, Share2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { formatCount } from "@/lib/formatCount";
import { filterCssById } from "@/lib/videoFilters";


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
  onDislike,
  onSave,
  onShare,
  onAuthorClick,
  saved,
}: {
  v: VideoRow;
  active: boolean;
  muted: boolean;
  onToggleMute: () => void;
  onLike: () => void;
  onDislike: () => void;
  onSave: () => void;
  onShare: () => void;
  onAuthorClick: (uid: string) => void;
  saved: boolean;
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
        className="h-full w-full object-cover"
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

      {/* Right rail: like / dislike / save / share — pushed above bottom nav on mobile */}
      <div className="absolute right-3 bottom-[calc(5rem+72px+env(safe-area-inset-bottom))] md:bottom-24 flex flex-col items-center gap-3.5">
        <button
          onClick={onLike}
          className="flex flex-col items-center gap-1 active:scale-90 transition-transform"
          aria-label="Like"
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
        <button
          onClick={onDislike}
          className="flex flex-col items-center gap-1 active:scale-90 transition-transform"
          aria-label="Not for me"
        >
          <span className="rounded-full bg-black/45 p-2.5 backdrop-blur-md">
            <ThumbsDown className="h-5 w-5 text-white" strokeWidth={2} />
          </span>
        </button>
        <button
          onClick={onSave}
          className="flex flex-col items-center gap-1 active:scale-90 transition-transform"
          aria-label="Save"
        >
          <span className="rounded-full bg-black/45 p-2.5 backdrop-blur-md">
            <Bookmark
              className={`h-5 w-5 ${saved ? "fill-white text-white" : "text-white"}`}
              strokeWidth={2}
            />
          </span>
        </button>
        <button
          onClick={onShare}
          className="flex flex-col items-center gap-1 active:scale-90 transition-transform"
          aria-label="Share"
        >
          <span className="rounded-full bg-black/45 p-2.5 backdrop-blur-md">
            <Share2 className="h-5 w-5 text-white" strokeWidth={2} />
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
  
  const [muted, setMuted] = useState(true);
  const [activeIdx, setActiveIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("ootd_videos")
      .select("id, user_id, video_url, thumb_url, caption, duration_s, like_count, view_count, created_at, tags, filter")
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

  const [savedSet, setSavedSet] = useState<Set<string>>(new Set());
  const [hiddenSet, setHiddenSet] = useState<Set<string>>(new Set());

  const handleSave = (idx: number) => {
    const v = videos[idx];
    setSavedSet((prev) => {
      const next = new Set(prev);
      if (next.has(v.id)) {
        next.delete(v.id);
        toast("Removed from saved");
      } else {
        next.add(v.id);
        toast.success("Saved");
      }
      return next;
    });
  };

  const handleDislike = (idx: number) => {
    const v = videos[idx];
    setHiddenSet((prev) => new Set(prev).add(v.id));
    toast("We'll show you fewer like this");
  };

  const handleShare = async (idx: number) => {
    const v = videos[idx];
    const url = `${window.location.origin}/ootd?v=${v.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "OOTD", text: v.caption || "Check out this OOTD", url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied");
      }
    } catch {
      // user cancelled
    }
  };

  const visibleVideos = videos.filter((v) => !hiddenSet.has(v.id));

  return (
    <div className="relative -mx-4 md:-mx-10 lg:-mx-12">
      <div
        ref={containerRef}
        className="relative h-[calc(100dvh-200px-env(safe-area-inset-bottom))] md:h-[calc(100dvh-180px)] overflow-y-scroll snap-y snap-mandatory scrollbar-hide rounded-2xl bg-black"
      >
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-white/60" />
          </div>
        ) : videos.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-center px-6">
            <Film className="h-8 w-8 text-white/50" />
            <p className="text-[13px] text-white/85">No #OOTD videos yet</p>
            <p className="text-[11px] text-white/50">Post a video from your OOTD upload</p>
          </div>
        ) : (
          visibleVideos.map((v, i) => (
            <div key={v.id} data-idx={i} className="relative h-full w-full">
              <VideoCard
                v={v}
                active={i === activeIdx}
                muted={muted}
                onToggleMute={() => setMuted((m) => !m)}
                onLike={() => handleLike(videos.indexOf(v))}
                onDislike={() => handleDislike(videos.indexOf(v))}
                onSave={() => handleSave(videos.indexOf(v))}
                onShare={() => handleShare(videos.indexOf(v))}
                saved={savedSet.has(v.id)}
                onAuthorClick={(uid) => navigate(`/user/${uid}`)}
              />
            </div>
          ))
        )}
      </div>

    </div>
  );
}
