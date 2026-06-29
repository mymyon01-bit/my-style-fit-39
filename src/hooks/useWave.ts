/**
 * useWave — Wave 🌊 reaction primitive for OOTD posts.
 *
 * Wave replaces the legacy heart "Like" on the OOTD feed surface. It writes to
 * `ootd_waves` and reads `ootd_posts.wave_count` (kept in sync by trigger).
 * Optimistic by default; rolls back on error.
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export interface UseWaveResult {
  count: number;
  waved: boolean;
  loading: boolean;
  toggle: () => Promise<void>;
}

export function useWave(postId: string, initialCount = 0): UseWaveResult {
  const { user } = useAuth();
  const [count, setCount] = useState(initialCount);
  const [waved, setWaved] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => { setCount(initialCount); }, [initialCount]);

  useEffect(() => {
    if (!user || !postId) { setWaved(false); return; }
    let cancelled = false;
    (async () => {
      const { data } = await (supabase as any)
        .from("ootd_waves")
        .select("id")
        .eq("post_id", postId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (!cancelled) setWaved(!!data);
    })();
    return () => { cancelled = true; };
  }, [postId, user]);

  const toggle = useCallback(async () => {
    if (!user || loading) return;
    setLoading(true);
    const prev = { waved, count };
    // optimistic
    setWaved(!waved);
    setCount((c) => Math.max(0, c + (waved ? -1 : 1)));
    try {
      if (prev.waved) {
        const { error } = await (supabase as any)
          .from("ootd_waves").delete()
          .eq("post_id", postId).eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from("ootd_waves").insert({ post_id: postId, user_id: user.id });
        if (error) throw error;
      }
    } catch (e) {
      // rollback
      setWaved(prev.waved);
      setCount(prev.count);
      console.error("[useWave] toggle failed", e);
    } finally {
      setLoading(false);
    }
  }, [user, loading, waved, count, postId]);

  return { count, waved, loading, toggle };
}
