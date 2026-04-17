import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  X, Heart, HeartOff, MessageCircle, Star, Send, Bookmark, BookmarkCheck,
  Loader2, Trash2, Flag, ChevronDown, ChevronUp, MoreHorizontal, Edit3
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { AuthGate } from "@/components/AuthGate";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

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
  parent_id: string | null;
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
  onEdit?: (post: OOTDPost) => void;
  onDelete?: (postId: string) => void;
}

export default function OOTDPostDetail({
  post, profile, reaction, isStarred, isSaved, starsLeft,
  onClose, onReaction, onStar, onSave, onTopicClick, onEdit, onDelete,
}: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);
  const [loadingComments, setLoadingComments] = useState(true);
  const [profileMap, setProfileMap] = useState<Record<string, ProfileInfo>>({});
  const [commentLikes, setCommentLikes] = useState<Set<string>>(new Set());
  const [commentLikeCounts, setCommentLikeCounts] = useState<Record<string, number>>({});
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());
  const [showPostMenu, setShowPostMenu] = useState(false);

  const isOwner = user?.id === post.user_id;
  const title = post.caption ? post.caption.split(/\s+/)[0] : null;

  useEffect(() => { loadComments(); }, [post.id]);

  const loadComments = async () => {
    setLoadingComments(true);
    const { data } = await supabase
      .from("ootd_comments")
      .select("*")
      .eq("post_id", post.id)
      .order("created_at", { ascending: true })
      .limit(100);

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

    // Load comment likes
    if (user) {
      const commentIds = fetched.map(c => c.id);
      if (commentIds.length > 0) {
        const { data: likes } = await supabase.from("comment_likes").select("comment_id").eq("user_id", user.id).in("comment_id", commentIds);
        if (likes) setCommentLikes(new Set(likes.map((l: any) => l.comment_id)));
      }
    }

    // Count likes per comment
    const commentIds = fetched.map(c => c.id);
    if (commentIds.length > 0) {
      const counts: Record<string, number> = {};
      for (const c of fetched) counts[c.id] = 0;
      const { data: allLikes } = await supabase.from("comment_likes").select("comment_id").in("comment_id", commentIds);
      if (allLikes) {
        for (const l of allLikes) counts[(l as any).comment_id] = (counts[(l as any).comment_id] || 0) + 1;
      }
      setCommentLikeCounts(counts);
    }

    setComments(fetched);
    setLoadingComments(false);
  };

  const submitComment = async () => {
    if (!user || !commentText.trim()) return;
    const insertData: any = {
      post_id: post.id, user_id: user.id, content: commentText.trim(),
    };
    if (replyTo) insertData.parent_id = replyTo.id;

    const { data, error } = await supabase.from("ootd_comments").insert(insertData).select().single();
    if (!error && data) {
      setComments(prev => [...prev, data as Comment]);
      setCommentText("");
      setReplyTo(null);
      if (replyTo) setExpandedReplies(prev => new Set(prev).add(replyTo.id));
    }
  };

  const deleteComment = async (commentId: string) => {
    await supabase.from("ootd_comments").delete().eq("id", commentId);
    setComments(prev => prev.filter(c => c.id !== commentId && c.parent_id !== commentId));
    toast.success("Comment deleted");
  };

  const toggleCommentLike = async (commentId: string) => {
    if (!user) return;
    if (commentLikes.has(commentId)) {
      await supabase.from("comment_likes").delete().eq("comment_id", commentId).eq("user_id", user.id);
      setCommentLikes(prev => { const n = new Set(prev); n.delete(commentId); return n; });
      setCommentLikeCounts(prev => ({ ...prev, [commentId]: Math.max(0, (prev[commentId] || 0) - 1) }));
    } else {
      await supabase.from("comment_likes").insert({ comment_id: commentId, user_id: user.id });
      setCommentLikes(prev => new Set(prev).add(commentId));
      setCommentLikeCounts(prev => ({ ...prev, [commentId]: (prev[commentId] || 0) + 1 }));
    }
  };

  const reportComment = async (commentId: string) => {
    if (!user) return;
    const { error } = await supabase.from("comment_reports").insert({ comment_id: commentId, reporter_id: user.id });
    if (!error) toast.success("Comment reported");
    else toast.error("Already reported");
  };

  const canDeleteComment = (comment: Comment) => {
    if (!user) return false;
    return user.id === comment.user_id || user.id === post.user_id;
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

  const parentComments = comments.filter(c => !c.parent_id);
  const getReplies = (parentId: string) => comments.filter(c => c.parent_id === parentId);

  const renderComment = (c: Comment, isReply = false) => (
    <div key={c.id} className={`flex gap-2 group ${isReply ? "ml-6 mt-2" : ""}`}>
      <button
        onClick={() => { onClose(); navigate(`/user/${c.user_id}`); }}
        className="h-7 w-7 rounded-full bg-foreground/[0.06] overflow-hidden flex-shrink-0 mt-0.5"
      >
        {profileMap[c.user_id]?.avatar_url ? (
          <img src={profileMap[c.user_id].avatar_url!} className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-[10px] font-bold text-foreground/40">
            {getCommentName(c.user_id)[0].toUpperCase()}
          </div>
        )}
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1.5">
          <button onClick={() => { onClose(); navigate(`/user/${c.user_id}`); }} className="text-[12px] font-semibold text-foreground/80 hover:text-foreground">
            {getCommentName(c.user_id)}
          </button>
          <span className="text-[10px] text-foreground/35">{timeAgo(c.created_at)}</span>
        </div>
        <p className="text-[13px] text-foreground/80 leading-relaxed">{c.content}</p>
        <div className="flex items-center gap-3 mt-1 opacity-60 group-hover:opacity-100 transition-opacity">
          <button onClick={() => toggleCommentLike(c.id)} className={`flex items-center gap-0.5 text-[10px] ${commentLikes.has(c.id) ? "text-rose-400" : "text-foreground/40 hover:text-foreground/60"}`}>
            <Heart className={`h-3 w-3 ${commentLikes.has(c.id) ? "fill-current" : ""}`} />
            {(commentLikeCounts[c.id] || 0) > 0 && <span>{commentLikeCounts[c.id]}</span>}
          </button>
          {!isReply && (
            <button onClick={() => setReplyTo({ id: c.id, name: getCommentName(c.user_id) })} className="text-[10px] text-foreground/40 hover:text-foreground/60">
              Reply
            </button>
          )}
          {canDeleteComment(c) && (
            <button onClick={() => deleteComment(c.id)} className="text-[10px] text-foreground/30 hover:text-destructive/70">
              <Trash2 className="h-3 w-3" />
            </button>
          )}
          <button onClick={() => reportComment(c.id)} className="text-[10px] text-foreground/30 hover:text-foreground/50">
            <Flag className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );

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
        className="w-full max-w-md md:max-w-5xl max-h-[90vh] rounded-2xl bg-card border border-border overflow-hidden flex flex-col md:flex-row"
      >
        {/* Image */}
        <div className="relative flex-shrink-0 md:w-[55%] md:h-[85vh] md:bg-black/40">
          <img src={post.image_url} alt="" className="w-full aspect-[3/4] md:aspect-auto md:h-full object-cover md:object-contain" />
          <button onClick={onClose} className="absolute top-3 right-3 rounded-full bg-black/40 p-1.5 text-white/70 hover:text-white backdrop-blur-sm">
            <X className="h-4 w-4" />
          </button>
          {/* Post menu for owner */}
          {(isOwner || onEdit || onDelete) && (
            <div className="absolute top-3 left-3">
              <button onClick={() => setShowPostMenu(!showPostMenu)} className="rounded-full bg-black/40 p-1.5 text-white/70 hover:text-white backdrop-blur-sm">
                <MoreHorizontal className="h-4 w-4" />
              </button>
              {showPostMenu && (
                <div className="absolute top-8 left-0 rounded-lg bg-card border border-border shadow-lg py-1 min-w-[120px] z-10">
                  {onEdit && isOwner && (
                    <button onClick={() => { setShowPostMenu(false); onEdit(post); }} className="flex items-center gap-2 w-full px-3 py-2 text-[11px] text-foreground/70 hover:bg-foreground/5">
                      <Edit3 className="h-3 w-3" /> Edit Post
                    </button>
                  )}
                  {onDelete && isOwner && (
                    <button onClick={() => { setShowPostMenu(false); onDelete(post.id); }} className="flex items-center gap-2 w-full px-3 py-2 text-[11px] text-destructive/70 hover:bg-destructive/5">
                      <Trash2 className="h-3 w-3" /> Delete Post
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
          {(post.star_count || 0) > 0 && (
            <div className="absolute bottom-3 left-3 flex items-center gap-0.5 rounded-full bg-black/40 px-2 py-1 backdrop-blur-sm">
              <Star className="h-3 w-3 fill-[hsl(var(--star))] text-[hsl(var(--star))]" />
              <span className="text-[10px] font-medium text-white/80">{post.star_count}</span>
            </div>
          )}
        </div>

        {/* Right column: details + comments + input */}
        <div className="flex flex-col flex-1 md:h-[85vh] min-h-0">
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-4">
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
              <p className="text-[13px] font-semibold text-foreground/85 group-hover:text-foreground transition-colors">
                {profile?.display_name || "Anonymous"}
              </p>
              <p className="text-[10px] text-foreground/40">{timeAgo(post.created_at)} ago</p>
            </div>
          </button>

          {/* Title + Message */}
          {post.caption && (
            <div>
              {title && <p className="text-[13px] font-semibold text-foreground/80 mb-1">{title}</p>}
              <p className="text-[13px] text-foreground/75 leading-relaxed">{post.caption}</p>
            </div>
          )}

          {/* Hashtags / Topics */}
          {post.topics && post.topics.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {post.topics.map(tp => (
                <button key={tp} onClick={() => { onClose(); onTopicClick(tp); }} className="text-[12px] font-medium text-accent/80 hover:text-accent transition-colors">
                  #{tp}
                </button>
              ))}
            </div>
          )}

          {/* Style tags */}
          {post.style_tags && post.style_tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {post.style_tags.map(tag => (
                <span key={tag} className="rounded-full bg-foreground/[0.05] px-2.5 py-1 text-[11px] text-foreground/60">{tag}</span>
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

          {/* Threaded Comments */}
          <div className="space-y-3">
            <p className="text-[9px] font-semibold tracking-[0.15em] text-foreground/40 uppercase">Comments</p>
            {loadingComments ? (
              <Loader2 className="h-3 w-3 animate-spin text-foreground/25 mx-auto" />
            ) : parentComments.length === 0 ? (
              <p className="text-[10px] text-foreground/25 text-center py-3">No comments yet</p>
            ) : (
              parentComments.map(c => {
                const replies = getReplies(c.id);
                const isExpanded = expandedReplies.has(c.id);
                return (
                  <div key={c.id} className="space-y-1">
                    {renderComment(c)}
                    {replies.length > 0 && (
                      <>
                        <button
                          onClick={() => setExpandedReplies(prev => {
                            const n = new Set(prev);
                            isExpanded ? n.delete(c.id) : n.add(c.id);
                            return n;
                          })}
                          className="ml-7 flex items-center gap-1 text-[8px] text-accent/50 hover:text-accent/70"
                        >
                          {isExpanded ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
                          {replies.length} {replies.length === 1 ? "reply" : "replies"}
                        </button>
                        {isExpanded && replies.map(r => renderComment(r, true))}
                      </>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Comment input */}
        {user && (
          <div className="border-t border-border/15 flex-shrink-0">
            {replyTo && (
              <div className="flex items-center justify-between px-4 py-1.5 bg-foreground/[0.02]">
                <span className="text-[10px] md:text-[11px] text-foreground/40">Replying to <span className="font-semibold">{replyTo.name}</span></span>
                <button onClick={() => setReplyTo(null)} className="text-foreground/30 hover:text-foreground/50">
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            <div className="flex gap-2 p-4">
              <input
                type="text"
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                onKeyDown={e => e.key === "Enter" && submitComment()}
                placeholder={replyTo ? `Reply to ${replyTo.name}…` : "Add a comment…"}
                className="flex-1 rounded-lg border border-border/20 bg-background px-3 py-2 text-[12px] md:text-[13px] text-foreground outline-none placeholder:text-foreground/25 focus:border-accent/30"
              />
              <button onClick={submitComment} disabled={!commentText.trim()} className="text-accent/60 hover:text-accent disabled:opacity-30">
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
        </div>
      </motion.div>
    </motion.div>
  );
}
