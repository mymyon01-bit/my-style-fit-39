/**
 * PostDetailHost — self-contained host for OOTDPostDetail.
 *
 * Fetches the post row, profile, viewer reaction/star/save state and exposes
 * the handlers OOTDPostDetail expects. Used by the new editorial OOTD shell
 * so opening a post (via card click or ?post= deep link) works end-to-end
 * without depending on the legacy OOTDPage state.
 */
import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import OOTDPostDetail from "@/components/OOTDPostDetail";

interface OOTDPost {
  id: string;
  user_id: string;
  image_url: string;
  caption: string | null;
  style_tags: string[] | null;
  topics: string[] | null;
  star_count: number | null;
  like_count: number | null;
  dislike_count: number | null;
  created_at: string;
}

interface ProfileInfo {
  display_name: string | null;
  username?: string | null;
  avatar_url: string | null;
  is_official?: boolean | null;
}

interface Props {
  postId: string;
  onClose: () => void;
}

export default function PostDetailHost({ postId, onClose }: Props) {
  const { user } = useAuth();
  const [post, setPost] = useState<OOTDPost | null>(null);
  const [profile, setProfile] = useState<ProfileInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [reaction, setReaction] = useState<"like" | "dislike" | undefined>();
  const [isStarred, setIsStarred] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [starsLeft, setStarsLeft] = useState(3);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from("ootd_posts")
        .select("id, user_id, image_url, caption, style_tags, topics, star_count, like_count, dislike_count, created_at")
        .eq("id", postId)
        .maybeSingle();
      if (cancelled || !data) { setLoading(false); return; }
      setPost(data as OOTDPost);

      const { data: prof } = await supabase
        .from("profiles")
        .select("display_name, username, avatar_url, is_official")
        .eq("user_id", (data as any).user_id)
        .maybeSingle();
      if (!cancelled) setProfile((prof as ProfileInfo) ?? null);

      if (user) {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const [r, s, sv, todayStars] = await Promise.all([
          supabase.from("ootd_reactions").select("reaction").eq("post_id", postId).eq("user_id", user.id).maybeSingle(),
          supabase.from("ootd_stars").select("id").eq("post_id", postId).eq("user_id", user.id).maybeSingle(),
          supabase.from("saved_posts").select("id").eq("post_id", postId).eq("user_id", user.id).maybeSingle(),
          supabase.from("ootd_stars").select("id").eq("user_id", user.id).gte("created_at", today.toISOString()),
        ]);
        if (cancelled) return;
        setReaction((r.data as any)?.reaction);
        setIsStarred(!!s.data);
        setIsSaved(!!sv.data);
        setStarsLeft(Math.max(0, 3 - (todayStars.data?.length ?? 0)));
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [postId, user]);

  const handleReaction = useCallback(async (id: string, type: "like" | "dislike") => {
    if (!user || !post) return;
    const current = reaction;
    if (current === type) {
      await supabase.from("ootd_reactions").delete().eq("post_id", id).eq("user_id", user.id);
      setReaction(undefined);
      setPost((p) => p && ({
        ...p,
        like_count: type === "like" ? Math.max(0, (p.like_count || 0) - 1) : p.like_count,
        dislike_count: type === "dislike" ? Math.max(0, (p.dislike_count || 0) - 1) : p.dislike_count,
      }));
    } else if (current) {
      await supabase.from("ootd_reactions").update({ reaction: type }).eq("post_id", id).eq("user_id", user.id);
      setReaction(type);
      setPost((p) => p && ({
        ...p,
        like_count: type === "like" ? (p.like_count || 0) + 1 : Math.max(0, (p.like_count || 0) - 1),
        dislike_count: type === "dislike" ? (p.dislike_count || 0) + 1 : Math.max(0, (p.dislike_count || 0) - 1),
      }));
    } else {
      await supabase.from("ootd_reactions").insert({ post_id: id, user_id: user.id, reaction: type });
      setReaction(type);
      setPost((p) => p && ({
        ...p,
        like_count: type === "like" ? (p.like_count || 0) + 1 : p.like_count,
        dislike_count: type === "dislike" ? (p.dislike_count || 0) + 1 : p.dislike_count,
      }));
    }
  }, [user, post, reaction]);

  const handleStar = useCallback(async (id: string) => {
    if (!user || isStarred || starsLeft <= 0) return;
    const { error } = await supabase.from("ootd_stars").insert({ user_id: user.id, post_id: id });
    if (!error) {
      setIsStarred(true);
      setStarsLeft((n) => Math.max(0, n - 1));
      setPost((p) => p && { ...p, star_count: (p.star_count || 0) + 1 });
    }
  }, [user, isStarred, starsLeft]);

  const handleSave = useCallback(async (id: string) => {
    if (!user) return;
    if (isSaved) {
      await supabase.from("saved_posts").delete().eq("post_id", id).eq("user_id", user.id);
      setIsSaved(false);
    } else {
      await supabase.from("saved_posts").insert({ user_id: user.id, post_id: id });
      setIsSaved(true);
    }
  }, [user, isSaved]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md">
        <Loader2 className="h-6 w-6 animate-spin text-accent/70" />
      </div>
    );
  }
  if (!post) return null;

  return (
    <OOTDPostDetail
      post={post}
      profile={profile}
      reaction={reaction}
      isStarred={isStarred}
      isSaved={isSaved}
      starsLeft={starsLeft}
      onClose={onClose}
      onReaction={handleReaction}
      onStar={handleStar}
      onSave={handleSave}
      onTopicClick={() => {}}
    />
  );
}
