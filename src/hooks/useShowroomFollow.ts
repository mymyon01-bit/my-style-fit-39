import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useShowroomFollow(showroomId: string | undefined, userId: string | null | undefined) {
  const [isFollowing, setIsFollowing] = useState(false);
  const [count, setCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!showroomId) return;
    setLoading(true);
    const [countRes, mineRes] = await Promise.all([
      supabase.from("showroom_followers").select("id", { count: "exact", head: true }).eq("showroom_id", showroomId),
      userId
        ? supabase.from("showroom_followers").select("id").eq("showroom_id", showroomId).eq("user_id", userId).maybeSingle()
        : Promise.resolve({ data: null } as any),
    ]);
    setCount(countRes.count ?? 0);
    setIsFollowing(!!mineRes?.data);
    setLoading(false);
  }, [showroomId, userId]);

  useEffect(() => { reload(); }, [reload]);

  const toggle = useCallback(async () => {
    if (!showroomId || !userId) return;
    if (isFollowing) {
      await supabase.from("showroom_followers").delete().eq("showroom_id", showroomId).eq("user_id", userId);
      setIsFollowing(false);
      setCount((c) => Math.max(0, c - 1));
    } else {
      const { error } = await supabase.from("showroom_followers").insert({ showroom_id: showroomId, user_id: userId });
      if (!error) {
        setIsFollowing(true);
        setCount((c) => c + 1);
      }
    }
  }, [showroomId, userId, isFollowing]);

  return { isFollowing, count, loading, toggle, reload };
}
