/**
 * useCircleCounts — single source of truth for the Circle/Ripple counters.
 *
 *   Circle = people this user follows.
 *   Ripple = one-way followers this user has not followed back yet.
 *
 * Use this everywhere a profile shows these two stats. Returns null while
 * loading so the caller can show a skeleton without flashing 0.
 */
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CircleCounts {
  circle: number;   // following total
  ripple: number;   // followers - already-following
  followingTotal: number;
  followersTotal: number;
}

const PAGE_SIZE = 1000;

const fetchCircleIds = async (selectColumn: "following_id" | "follower_id", filterColumn: "follower_id" | "following_id", userId: string) => {
  const ids: string[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("circles")
      .select(selectColumn)
      .eq(filterColumn, userId)
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;
    const batch = data || [];
    ids.push(...batch.map((row: any) => row[selectColumn]).filter(Boolean));
    if (batch.length < PAGE_SIZE) break;
  }
  return ids;
};

export const useCircleCounts = (userId: string | null | undefined) => {
  const [counts, setCounts] = useState<CircleCounts | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!userId) { setCounts(null); return; }
    setLoading(true);
    try {
      const [followingIds, followerIds] = await Promise.all([
        fetchCircleIds("following_id", "follower_id", userId),
        fetchCircleIds("follower_id", "following_id", userId),
      ]);
      const followingSet = new Set(followingIds);
      const ripple = followerIds.filter(id => !followingSet.has(id)).length;
      setCounts({
        circle: followingSet.size,
        ripple: Math.max(0, ripple),
        followingTotal: followingSet.size,
        followersTotal: followerIds.length,
      });
    } catch (error) {
      console.error("[useCircleCounts] failed to refresh", error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    const handleChanged = () => refresh();
    window.addEventListener("circles:changed", handleChanged);
    return () => window.removeEventListener("circles:changed", handleChanged);
  }, [refresh]);

  return { counts, loading, refresh };
};
