/**
 * MyActivityList — "Activity" archive for My Page.
 *
 * Lists every reaction your OOTD posts received (likes / stars / comments /
 * mentions) newest first, with the reacting user and a thumbnail of the post
 * so you can jump straight back to it.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Heart, MessageCircle, AtSign, Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

interface Item {
  id: string;
  actor_id: string | null;
  type: string;
  target_id: string | null;
  created_at: string;
}

type Actor = { display_name: string | null; username: string | null; avatar_url: string | null };

const TYPES = [
  "ootd_like", "ootd_star", "ootd_comment", "ootd_reply", "ootd_mention",
  "ootd_reaction", "comment_like", "star", "comment", "reaction",
];

function icon(type: string) {
  if (type.includes("comment") || type.includes("reply")) return <MessageCircle className="h-3.5 w-3.5" strokeWidth={1.8} />;
  if (type.includes("mention")) return <AtSign className="h-3.5 w-3.5" strokeWidth={1.8} />;
  return <Heart className="h-3.5 w-3.5 fill-accent text-accent" strokeWidth={0} />;
}

function verb(type: string) {
  if (type.includes("comment") || type.includes("reply")) return "댓글을 남겼어요";
  if (type.includes("mention")) return "회원님을 태그했어요";
  return "좋아요를 눌렀어요";
}

function timeAgo(iso: string) {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return `${Math.max(1, Math.floor(diff / 60_000))}분 전`;
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

export default function MyActivityList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Item[]>([]);
  const [actors, setActors] = useState<Record<string, Actor>>({});
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("notifications")
        .select("id, actor_id, type, target_id, created_at")
        .eq("recipient_id", user.id)
        .in("type", TYPES)
        .order("created_at", { ascending: false })
        .limit(60);
      if (cancelled) return;
      const rows = (data ?? []) as Item[];
      setItems(rows);
      setLoading(false);

      const actorIds = [...new Set(rows.map((r) => r.actor_id).filter(Boolean) as string[])];
      const postIds = [...new Set(rows.map((r) => r.target_id).filter(Boolean) as string[])];
      const [profs, posts] = await Promise.all([
        actorIds.length
          ? supabase.from("profiles").select("user_id, display_name, username, avatar_url").in("user_id", actorIds)
          : Promise.resolve({ data: [] as any[] }),
        postIds.length
          ? supabase.from("ootd_posts").select("id, image_url").in("id", postIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);
      if (cancelled) return;
      const amap: Record<string, Actor> = {};
      ((profs.data as any[]) ?? []).forEach((p) => { amap[p.user_id] = p; });
      const tmap: Record<string, string> = {};
      ((posts.data as any[]) ?? []).forEach((p) => { if (p.image_url) tmap[p.id] = p.image_url; });
      setActors(amap);
      setThumbs(tmap);
    })();
    return () => { cancelled = true; };
  }, [user]);

  if (loading) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-accent/65" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex min-h-[30vh] flex-col items-center justify-center gap-3 text-foreground/55">
        <Sparkles className="h-6 w-6" strokeWidth={1.4} />
        <p className="text-sm">아직 받은 반응이 없어요.</p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border/50">
      {items.map((it) => {
        const a = actors[it.actor_id ?? ""];
        const name = a?.display_name ?? a?.username ?? "누군가";
        const thumb = it.target_id ? thumbs[it.target_id] : undefined;
        return (
          <li key={it.id}>
            <button
              type="button"
              onClick={() => it.target_id && navigate(`/ootd?section=feed&post=${it.target_id}`)}
              className="flex w-full items-center gap-3 py-3 text-left"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
                {a?.avatar_url
                  ? <img src={a.avatar_url} alt="" className="h-full w-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
                  : <span className="text-[11px] text-foreground/50">{name.slice(0, 1).toUpperCase()}</span>}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-[13px] text-foreground">
                  {icon(it.type)}
                  <span className="truncate"><b className="font-semibold">{name}</b>님이 {verb(it.type)}</span>
                </span>
                <span className="block text-[10.5px] text-foreground/45">{timeAgo(it.created_at)}</span>
              </span>
              {thumb && (
                <img src={thumb} alt="" loading="lazy" className="h-10 w-8 shrink-0 rounded-sm object-cover" />
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
