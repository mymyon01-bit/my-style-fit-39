/**
 * useCircleCounts — single source of truth for the Circle/Ripple counters.
 *
 *   Circle = mutual follows (you follow them AND they follow you)
 *   Ripple = one-way followers (they follow you, you do not follow back)
 *
 * Use this everywhere a profile shows these two stats. Returns null while
 * loading so the caller can show a skeleton without flashing 0.
 */
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CircleCounts {
  circle: number;   // mutual
  ripple: number;   // followers - mutual
  followingTotal: number;
  followersTotal: number;
}

export const useCircleCounts = (userId: string | null | undefined) => {
  const [counts, setCounts] = useState<CircleCounts | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!userId) { setCounts(null); return; }
    setLoading(true);
    try {
      const [followingRes, followersRes] = await Promise.all([
        supabase.from("circles").select("following_id").eq("follower_id", userId),
        supabase.from("circles").select("follower_id").eq("following_id", userId),
      ]);
      const followingIds = new Set((followingRes.data || []).map((r: any) => r.following_id));
      const followerIds  = (followersRes.data || []).map((r: any) => r.follower_id);
      const mutual = followerIds.filter(id => followingIds.has(id)).length;
      setCounts({
        circle: mutual,
        ripple: Math.max(0, followerIds.length - mutual),
        followingTotal: followingIds.size,
        followersTotal: followerIds.length,
      });
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { refresh(); }, [refresh]);

  return { counts, loading, refresh };
};
