import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Showroom, ShowroomItem } from "@/lib/showroom/types";

const cast = (row: any): Showroom => ({
  ...row,
  hashtags: row.hashtags ?? [],
  playlist_links: Array.isArray(row.playlist_links) ? row.playlist_links : [],
});

export function useUserShowrooms(userId: string | null | undefined) {
  const [rooms, setRooms] = useState<Showroom[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!userId) { setRooms([]); setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from("showrooms")
      .select("*")
      .eq("user_id", userId)
      .order("is_pinned", { ascending: false })
      .order("updated_at", { ascending: false });
    setRooms((data ?? []).map(cast));
    setLoading(false);
  }, [userId]);

  useEffect(() => { reload(); }, [reload]);
  return { rooms, loading, reload };
}

export function usePublicShowrooms(limit = 24) {
  const [rooms, setRooms] = useState<Showroom[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from("showrooms")
        .select("*")
        .eq("visibility", "public")
        .order("updated_at", { ascending: false })
        .limit(limit);
      if (alive) { setRooms((data ?? []).map(cast)); setLoading(false); }
    })();
    return () => { alive = false; };
  }, [limit]);

  return { rooms, loading };
}

/**
 * Hot Showroom ranking — server-side weighted score.
 * star*0.45 + like*0.20 + save*0.15 + view*0.10 + recency*0.10
 */
export function useHotShowrooms(limit = 12) {
  const [rooms, setRooms] = useState<Array<Showroom & { hot_score: number }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from("showrooms")
        .select("*")
        .eq("visibility", "public")
        .order("star_count", { ascending: false })
        .order("updated_at", { ascending: false })
        .limit(limit * 3);
      if (!alive) return;
      const now = Date.now();
      const scored = (data ?? []).map(cast).map((r) => {
        const ageDays = (now - new Date(r.updated_at).getTime()) / (1000 * 60 * 60 * 24);
        const recency = Math.max(0, 1 - ageDays / 30);
        const score =
          r.star_count * 0.45 +
          r.like_count * 0.2 +
          r.save_count * 0.15 +
          (r.view_count / 10) * 0.1 +
          recency * 10 * 0.1;
        return { ...r, hot_score: score };
      });
      scored.sort((a, b) => b.hot_score - a.hot_score);
      setRooms(scored.slice(0, limit));
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [limit]);

  return { rooms, loading };
}

export function useShowroom(id: string | undefined) {
  const [room, setRoom] = useState<Showroom | null>(null);
  const [items, setItems] = useState<ShowroomItem[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const [roomRes, itemsRes] = await Promise.all([
      supabase.from("showrooms").select("*").eq("id", id).maybeSingle(),
      supabase.from("showroom_items").select("*").eq("showroom_id", id).order("position_order"),
    ]);
    setRoom(roomRes.data ? cast(roomRes.data) : null);
    setItems((itemsRes.data ?? []) as ShowroomItem[]);
    setLoading(false);
    // bump view count (best effort, ignore failures)
    if (roomRes.data) {
      void supabase.from("showrooms").update({ view_count: (roomRes.data as any).view_count + 1 }).eq("id", id);
    }
  }, [id]);

  useEffect(() => { reload(); }, [reload]);

  return { room, items, loading, reload };
}
