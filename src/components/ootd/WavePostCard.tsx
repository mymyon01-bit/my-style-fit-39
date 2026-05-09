import { useState } from "react";
import { Heart, ThumbsDown, Frown, MessageCircle, Trash2, MoreHorizontal } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { setWaveReaction, deleteWavePost, type WavePost } from "@/hooks/useWaveModules";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import WaveCommentThread from "./WaveCommentThread";
import WavePollView from "./WavePollView";
import ImageLightbox from "./ImageLightbox";

interface Props {
  post: WavePost;
  isAdmin: boolean;
  onChanged: () => void;
}

const REACTIONS: { key: "like" | "dislike" | "meh"; Icon: any; label: string; color: string }[] = [
  { key: "like", Icon: Heart, label: "Like", color: "text-rose-400" },
  { key: "meh", Icon: Frown, label: "Meh", color: "text-amber-400" },
  { key: "dislike", Icon: ThumbsDown, label: "Dislike", color: "text-foreground/60" },
];

export default function WavePostCard({ post, isAdmin, onChanged }: Props) {
  const { user } = useAuth();
  const [openComments, setOpenComments] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  const isOwner = user?.id === post.author_id;
  const canDelete = isOwner || isAdmin;

  const handleReact = async (key: "like" | "dislike" | "meh") => {
    if (!user) { toast.error("Sign in"); return; }
    setPending(true);
    try {
      await setWaveReaction(post.id, post.my_reaction === key ? null : key);
      onChanged();
    } catch (e: any) { toast.error(e.message); }
    finally { setPending(false); }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this post?")) return;
    try { await deleteWavePost(post.id); onChanged(); }
    catch (e: any) { toast.error(e.message); }
  };

  const counts: Record<string, number> = {
    like: post.like_count, meh: post.meh_count, dislike: post.dislike_count,
  };

  return (
    <article className="rounded-2xl bg-foreground/[0.04] p-3 sm:p-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2.5">
        {post.is_anonymous ? (
          <div className="h-7 w-7 rounded-full bg-foreground/10 flex items-center justify-center text-[10px] font-bold text-foreground/50">?</div>
        ) : post.author?.avatar_url ? (
          <img src={post.author.avatar_url} alt="" className="h-7 w-7 rounded-full object-cover" />
        ) : (
          <div className="h-7 w-7 rounded-full bg-foreground/10 flex items-center justify-center text-[10px] font-bold text-foreground/60">
            {(post.author?.display_name?.[0] || post.author?.username?.[0] || "?").toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-semibold text-foreground truncate">
            {post.is_anonymous ? "Anonymous" : (post.author?.display_name || post.author?.username || "User")}
          </p>
          <p className="text-[9.5px] text-foreground/45">
            {new Date(post.created_at).toLocaleDateString()}
          </p>
        </div>
        {canDelete && (
          <div className="relative">
            <button onClick={() => setMenuOpen(v => !v)} className="rounded-full p-1.5 text-foreground/50 hover:bg-foreground/10">
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-7 z-10 rounded-lg bg-card border border-border shadow-lg py-1 min-w-[120px]">
                <button onClick={() => { setMenuOpen(false); handleDelete(); }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-[11px] text-destructive hover:bg-destructive/10">
                  <Trash2 className="h-3 w-3" /> Delete
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Body */}
      {post.title && <h4 className="text-[13px] font-semibold text-foreground mb-1">{post.title}</h4>}
      {post.body && <p className="text-[12px] leading-relaxed text-foreground/80 whitespace-pre-wrap">{post.body}</p>}

      {post.image_urls && post.image_urls.length > 0 && (
        <div className={`mt-2 grid gap-1.5 ${post.image_urls.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
          {post.image_urls.slice(0, 4).map((u, i) => (
            <img key={i} src={u} alt="" className="w-full max-h-80 rounded-xl object-cover" loading="lazy" />
          ))}
        </div>
      )}

      {post.kind === "poll" && <WavePollView post={post} onChanged={onChanged} />}

      {post.kind === "wardrobe_item" && post.metadata?.product_name && (
        <a href={post.metadata.product_url || "#"} target="_blank" rel="noreferrer"
           className="mt-2 flex items-center gap-2 rounded-xl bg-foreground/[0.05] p-2 hover:bg-foreground/[0.08] transition">
          {post.metadata.product_image && (
            <img src={post.metadata.product_image} alt="" className="h-12 w-12 rounded-lg object-cover" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-semibold text-foreground truncate">{post.metadata.product_name}</p>
            {post.metadata.product_brand && (
              <p className="text-[10px] text-foreground/55">{post.metadata.product_brand}</p>
            )}
          </div>
        </a>
      )}

      {/* Reactions */}
      <div className="mt-3 flex items-center gap-1">
        {REACTIONS.map(r => {
          const active = post.my_reaction === r.key;
          const Icon = r.Icon;
          return (
            <button key={r.key} disabled={pending} onClick={() => handleReact(r.key)}
              className={`inline-flex h-7 items-center gap-1 rounded-full px-2 ring-1 transition ${
                active
                  ? `bg-foreground/[0.08] ${r.color} ring-current/30`
                  : "bg-transparent text-foreground/55 ring-border/40 hover:bg-foreground/[0.06]"
              }`}>
              <Icon className={`h-3 w-3 ${active && r.key === "like" ? "fill-current" : ""}`} />
              <span className="text-[10px] font-semibold tabular-nums">{counts[r.key]}</span>
            </button>
          );
        })}
        <button onClick={() => setOpenComments(v => !v)}
          className="ml-auto inline-flex h-7 items-center gap-1 rounded-full bg-transparent px-2 ring-1 ring-border/40 text-foreground/55 hover:bg-foreground/[0.06]">
          <MessageCircle className="h-3 w-3" />
          <span className="text-[10px] font-semibold tabular-nums">{post.comment_count}</span>
        </button>
      </div>

      <AnimatePresence>
        {openComments && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
            <WaveCommentThread postId={post.id} isAdmin={isAdmin} onChanged={onChanged} />
          </motion.div>
        )}
      </AnimatePresence>
    </article>
  );
}
