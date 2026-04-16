import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { X, Heart, HeartOff, MessageCircle, Star, Send, Bookmark, BookmarkCheck, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { AuthGate } from "@/components/AuthGate";
import { useNavigate } from "react-router-dom";

interface OOTDPost {
  id: string;
  user_id: string;
  image_url: string;
  caption: string | null;
  style_tags: string[] | null;
  topics: string[] | null;
  star_count: number | null;
  like_count: number | null;
  dislike_count: number | null;
  created_at: string;
}

interface ProfileInfo {
  display_name: string | null;
  avatar_url: string | null;
}

interface Comment {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
}

interface Props {
  post: OOTDPost;
  profile: ProfileInfo | null;
  reaction: "like" | "dislike" | undefined;
  isStarred: boolean;
  isSaved: boolean;
  starsLeft: number;
  onClose: () => void;
  onReaction: (postId: string, type: "like" | "dislike") => void;
  onStar: (postId: string) => void;
  onSave: (postId: string) => void;
  onTopicClick: (topic: string) => void;
}

export default function OOTDPostDetail({
  post, profile, reaction, isStarred, isSaved, starsLeft,
  onClose, onReaction, onStar, onSave, onTopicClick,
}: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [loadingComments, setLoadingComments] = useState(true);
  const [profileMap, setProfileMap] = useState<Record<string, ProfileInfo>>({});

  useEffect(() => {
    loadComments();
  }, [post.id]);

  const loadComments = async () => {
    setLoadingComments(true);
    const { data } = await supabase
      .from("ootd_comments")
      .select("*")
      .eq("post_id", post.id)
      .order("created_at", { ascending: true })
      .limit(50);

    const fetched = (data || []) as Comment[];
    const userIds = [...new Set(fetched.map(c => c.user_id))];
    if (userIds.length > 0) {
      const { data: profs } = await supabase.from("profiles").select("user_id, display_name, avatar_url").in("user_id", userIds);
      if (profs) {
        const map: Record<string, ProfileInfo> = {};
        for (const p of profs) map[(p as any).user_id] = p as ProfileInfo;
        setProfileMap(map);
      }
    }
    setComments(fetched);
    setLoadingComments(false);
  };

  const submitComment = async () => {
    if (!user || !commentText.trim()) return;
    const { data, error } = await supabase.from("ootd_comments").insert({
      post_id: post.id, user_id: user.id, content: commentText.trim(),
    }).select().single();
    if (!error && data) {
      setComments(prev => [...prev, data as Comment]);
      setCommentText("");
    }
  };

  const getCommentName = (userId: string) =>
    profileMap[userId]?.display_name || (userId === post.user_id ? (profile?.display_name || "Author") : "User");

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.floor(hrs / 24)}d`;
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-md max-h-[90vh] rounded-2xl bg-card border border-border overflow-hidden flex flex-col"
      >
        {/* Image */}
        <div className="relative flex-shrink-0">
          <img src={post.image_url} alt="" className="w-full object-cover" style={{ maxHeight: "50vh" }} />
          <button onClick={onClose} className="absolute top-3 right-3 rounded-full bg-black/40 p-1.5 text-white/70 hover:text-white backdrop-blur-sm">
            <X className="h-4 w-4" />
          </button>
          {(post.star_count || 0) > 0 && (
            <div className="absolute top-3 left-3 flex items-center gap-0.5 rounded-full bg-black/40 px-2 py-1 backdrop-blur-sm">
              <Star className="h-3 w-3 fill-[hsl(var(--star))] text-[hsl(var(--star))]" />
              <span className="text-[10px] font-medium text-white/80">{post.star_count}</span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Author */}
          <button
            onClick={() => { onClose(); navigate(`/user/${post.user_id}`); }}
            className="flex items-center gap-2 group"
          >
            <div className="h-8 w-8 rounded-full bg-foreground/[0.06] overflow-hidden flex-shrink-0">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full flex items-center justify-center text-[10px] font-bold text-foreground/30">
                  {(profile?.display_name || "?")[0].toUpperCase()}
                </div>
              )}
            </div>
            <div>
              <p className="text-[12px] font-semibold text-foreground/80 group-hover:text-foreground transition-colors">
                {profile?.display_name || "Anonymous"}
              </p>
              <p className="text-[9px] text-foreground/35">{timeAgo(post.created_at)} ago</p>
            </div>
          </button>

          {/* Message */}
          {post.caption && (
            <p className="text-[13px] text-foreground/70 leading-relaxed">"{post.caption}"</p>
          )}

          {/* Hashtags / Topics */}
          {post.topics && post.topics.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {post.topics.map(tp => (
                <button
                  key={tp}
                  onClick={() => { onClose(); onTopicClick(tp); }}
                  className="text-[10px] font-medium text-accent/60 hover:text-accent transition-colors"
                >
                  #{tp}
                </button>
              ))}
            </div>
          )}

          {/* Style tags */}
          {post.style_tags && post.style_tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {post.style_tags.map(tag => (
                <span key={tag} className="rounded-full bg-foreground/[0.04] px-2.5 py-1 text-[9px] text-foreground/45">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Interactions */}
          <div className="flex items-center gap-4 py-1 border-y border-border/15">
            <AuthGate action="react">
              <button onClick={() => onReaction(post.id, "like")} className={`flex items-center gap-1 transition-colors ${reaction === "like" ? "text-rose-400" : "text-foreground/40 hover:text-foreground/60"}`}>
                <Heart className={`h-4 w-4 ${reaction === "like" ? "fill-current" : ""}`} />
                <span className="text-[10px]">{post.like_count || 0}</span>
              </button>
            </AuthGate>

            <AuthGate action="react">
              <button onClick={() => onReaction(post.id, "dislike")} className={`flex items-center gap-1 transition-colors ${reaction === "dislike" ? "text-blue-400" : "text-foreground/40 hover:text-foreground/60"}`}>
                <HeartOff className={`h-4 w-4 ${reaction === "dislike" ? "fill-current" : ""}`} />
                <span className="text-[10px]">{post.dislike_count || 0}</span>
              </button>
            </AuthGate>

            <div className="flex items-center gap-1 text-foreground/40">
              <MessageCircle className="h-4 w-4" />
              <span className="text-[10px]">{comments.length}</span>
            </div>

            <AuthGate action="save">
              <button onClick={() => onSave(post.id)} className={`transition-colors ${isSaved ? "text-accent/70" : "text-foreground/40 hover:text-foreground/60"}`}>
                {isSaved ? <BookmarkCheck className="h-4 w-4 fill-current" /> : <Bookmark className="h-4 w-4" />}
              </button>
            </AuthGate>

            <AuthGate action="give stars">
              <button onClick={() => onStar(post.id)} disabled={starsLeft <= 0 && !isStarred} className={`flex items-center gap-1 ml-auto transition-colors ${isStarred ? "text-[hsl(var(--star))]" : "text-foreground/40 hover:text-foreground/60"}`}>
                <Star className={`h-4 w-4 ${isStarred ? "fill-current" : ""}`} />
              </button>
            </AuthGate>
          </div>

          {/* Comments */}
          <div className="space-y-2.5">
            <p className="text-[9px] font-semibold tracking-[0.15em] text-foreground/40 uppercase">Comments</p>
            {loadingComments ? (
              <Loader2 className="h-3 w-3 animate-spin text-foreground/25 mx-auto" />
            ) : comments.length === 0 ? (
              <p className="text-[10px] text-foreground/25 text-center py-3">No comments yet</p>
            ) : (
              comments.map(c => (
                <div key={c.id} className="flex gap-2">
                  <span className="text-[10px] font-semibold text-foreground/50 flex-shrink-0">{getCommentName(c.user_id)}</span>
                  <span className="text-[10px] text-foreground/40 flex-1">{c.content}</span>
                  <span className="text-[8px] text-foreground/20 flex-shrink-0">{timeAgo(c.created_at)}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Comment input */}
        {user && (
          <div className="flex gap-2 p-4 border-t border-border/15 flex-shrink-0">
            <input
              type="text"
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              onKeyDown={e => e.key === "Enter" && submitComment()}
              placeholder="Add a comment…"
              className="flex-1 rounded-lg border border-border/20 bg-background px-3 py-2 text-[11px] text-foreground outline-none placeholder:text-foreground/25 focus:border-accent/30"
            />
            <button onClick={submitComment} disabled={!commentText.trim()} className="text-accent/60 hover:text-accent disabled:opacity-30">
              <Send className="h-4 w-4" />
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
