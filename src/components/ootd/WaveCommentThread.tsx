import { useState } from "react";
import { Heart, Loader2, Trash2 } from "lucide-react";
import {
  useWaveComments, addWaveComment, deleteWaveComment, toggleWaveCommentLike,
} from "@/hooks/useWaveModules";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

interface Props {
  postId: string;
  isAdmin: boolean;
  onChanged: () => void;
}

export default function WaveCommentThread({ postId, isAdmin, onChanged }: Props) {
  const { user } = useAuth();
  const { comments, loading, refresh } = useWaveComments(postId);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!text.trim() || !user) return;
    setSubmitting(true);
    try {
      await addWaveComment(postId, text, replyTo);
      setText(""); setReplyTo(null);
      await refresh(); onChanged();
    } catch (e: any) { toast.error(e.message); }
    finally { setSubmitting(false); }
  };

  const top = comments.filter(c => !c.parent_id);
  const repliesOf = (id: string) => comments.filter(c => c.parent_id === id);

  return (
    <div className="mt-3 space-y-2 border-t border-border/30 pt-3">
      {loading ? (
        <div className="py-3 text-center"><Loader2 className="mx-auto h-3.5 w-3.5 animate-spin text-foreground/40" /></div>
      ) : top.length === 0 ? (
        <p className="py-2 text-center text-[11px] text-foreground/40">No comments yet</p>
      ) : (
        <ul className="space-y-2.5">
          {top.map(c => (
            <CommentItem key={c.id} c={c} isAdmin={isAdmin} onReply={() => setReplyTo(c.id)}
              onChanged={() => { refresh(); onChanged(); }} />
          )).map((node, i) => {
            const c = top[i];
            const reps = repliesOf(c.id);
            return (
              <li key={c.id}>
                {node}
                {reps.length > 0 && (
                  <ul className="mt-2 ml-7 space-y-2 border-l border-border/30 pl-3">
                    {reps.map(r => (
                      <li key={r.id}>
                        <CommentItem c={r} isAdmin={isAdmin} onChanged={() => { refresh(); onChanged(); }} />
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Input */}
      {user && (
        <div className="mt-2 flex gap-2">
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder={replyTo ? "Reply…" : "Add a comment…"}
            className="flex-1 rounded-full bg-foreground/[0.06] px-3 py-1.5 text-[11.5px] text-foreground placeholder:text-foreground/40 outline-none focus:bg-foreground/[0.1]"
            onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
          />
          {replyTo && (
            <button onClick={() => setReplyTo(null)}
              className="rounded-full bg-foreground/[0.06] px-2 text-[10px] text-foreground/55">×</button>
          )}
          <button onClick={handleSubmit} disabled={submitting || !text.trim()}
            className="rounded-full bg-[hsl(330_85%_60%)] px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-40">
            {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : "Send"}
          </button>
        </div>
      )}
    </div>
  );
}

function CommentItem({ c, isAdmin, onReply, onChanged }: {
  c: any; isAdmin: boolean; onReply?: () => void; onChanged: () => void;
}) {
  const { user } = useAuth();
  const canDelete = user?.id === c.user_id || isAdmin;

  const handleLike = async () => {
    try { await toggleWaveCommentLike(c.id, !!c.liked_by_me); onChanged(); }
    catch (e: any) { toast.error(e.message); }
  };
  const handleDelete = async () => {
    if (!confirm("Delete comment?")) return;
    try { await deleteWaveComment(c.id); onChanged(); }
    catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="flex gap-2">
      {c.author?.avatar_url ? (
        <img src={c.author.avatar_url} alt="" className="h-6 w-6 rounded-full object-cover" />
      ) : (
        <div className="h-6 w-6 rounded-full bg-foreground/10 flex items-center justify-center text-[9px] font-bold text-foreground/60">
          {(c.author?.display_name?.[0] || c.author?.username?.[0] || "?").toUpperCase()}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-[11px]">
          <span className="font-semibold text-foreground/85">{c.author?.display_name || c.author?.username || "User"}</span>
          <span className="ml-2 text-foreground/80">{c.body}</span>
        </p>
        <div className="mt-0.5 flex items-center gap-2 text-[9.5px] text-foreground/45">
          <button onClick={handleLike} className={`inline-flex items-center gap-0.5 ${c.liked_by_me ? "text-rose-400" : "hover:text-foreground/70"}`}>
            <Heart className={`h-2.5 w-2.5 ${c.liked_by_me ? "fill-current" : ""}`} /> {c.like_count}
          </button>
          {onReply && <button onClick={onReply} className="hover:text-foreground/70">Reply</button>}
          {canDelete && (
            <button onClick={handleDelete} className="hover:text-destructive"><Trash2 className="h-2.5 w-2.5" /></button>
          )}
        </div>
      </div>
    </div>
  );
}
