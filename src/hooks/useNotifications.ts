import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

/**
 * Combined unread counter for the bell badge and OOTD "NEW" indicator.
 * Sums:
 *  - notifications rows where read_at is NULL (follow / star / comment)
 *  - messages rows where recipient is me and read_at is NULL
 *
 * Realtime: subscribes to inserts on both tables for the current user.
 */
// Notification "type" values that originate from activity on a user's OOTD
// posts (likes / stars / comments / mentions / reactions). Used to drive the
// red dot on the OOTD tab in the bottom & desktop navs.
const OOTD_NOTIF_TYPES = [
  "ootd_like",
  "ootd_star",
  "ootd_comment",
  "ootd_reply",
  "ootd_mention",
  "ootd_reaction",
  "comment_like",
  "star",
  "comment",
  "reaction",
];

export function useNotifications() {
  const { user } = useAuth();
  const [notifUnread, setNotifUnread] = useState(0);
  const [msgUnread, setMsgUnread] = useState(0);
  const [ootdUnread, setOotdUnread] = useState(0);

  const refresh = useCallback(async () => {
    if (!user) {
      setNotifUnread(0);
      setMsgUnread(0);
      setOotdUnread(0);
      return;
    }
    const [n, m, o] = await Promise.all([
      supabase
        .from("notifications" as any)
        .select("id", { count: "exact", head: true })
        .eq("recipient_id", user.id)
        .is("read_at", null),
      supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("recipient_id", user.id)
        .is("read_at", null),
      supabase
        .from("notifications" as any)
        .select("id", { count: "exact", head: true })
        .eq("recipient_id", user.id)
        .is("read_at", null)
        .in("type", OOTD_NOTIF_TYPES),
    ]);
    setNotifUnread(n.count || 0);
    setMsgUnread(m.count || 0);
    setOotdUnread(o.count || 0);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel(`notif-${user.id}-${Math.random().toString(36).slice(2)}`);
    channel
      .on(
        "postgres_changes" as any,
        { event: "*", schema: "public", table: "notifications", filter: `recipient_id=eq.${user.id}` },
        () => refresh(),
      )
      .on(
        "postgres_changes" as any,
        { event: "*", schema: "public", table: "messages", filter: `recipient_id=eq.${user.id}` },
        () => refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, refresh]);

  return {
    notifUnread,
    msgUnread,
    ootdUnread,
    totalUnread: notifUnread + msgUnread,
    refresh,
  };
}

export interface NotificationRow {
  id: string;
  recipient_id: string;
  actor_id: string | null;
  type: string;
  target_id: string | null;
  metadata: Record<string, any>;
  read_at: string | null;
  created_at: string;
}

/**
 * Hook for the full notifications list (used inside the inbox sheet).
 */
export function useNotificationsList() {
  const { user } = useAuth();
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [actors, setActors] = useState<Record<string, { display_name: string | null; avatar_url: string | null; username: string | null }>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("notifications" as any)
      .select("*")
      .eq("recipient_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    const rows = ((data as unknown) as NotificationRow[]) || [];
    setItems(rows);

    const actorIds = [...new Set(rows.map((r) => r.actor_id).filter(Boolean) as string[])];
    if (actorIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url, username")
        .in("user_id", actorIds);
      const map: Record<string, any> = {};
      (profiles || []).forEach((p: any) => {
        map[p.user_id] = { display_name: p.display_name, avatar_url: p.avatar_url, username: p.username };
      });
      setActors(map);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const markAllRead = useCallback(async () => {
    if (!user) return;
    await supabase
      .from("notifications" as any)
      .update({ read_at: new Date().toISOString() })
      .eq("recipient_id", user.id)
      .is("read_at", null);
    load();
  }, [user, load]);

  return { items, actors, loading, reload: load, markAllRead };
}
