/**
 * FeedActivityBanner — live reaction strip pinned to the top of the OOTD feed.
 *
 * Shows the most recent reactions on your posts (likes / stars / comments /
 * mentions) plus new posts from people you follow — the `circle_post`
 * notification the database trigger creates for every follower. New rows
 * arrive over realtime, so a reaction appears without a refresh.
 */
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

interface Row {
  id: string;
  actor_id: string | null;
  type: string;
  target_id: string | null;
  created_at: string;
  read_at: string | null;
}

type Actor = { display_name: string | null; username: string | null; avatar_url: string | null };

const FEED_TYPES = [
  "ootd_like", "ootd_star", "ootd_comment", "ootd_reply", "ootd_mention",
  "ootd_reaction", "comment_like", "star", "comment", "reaction", "circle_post",
];

function label(type: string, name: string) {
  switch (type) {
    case "circle_post": return `${name}님이 새 OOTD를 올렸어요`;
    case "ootd_comment":
    case "comment":
    case "ootd_reply": return `${name}님이 댓글을 남겼어요`;
    case "ootd_mention": return `${name}님이 회원님을 태그했어요`;
    default: return `${name}님이 좋아요를 눌렀어요`;
  }
}

export default function FeedActivityBanner() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [actors, setActors] = useState<Record<string, Actor>>({});
  const [dismissed, setDismissed] = useState(false);

  const load = useCallback(async () => {
    if (!user) { setRows([]); return; }
    const { data } = await supabase
      .from("notifications")
      .select("id, actor_id, type, target_id, created_at, read_at")
      .eq("recipient_id", user.id)
      .in("type", FEED_TYPES)
      .order("created_at", { ascending: false })
      .limit(5);
    const list = (data ?? []) as Row[];
    setRows(list);
    const ids = [...new Set(list.map((r) => r.actor_id).filter(Boolean) as string[])];
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, display_name, username, avatar_url")
        .in("user_id", ids);
      const map: Record<string, Actor> = {};
      (profs ?? []).forEach((p: any) => { map[p.user_id] = p; });
      setActors(map);
    }
  }, [user]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`feed-activity-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `recipient_id=eq.${user.id}` },
        () => { setDismissed(false); void load(); },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, load]);

  if (!user || dismissed || rows.length === 0) return null;

  const latest = rows[0];
  const name = actors[latest.actor_id ?? ""]?.display_name
    ?? actors[latest.actor_id ?? ""]?.username
    ?? "누군가";
  const extra = rows.length - 1;

  return (
    <div className="mx-3 mt-2 flex items-center gap-2.5 rounded-md border-2 border-foreground/10 bg-card px-3 py-2 lg:mx-0">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
        <Bell className="h-3.5 w-3.5" strokeWidth={1.8} />
      </span>
      <button
        type="button"
        onClick={() => latest.target_id && navigate(`/ootd?section=feed&post=${latest.target_id}`)}
        className="min-w-0 flex-1 text-left"
      >
        <span className="block truncate text-[12.5px] font-medium text-foreground">
          {label(latest.type, name)}
        </span>
        {extra > 0 && (
          <span className="block text-[10.5px] text-foreground/50">외 {extra}건의 새 반응</span>
        )}
      </button>
      <button
        type="button"
        aria-label="닫기"
        onClick={() => setDismissed(true)}
        className="text-foreground/40 transition hover:text-foreground"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
