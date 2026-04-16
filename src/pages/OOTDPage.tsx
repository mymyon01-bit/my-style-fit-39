import { useState, useEffect, useCallback, useRef } from "react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Star, Camera, Loader2, Hash, TrendingUp, Heart, HeartOff, MessageCircle, X, Send } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AuthGate } from "@/components/AuthGate";
import { motion, AnimatePresence } from "framer-motion";
import OOTDUploadSheet from "@/components/OOTDUploadSheet";
import OOTDAnalyzer from "@/components/OOTDAnalyzer";

interface OOTDPost {
  id: string;
  user_id: string;
  image_url: string;
  caption: string | null;
  style_tags: string[] | null;
  weather_tag: string | null;
  occasion_tags: string[] | null;
  topics: string[] | null;
  star_count: number | null;
  like_count: number | null;
  dislike_count: number | null;
  created_at: string;
}

interface Topic {
  id: string;
  name: string;
  post_count: number;
}

interface ProfileInfo {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface Comment {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  profile?: ProfileInfo | null;
}

type Tab = "community" | "mypage" | "scan";

const OOTDPage = () => {
  const { t } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("community");
  const [posts, setPosts] = useState<OOTDPost[]>([]);
  const [myPosts, setMyPosts] = useState<OOTDPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [starsLeft, setStarsLeft] = useState(3);
  const [starredPosts, setStarredPosts] = useState<Set<string>>(new Set());
  const [uploadOpen, setUploadOpen] = useState(false);
  const [trendingTopics, setTrendingTopics] = useState<Topic[]>([]);
  const [activeTopic, setActiveTopic] = useState<string | null>(null);
  const [profileMap, setProfileMap] = useState<Record<string, ProfileInfo>>({});
  const [reactions, setReactions] = useState<Record<string, "like" | "dislike">>({});
  const [expandedComments, setExpandedComments] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);

  useEffect(() => {
    loadPosts();
    loadTopics();
    if (user) { loadMyPosts(); loadTodayStars(); loadUserReactions(); }
  }, [user]);

  useEffect(() => { loadPosts(); }, [activeTopic]);

  const loadTopics = async () => {
    const { data } = await supabase.from("ootd_topics").select("*").order("post_count", { ascending: false }).limit(15);
    setTrendingTopics((data as Topic[]) || []);
  };

  const loadPosts = async () => {
    setIsLoading(true);
    let query = supabase.from("ootd_posts").select("*").order("created_at", { ascending: false }).limit(30);
    if (activeTopic) query = query.contains("topics", [activeTopic]);
    const { data } = await query;
    const fetched = (data as OOTDPost[]) || [];
    setPosts(fetched);
    setIsLoading(false);

    // Load profiles for all post authors
    const userIds = [...new Set(fetched.map(p => p.user_id))];
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url")
        .in("user_id", userIds);
      if (profiles) {
        const map: Record<string, ProfileInfo> = {};
        for (const p of profiles) map[p.user_id] = p as ProfileInfo;
        setProfileMap(prev => ({ ...prev, ...map }));
      }
    }
  };

  const loadMyPosts = async () => {
    if (!user) return;
    const { data } = await supabase.from("ootd_posts").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    setMyPosts((data as OOTDPost[]) || []);
  };

  const loadTodayStars = async () => {
    if (!user) return;
    const today = new Date().toISOString().split("T")[0];
    const { data } = await supabase.from("ootd_stars").select("id, post_id").eq("user_id", user.id).gte("created_at", today);
    const given = data || [];
    setStarsLeft(3 - given.length);
    setStarredPosts(new Set(given.map(s => s.post_id)));
  };

  const loadUserReactions = async () => {
    if (!user) return;
    const { data } = await supabase.from("ootd_reactions").select("post_id, reaction").eq("user_id", user.id);
    if (data) {
      const map: Record<string, "like" | "dislike"> = {};
      for (const r of data) map[r.post_id] = r.reaction as "like" | "dislike";
      setReactions(map);
    }
  };

  const handleReaction = async (postId: string, type: "like" | "dislike") => {
    if (!user) return;
    const current = reactions[postId];

    if (current === type) {
      // Remove reaction
      await supabase.from("ootd_reactions").delete().eq("post_id", postId).eq("user_id", user.id);
      setReactions(prev => { const n = { ...prev }; delete n[postId]; return n; });
      setPosts(prev => prev.map(p => p.id === postId ? {
        ...p,
        like_count: type === "like" ? Math.max(0, (p.like_count || 0) - 1) : p.like_count,
        dislike_count: type === "dislike" ? Math.max(0, (p.dislike_count || 0) - 1) : p.dislike_count,
      } : p));
    } else if (current) {
      // Switch reaction
      await supabase.from("ootd_reactions").update({ reaction: type }).eq("post_id", postId).eq("user_id", user.id);
      setReactions(prev => ({ ...prev, [postId]: type }));
      setPosts(prev => prev.map(p => p.id === postId ? {
        ...p,
        like_count: type === "like" ? (p.like_count || 0) + 1 : Math.max(0, (p.like_count || 0) - 1),
        dislike_count: type === "dislike" ? (p.dislike_count || 0) + 1 : Math.max(0, (p.dislike_count || 0) - 1),
      } : p));
    } else {
      // New reaction
      await supabase.from("ootd_reactions").insert({ post_id: postId, user_id: user.id, reaction: type });
      setReactions(prev => ({ ...prev, [postId]: type }));
      setPosts(prev => prev.map(p => p.id === postId ? {
        ...p,
        like_count: type === "like" ? (p.like_count || 0) + 1 : p.like_count,
        dislike_count: type === "dislike" ? (p.dislike_count || 0) + 1 : p.dislike_count,
      } : p));
    }

    await supabase.from("interactions").insert({
      user_id: user.id,
      event_type: type,
      target_id: postId,
      target_type: "ootd",
      metadata: {},
    });
  };

  const handleStar = async (postId: string) => {
    if (!user || starsLeft <= 0 || starredPosts.has(postId)) return;
    const { error } = await supabase.from("ootd_stars").insert({ user_id: user.id, post_id: postId });
    if (!error) {
      setStarsLeft(prev => prev - 1);
      setStarredPosts(prev => new Set(prev).add(postId));
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, star_count: (p.star_count || 0) + 1 } : p));
    }
  };

  const toggleComments = async (postId: string) => {
    if (expandedComments === postId) { setExpandedComments(null); return; }
    setExpandedComments(postId);
    setLoadingComments(true);
    setCommentText("");
    const { data } = await supabase
      .from("ootd_comments")
      .select("*")
      .eq("post_id", postId)
      .order("created_at", { ascending: true })
      .limit(50);

    const fetched = (data || []) as Comment[];
    // Load profiles for commenters
    const cUserIds = [...new Set(fetched.map(c => c.user_id))];
    if (cUserIds.length > 0) {
      const { data: profiles } = await supabase.from("profiles").select("user_id, display_name, avatar_url").in("user_id", cUserIds);
      if (profiles) {
        const map: Record<string, ProfileInfo> = {};
        for (const p of profiles) map[p.user_id] = p as ProfileInfo;
        setProfileMap(prev => ({ ...prev, ...map }));
      }
    }
    setComments(fetched);
    setLoadingComments(false);
  };

  const submitComment = async () => {
    if (!user || !expandedComments || !commentText.trim()) return;
    const { data, error } = await supabase.from("ootd_comments").insert({
      post_id: expandedComments,
      user_id: user.id,
      content: commentText.trim(),
    }).select().single();

    if (!error && data) {
      setComments(prev => [...prev, data as Comment]);
      setCommentText("");
      await supabase.from("interactions").insert({
        user_id: user.id,
        event_type: "comment",
        target_id: expandedComments,
        target_type: "ootd",
        metadata: {},
      });
    }
  };

  const handlePosted = () => { loadPosts(); loadMyPosts(); loadTopics(); };

  const getDisplayName = (userId: string) => profileMap[userId]?.display_name || "User";
  const getAvatar = (userId: string) => profileMap[userId]?.avatar_url;

  return (
    <div className="min-h-screen bg-background pb-28 md:pb-28 lg:pb-16 lg:pt-24">
      {/* Header */}
      <div className="mx-auto max-w-lg px-6 pt-10 md:max-w-2xl md:px-10 lg:max-w-4xl lg:px-12">
        <div className="flex items-baseline justify-between mb-8">
          <span className="font-display text-[12px] font-medium tracking-[0.35em] text-foreground/80 lg:hidden">WARDROBE</span>
          <div className="flex items-center gap-4">
            {user && (
              <div className="flex items-center gap-1.5">
                <Star className="h-3.5 w-3.5 fill-[hsl(var(--star))] text-[hsl(var(--star))]" />
                <span className="text-[10px] font-medium text-foreground/80">{starsLeft}</span>
              </div>
            )}
            <span className="text-[10px] font-medium tracking-[0.25em] text-foreground/75">OOTD</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex">
          {(["scan", "mypage", "community"] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className="relative flex-1 pb-5 text-center">
              <span className={`text-[10px] font-medium tracking-[0.2em] transition-colors duration-300 ${
                activeTab === tab ? "text-foreground/85" : "text-foreground/50"
              }`}>
                {tab === "mypage" ? "MY PAGE" : tab === "scan" ? "STYLE SCAN" : "COMMUNITY"}
              </span>
              {activeTab === tab && (
                <motion.div layoutId="ootd-tab" className="absolute bottom-0 left-1/4 right-1/4 h-px bg-accent/50" />
              )}
            </button>
          ))}
        </div>
        <div className="h-px bg-accent/[0.14]" />
      </div>

      <div className="mx-auto max-w-lg px-6 pt-8 md:max-w-2xl md:px-10 lg:max-w-4xl lg:px-12">
        <AnimatePresence mode="wait">
          {activeTab === "scan" ? (
            <motion.div key="scan" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <OOTDAnalyzer />
            </motion.div>
          ) : activeTab === "mypage" ? (
            <motion.div key="mypage" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-8">
              {!user ? (
                <div className="py-20 text-center space-y-5">
                  <Camera className="h-6 w-6 text-foreground/65 mx-auto" />
                  <p className="text-[14px] text-foreground/75">Sign in to create your style page</p>
                  <button onClick={() => navigate("/auth")} className="text-[10px] font-medium tracking-[0.2em] text-accent/80 hover:text-accent">SIGN IN</button>
                </div>
              ) : (
                <>
                  <button onClick={() => setUploadOpen(true)} className="flex w-full items-center justify-center gap-3 py-14 text-foreground/80 hover:text-accent/80 transition-colors">
                    <Camera className="h-5 w-5" />
                    <span className="text-[10px] font-medium tracking-[0.2em]">POST YOUR OOTD</span>
                  </button>
                  <div className="h-px bg-accent/[0.14]" />

                  {myPosts.length === 0 ? (
                    <div className="py-16 text-center space-y-3">
                      <p className="text-[13px] text-foreground/80">No outfits posted yet</p>
                      <p className="text-[11px] text-foreground/80 max-w-[220px] mx-auto leading-relaxed">
                        Upload daily looks to build your style identity.
                      </p>
                    </div>
                  ) : (
                    <div className="columns-2 gap-3 md:columns-3">
                      {myPosts.map(post => (
                        <div key={post.id} className="mb-3 break-inside-avoid">
                          <img src={post.image_url} alt={post.caption || ""} className="w-full rounded-xl object-cover" loading="lazy" />
                          <div className="pt-2 flex items-center justify-between px-0.5">
                            <p className="text-[10px] text-foreground/60 truncate flex-1">{post.caption || ""}</p>
                            <div className="flex items-center gap-0.5">
                              <Star className="h-2.5 w-2.5 fill-[hsl(var(--star))] text-[hsl(var(--star))]" />
                              <span className="text-[10px] text-foreground/50">{post.star_count || 0}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </motion.div>
          ) : (
            <motion.div key="community" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
              {/* Trending Topics */}
              {trendingTopics.length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex items-center gap-1.5">
                    <TrendingUp className="h-3 w-3 text-accent/60" />
                    <span className="text-[10px] font-medium tracking-[0.2em] text-foreground/50">TOPICS</span>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <button onClick={() => setActiveTopic(null)} className={`rounded-full border px-3 py-1.5 text-[10px] font-medium transition-all ${!activeTopic ? "border-accent bg-accent/10 text-accent" : "border-border/30 text-foreground/50"}`}>
                      All
                    </button>
                    {trendingTopics.map(topic => (
                      <button key={topic.id} onClick={() => setActiveTopic(activeTopic === topic.name ? null : topic.name)} className={`rounded-full border px-3 py-1.5 text-[10px] font-medium transition-all ${activeTopic === topic.name ? "border-accent bg-accent/10 text-accent" : "border-border/30 text-foreground/50"}`}>
                        #{topic.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Social Feed — Masonry */}
              {isLoading ? (
                <div className="columns-2 gap-3 md:columns-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="mb-3 break-inside-avoid animate-pulse">
                      <div className="rounded-xl bg-foreground/[0.04]" style={{ height: `${180 + (i % 3) * 60}px` }} />
                    </div>
                  ))}
                </div>
              ) : posts.length === 0 ? (
                <div className="py-20 text-center space-y-4">
                  <Camera className="h-6 w-6 text-foreground/30 mx-auto" />
                  <p className="text-[13px] text-foreground/50">
                    {activeTopic ? `No posts in #${activeTopic} yet` : "Community feed is growing"}
                  </p>
                  {user && (
                    <button onClick={() => { setActiveTab("mypage"); setUploadOpen(true); }} className="text-[10px] font-medium tracking-[0.2em] text-accent/60 hover:text-accent">
                      POST FIRST
                    </button>
                  )}
                </div>
              ) : (
                <div className="columns-2 gap-3 md:columns-3">
                  {posts.map((post, index) => {
                    const isStarred = starredPosts.has(post.id);
                    const reaction = reactions[post.id];
                    const isCommentsOpen = expandedComments === post.id;
                    const authorName = getDisplayName(post.user_id);
                    const authorAvatar = getAvatar(post.user_id);

                    return (
                      <motion.div
                        key={post.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: index * 0.03 }}
                        className="mb-4 break-inside-avoid"
                      >
                        {/* Image */}
                        <div className="relative overflow-hidden rounded-xl">
                          <img src={post.image_url} alt={post.caption || ""} className="w-full object-cover" loading="lazy" />

                          {/* Star badge */}
                          {(post.star_count || 0) > 0 && (
                            <div className="absolute top-2 right-2 flex items-center gap-0.5 rounded-full bg-black/40 px-1.5 py-0.5 backdrop-blur-sm">
                              <Star className="h-2.5 w-2.5 fill-[hsl(var(--star))] text-[hsl(var(--star))]" />
                              <span className="text-[9px] text-white/80">{post.star_count}</span>
                            </div>
                          )}
                        </div>

                        {/* Author + caption */}
                        <div className="mt-2 px-0.5">
                          <button
                            onClick={() => navigate(`/user/${post.user_id}`)}
                            className="flex items-center gap-1.5 mb-1 group"
                          >
                            <div className="h-4 w-4 rounded-full bg-foreground/[0.06] overflow-hidden flex-shrink-0">
                              {authorAvatar ? (
                                <img src={authorAvatar} alt="" className="h-full w-full object-cover" />
                              ) : (
                                <div className="h-full w-full flex items-center justify-center text-[7px] font-bold text-foreground/30">
                                  {authorName[0]?.toUpperCase()}
                                </div>
                              )}
                            </div>
                            <span className="text-[10px] font-medium text-foreground/60 group-hover:text-foreground/80 transition-colors">
                              {authorName}
                            </span>
                          </button>

                          {post.caption && (
                            <p className="text-[10px] text-foreground/50 line-clamp-2 mb-1.5">{post.caption}</p>
                          )}

                          {/* Interactions */}
                          <div className="flex items-center gap-3 mt-1">
                            <AuthGate action="react">
                              <button onClick={() => handleReaction(post.id, "like")} className={`flex items-center gap-0.5 transition-colors ${reaction === "like" ? "text-rose-400" : "text-foreground/30 hover:text-foreground/50"}`}>
                                <Heart className={`h-3.5 w-3.5 ${reaction === "like" ? "fill-current" : ""}`} />
                                {(post.like_count || 0) > 0 && <span className="text-[9px]">{post.like_count}</span>}
                              </button>
                            </AuthGate>

                            <AuthGate action="react">
                              <button onClick={() => handleReaction(post.id, "dislike")} className={`flex items-center gap-0.5 transition-colors ${reaction === "dislike" ? "text-blue-400" : "text-foreground/30 hover:text-foreground/50"}`}>
                                <HeartOff className={`h-3.5 w-3.5 ${reaction === "dislike" ? "fill-current" : ""}`} />
                              </button>
                            </AuthGate>

                            <button onClick={() => toggleComments(post.id)} className={`flex items-center gap-0.5 transition-colors ${isCommentsOpen ? "text-accent/70" : "text-foreground/30 hover:text-foreground/50"}`}>
                              <MessageCircle className="h-3.5 w-3.5" />
                            </button>

                            <AuthGate action="give stars">
                              <button onClick={() => handleStar(post.id)} disabled={starsLeft <= 0 && !isStarred} className={`flex items-center gap-0.5 ml-auto transition-colors ${isStarred ? "text-[hsl(var(--star))]" : "text-foreground/30 hover:text-foreground/50"}`}>
                                <Star className={`h-3.5 w-3.5 ${isStarred ? "fill-current" : ""}`} />
                              </button>
                            </AuthGate>
                          </div>

                          {/* Comments section */}
                          <AnimatePresence>
                            {isCommentsOpen && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="mt-2 space-y-2 overflow-hidden"
                              >
                                {loadingComments ? (
                                  <Loader2 className="h-3 w-3 animate-spin text-foreground/30 mx-auto" />
                                ) : (
                                  <>
                                    {comments.map(c => (
                                      <div key={c.id} className="flex gap-2">
                                        <span className="text-[9px] font-semibold text-foreground/50 flex-shrink-0">
                                          {getDisplayName(c.user_id)}
                                        </span>
                                        <span className="text-[9px] text-foreground/40">{c.content}</span>
                                      </div>
                                    ))}
                                    {comments.length === 0 && (
                                      <p className="text-[9px] text-foreground/25 text-center py-1">No comments yet</p>
                                    )}
                                  </>
                                )}

                                {user && (
                                  <div className="flex gap-1.5 mt-1">
                                    <input
                                      type="text"
                                      value={commentText}
                                      onChange={e => setCommentText(e.target.value)}
                                      onKeyDown={e => e.key === "Enter" && submitComment()}
                                      placeholder="Add a comment…"
                                      className="flex-1 rounded-lg border border-border/20 bg-background px-2 py-1.5 text-[10px] text-foreground outline-none placeholder:text-foreground/20 focus:border-accent/30"
                                    />
                                    <button onClick={submitComment} disabled={!commentText.trim()} className="text-accent/50 hover:text-accent disabled:opacity-30">
                                      <Send className="h-3 w-3" />
                                    </button>
                                  </div>
                                )}
                              </motion.div>
                            )}
                          </AnimatePresence>

                          {/* Tags */}
                          {post.topics && post.topics.length > 0 && (
                            <div className="mt-2 flex gap-1.5 flex-wrap">
                              {post.topics.map(tp => (
                                <button key={tp} onClick={() => setActiveTopic(tp)} className="text-[9px] text-accent/60 hover:text-accent transition-colors">
                                  #{tp}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <OOTDUploadSheet open={uploadOpen} onClose={() => setUploadOpen(false)} onPosted={handlePosted} />
    </div>
  );
};

export default OOTDPage;
