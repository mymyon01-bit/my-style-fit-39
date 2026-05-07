import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

/**
 * "People Like Me" — surfaces OOTD posts from users whose body proportions
 * or fit preferences resemble the current user. For guests / users without
 * a body profile, falls back to the most-curated recent posts.
 */
export interface PeerPost {
  id: string;
  user_id: string;
  image_url: string;
  caption: string | null;
  star_count: number | null;
  like_count: number | null;
  style_tags: string[] | null;
  reason: string;
}

export function usePeopleLikeMe(limit = 12) {
  const { user } = useAuth();
  const [posts, setPosts] = useState<PeerPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);

      // Fallback: top curated recent posts
      const fallback = async (reason: string): Promise<PeerPost[]> => {
        const { data } = await supabase
          .from("ootd_posts")
          .select("id, user_id, image_url, caption, star_count, like_count, style_tags")
          .order("star_count", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(limit);
        return (data || []).map((p: any) => ({ ...p, reason }));
      };

      if (!user) {
        const r = await fallback("Curated showrooms to explore");
        if (!cancelled) { setPosts(r); setLoading(false); }
        return;
      }

      // Try body-similarity match
      const { data: me } = await supabase
        .from("body_profiles")
        .select("height_cm, shoulder_width_cm, silhouette_type")
        .eq("user_id", user.id)
        .maybeSingle();

      let peerIds: string[] = [];
      let reason = "Similar style preferences";

      if (me?.height_cm) {
        const { data: peers } = await supabase
          .from("body_profiles")
          .select("user_id")
          .gte("height_cm", Number(me.height_cm) - 5)
          .lte("height_cm", Number(me.height_cm) + 5)
          .neq("user_id", user.id)
          .limit(60);
        peerIds = (peers || []).map((p: any) => p.user_id);
        reason = "Similar body proportions to you";
      }

      if (peerIds.length === 0) {
        const r = await fallback("Curated showrooms to explore");
        if (!cancelled) { setPosts(r); setLoading(false); }
        return;
      }

      const { data } = await supabase
        .from("ootd_posts")
        .select("id, user_id, image_url, caption, star_count, like_count, style_tags")
        .in("user_id", peerIds)
        .order("star_count", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(limit);

      const result = (data || []).map((p: any) => ({ ...p, reason }));
      if (!cancelled) {
        if (result.length === 0) {
          const r = await fallback("Curated showrooms to explore");
          if (!cancelled) setPosts(r);
        } else {
          setPosts(result);
        }
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user, limit]);

  return { posts, loading };
}
