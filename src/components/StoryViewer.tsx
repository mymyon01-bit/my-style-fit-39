import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Trash2, Heart, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { openConversationWith } from "@/hooks/useMessages";
import type { UserStories } from "./StoriesRow";

interface Props {
  open: boolean;
  startUserIndex: number;
  userStories: UserStories[];
  onClose: () => void;
  onDeleted?: () => void;
}

const STORY_DURATION_MS = 5000;
const SEEN_KEY = "wardrobe.seenStories";

const markSeen = (userId: string, lastCreatedAt: string) => {
  try {
    const seen = JSON.parse(localStorage.getItem(SEEN_KEY) || "{}");
    seen[userId] = lastCreatedAt;
    localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
  } catch {
    // ignore
  }
};

const StoryViewer = ({ open, startUserIndex, userStories, onClose, onDeleted }: Props) => {
  const { user } = useAuth();
  const [userIdx, setUserIdx] = useState(startUserIndex);
  const [storyIdx, setStoryIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const elapsedRef = useRef<number>(0);

  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [likeBusy, setLikeBusy] = useState(false);

  const currentUser = userStories[userIdx];
  const currentStory = currentUser?.stories[storyIdx];
  const isVideo = currentStory?.media_type === "video";
  const isOwnCurrent = user?.id === currentUser?.user_id;

  // Load like state + count for the current story
  useEffect(() => {
    if (!open || !currentStory) return;
    let cancelled = false;
    (async () => {
      const countPromise = supabase
        .from("story_likes")
        .select("id", { count: "exact", head: true })
        .eq("story_id", currentStory.id);
      const minePromise = user
        ? supabase
            .from("story_likes")
            .select("id")
            .eq("story_id", currentStory.id)
            .eq("user_id", user.id)
            .maybeSingle()
        : Promise.resolve({ data: null } as any);
      const [{ count }, mine] = await Promise.all([countPromise, minePromise]);
      if (cancelled) return;
      setLikeCount(count || 0);
      setLiked(!!(mine as any)?.data);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, currentStory, user]);

  const toggleLike = async () => {
    if (!user) {
      toast.error("Sign in to like stories");
      return;
    }
    if (!currentStory || isOwnCurrent || likeBusy) return;
    setLikeBusy(true);
    const wasLiked = liked;
    setLiked(!wasLiked);
    setLikeCount((c) => Math.max(0, c + (wasLiked ? -1 : 1)));
    if (wasLiked) {
      const { error } = await supabase
        .from("story_likes")
        .delete()
        .eq("story_id", currentStory.id)
        .eq("user_id", user.id);
      if (error) {
        setLiked(true);
        setLikeCount((c) => c + 1);
        toast.error("Couldn't unlike");
      }
    } else {
      const { error } = await supabase
        .from("story_likes")
        .insert({ story_id: currentStory.id, user_id: user.id });
      if (error) {
        setLiked(false);
        setLikeCount((c) => Math.max(0, c - 1));
        toast.error("Couldn't like");
      }
    }
    setLikeBusy(false);
  };

  useEffect(() => {
    if (open) {
      setUserIdx(startUserIndex);
      setStoryIdx(0);
      elapsedRef.current = 0;
      setProgress(0);
    }
  }, [open, startUserIndex]);

  // Mark seen whenever we land on a story
  useEffect(() => {
    if (!open || !currentUser || !currentStory) return;
    markSeen(currentUser.user_id, currentStory.created_at);
  }, [open, currentUser, currentStory]);

  // Auto-advance for images (videos are driven by their own timeupdate)
  useEffect(() => {
    if (!open || !currentStory || isVideo) return;
    cancelAnimationFrame(rafRef.current || 0);
    elapsedRef.current = 0;
    setProgress(0);
    startTimeRef.current = performance.now();

    const tick = (t: number) => {
      if (paused) {
        startTimeRef.current = t - elapsedRef.current;
      } else {
        elapsedRef.current = t - startTimeRef.current;
      }
      const p = Math.min(1, elapsedRef.current / STORY_DURATION_MS);
      setProgress(p);
      if (p >= 1) {
        next();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, userIdx, storyIdx, paused, isVideo]);

  const next = () => {
    if (!currentUser) return onClose();
    if (storyIdx < currentUser.stories.length - 1) {
      setStoryIdx(storyIdx + 1);
    } else if (userIdx < userStories.length - 1) {
      setUserIdx(userIdx + 1);
      setStoryIdx(0);
    } else {
      onClose();
    }
  };

  const prev = () => {
    if (storyIdx > 0) {
      setStoryIdx(storyIdx - 1);
    } else if (userIdx > 0) {
      const prevUser = userStories[userIdx - 1];
      setUserIdx(userIdx - 1);
      setStoryIdx(Math.max(0, prevUser.stories.length - 1));
    }
  };

  const handleDelete = async () => {
    if (!currentStory || !user || currentUser?.user_id !== user.id) return;
    if (!confirm("Delete this story?")) return;
    const { error } = await supabase.from("stories").delete().eq("id", currentStory.id);
    if (error) {
      toast.error("Couldn't delete");
    } else {
      toast.success("Story deleted");
      onDeleted?.();
      onClose();
    }
  };

  if (!open || !currentUser || !currentStory) return null;

  const isOwn = isOwnCurrent;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[120] bg-black flex items-center justify-center select-none"
      >
        {/* Progress bars */}
        <div className="absolute top-3 left-3 right-3 flex gap-1 z-20">
          {currentUser.stories.map((_, i) => (
            <div key={i} className="flex-1 h-0.5 bg-white/25 rounded-full overflow-hidden">
              <div
                className="h-full bg-white transition-[width] duration-75"
                style={{
                  width: i < storyIdx ? "100%" : i === storyIdx ? `${progress * 100}%` : "0%",
                }}
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="absolute top-7 left-3 right-3 flex items-center justify-between z-20 pt-3">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-full overflow-hidden bg-white/10 flex-shrink-0">
              {currentUser.profile?.avatar_url ? (
                <img src={currentUser.profile.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[11px] text-white/70 font-medium">
                  {(currentUser.profile?.display_name?.[0] || "?").toUpperCase()}
                </div>
              )}
            </div>
            <div>
              <p className="text-[12px] font-semibold text-white">
                {currentUser.profile?.display_name || "User"}
              </p>
              <p className="text-[9px] text-white/60">{relativeTime(currentStory.created_at)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isOwn && (
              <button onClick={handleDelete} className="text-white/70 hover:text-white p-1">
                <Trash2 className="h-4 w-4" />
              </button>
            )}
            <button onClick={onClose} className="text-white p-1">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Media */}
        <div className="relative w-full h-full max-w-md max-h-[100dvh] flex items-center justify-center">
          {isVideo ? (
            <video
              key={currentStory.id}
              src={currentStory.media_url}
              autoPlay
              playsInline
              muted={false}
              className="w-full h-full object-contain"
              onEnded={next}
              onTimeUpdate={(e) => {
                const v = e.currentTarget;
                if (v.duration) setProgress(Math.min(1, v.currentTime / v.duration));
              }}
            />
          ) : (
            <img
              key={currentStory.id}
              src={currentStory.media_url}
              alt=""
              className="w-full h-full object-contain"
              draggable={false}
            />
          )}
          {currentStory.caption && (
            <div className="absolute bottom-12 inset-x-4 text-center">
              <p className="inline-block bg-black/40 text-white text-[13px] px-4 py-2 rounded-full backdrop-blur-sm">
                {currentStory.caption}
              </p>
            </div>
          )}
        </div>

        {/* Like button — only for stories from others */}
        {!isOwn && (
          <div className="absolute bottom-5 right-4 z-30 flex flex-col items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleLike();
              }}
              disabled={likeBusy}
              aria-label={liked ? "Unlike story" : "Like story"}
              className="h-11 w-11 rounded-full bg-black/45 backdrop-blur-md border border-white/10 flex items-center justify-center active:scale-90 transition-transform disabled:opacity-60"
            >
              <Heart
                className={`h-5 w-5 transition-colors ${liked ? "fill-rose-500 text-rose-500" : "text-white"}`}
                strokeWidth={2}
              />
            </button>
            {likeCount > 0 && (
              <span className="text-[10px] font-semibold text-white/85 tabular-nums">
                {likeCount}
              </span>
            )}
          </div>
        )}
        <button
          onClick={prev}
          onPointerDown={() => setPaused(true)}
          onPointerUp={() => setPaused(false)}
          onPointerLeave={() => setPaused(false)}
          className="absolute left-0 top-0 bottom-0 w-1/3 z-10"
          aria-label="Previous"
        />
        <button
          onClick={next}
          onPointerDown={() => setPaused(true)}
          onPointerUp={() => setPaused(false)}
          onPointerLeave={() => setPaused(false)}
          className="absolute right-0 top-0 bottom-0 w-1/3 z-10"
          aria-label="Next"
        />
      </motion.div>
    </AnimatePresence>
  );
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default StoryViewer;
