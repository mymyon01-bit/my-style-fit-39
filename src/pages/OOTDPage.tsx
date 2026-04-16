import { useState, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Star, Camera, Loader2, TrendingUp, Heart, Bookmark, BookmarkCheck, Crown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AuthGate } from "@/components/AuthGate";
import { motion, AnimatePresence } from "framer-motion";
import OOTDUploadSheet from "@/components/OOTDUploadSheet";
import OOTDPostDetail from "@/components/OOTDPostDetail";
import CrownedBoard from "@/components/CrownedBoard";

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

type Tab = "community" | "mypage" | "crowned";

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
  const [savedPosts, setSavedPosts] = useState<Set<string>>(new Set());
  const [selectedPost, setSelectedPost] = useState<OOTDPost | null>(null);

  useEffect(() => {
    loadPosts();
    loadTopics();
    if (user) { loadMyPosts(); loadTodayStars(); loadUserReactions(); loadSavedPosts(); }
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

    const userIds = [...new Set(fetched.map(p => p.user_id))];
    if (userIds.length > 0) {
      const { data: profiles } = await supabase.from("profiles").select("user_id, display_name, avatar_url").in("user_id", userIds);
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

  const loadSavedPosts = async () => {
    if (!user) return;
    const { data } = await supabase.from("saved_posts").select("post_id").eq("user_id", user.id);
    if (data) setSavedPosts(new Set(data.map((d: any) => d.post_id)));
  };

  const handleSavePost = async (postId: string) => {
    if (!user) return;
    if (savedPosts.has(postId)) {
      await supabase.from("saved_posts").delete().eq("user_id", user.id).eq("post_id", postId);
      setSavedPosts(prev => { const n = new Set(prev); n.delete(postId); return n; });
    } else {
      await supabase.from("saved_posts").insert({ user_id: user.id, post_id: postId });
      setSavedPosts(prev => new Set(prev).add(postId));
    }
  };

  const handleReaction = async (postId: string, type: "like" | "dislike") => {
    if (!user) return;
    const current = reactions[postId];
    if (current === type) {
      await supabase.from("ootd_reactions").delete().eq("post_id", postId).eq("user_id", user.id);
      setReactions(prev => { const n = { ...prev }; delete n[postId]; return n; });
      setPosts(prev => prev.map(p => p.id === postId ? {
        ...p,
        like_count: type === "like" ? Math.max(0, (p.like_count || 0) - 1) : p.like_count,
        dislike_count: type === "dislike" ? Math.max(0, (p.dislike_count || 0) - 1) : p.dislike_count,
      } : p));
    } else if (current) {
      await supabase.from("ootd_reactions").update({ reaction: type }).eq("post_id", postId).eq("user_id", user.id);
      setReactions(prev => ({ ...prev, [postId]: type }));
      setPosts(prev => prev.map(p => p.id === postId ? {
        ...p,
        like_count: type === "like" ? (p.like_count || 0) + 1 : Math.max(0, (p.like_count || 0) - 1),
        dislike_count: type === "dislike" ? (p.dislike_count || 0) + 1 : Math.max(0, (p.dislike_count || 0) - 1),
      } : p));
    } else {
      await supabase.from("ootd_reactions").insert({ post_id: postId, user_id: user.id, reaction: type });
      setReactions(prev => ({ ...prev, [postId]: type }));
      setPosts(prev => prev.map(p => p.id === postId ? {
        ...p,
        like_count: type === "like" ? (p.like_count || 0) + 1 : p.like_count,
        dislike_count: type === "dislike" ? (p.dislike_count || 0) + 1 : p.dislike_count,
      } : p));
    }
    await supabase.from("interactions").insert({
      user_id: user.id, event_type: type, target_id: postId, target_type: "ootd", metadata: {},
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

  const handlePosted = () => { loadPosts(); loadMyPosts(); loadTopics(); };
  const getProfile = (userId: string) => profileMap[userId] || null;

  // Render a post card (used in both community + my page)
  const renderPostCard = (post: OOTDPost, index: number, showAuthor = true) => {
    const profile = getProfile(post.user_id);
    const likes = post.like_count || 0;

    return (
      <motion.div
        key={post.id}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: index * 0.03 }}
        className="mb-3 break-inside-avoid cursor-pointer group"
        onClick={() => setSelectedPost(post)}
      >
        <div className="relative overflow-hidden rounded-xl">
          <img
            src={post.image_url}
            alt={post.caption || ""}
            className="w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            loading="lazy"
          />
          {/* Subtle bottom overlay */}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/40 to-transparent p-2.5 pt-8">
            {showAuthor && (
              <p className="text-[9px] font-medium text-white/70 truncate">
                {profile?.display_name || "Anonymous"}
              </p>
            )}
            <div className="flex items-center gap-2 mt-0.5">
              {likes > 0 && (
                <span className="flex items-center gap-0.5">
                  <Heart className="h-2.5 w-2.5 text-white/60" />
                  <span className="text-[8px] text-white/60">{likes}</span>
                </span>
              )}
              {(post.star_count || 0) > 0 && (
                <span className="flex items-center gap-0.5">
                  <Star className="h-2.5 w-2.5 fill-[hsl(var(--star))] text-[hsl(var(--star))]" />
                  <span className="text-[8px] text-white/70">{post.star_count}</span>
                </span>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen bg-background pb-28 md:pb-28 lg:pb-16 lg:pt-24">
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
          {(["crowned", "mypage", "community"] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className="relative flex-1 pb-5 text-center">
              <span className={`text-[10px] font-medium tracking-[0.2em] transition-colors duration-300 flex items-center justify-center gap-1.5 ${
                activeTab === tab ? "text-foreground/85" : "text-foreground/50"
              }`}>
                {tab === "crowned" && <Crown className={`h-3 w-3 ${activeTab === "crowned" ? "text-yellow-400" : ""}`} />}
                {tab === "mypage" ? "MY PAGE" : tab === "crowned" ? "CROWNED" : "COMMUNITY"}
              </span>
              {activeTab === tab && (
                <motion.div layoutId="ootd-tab" className={`absolute bottom-0 left-1/4 right-1/4 h-px ${tab === "crowned" ? "bg-yellow-400/50" : "bg-accent/50"}`} />
              )}
            </button>
          ))}
        </div>
        <div className="h-px bg-accent/[0.14]" />
      </div>

      <div className="mx-auto max-w-lg px-6 pt-8 md:max-w-2xl md:px-10 lg:max-w-4xl lg:px-12">
        <AnimatePresence mode="wait">
          {activeTab === "crowned" ? (
            <motion.div key="crowned" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <CrownedBoard />
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
                  <button onClick={() => setUploadOpen(true)} className="flex w-full items-center justify-center gap-3 py-10 rounded-2xl border-2 border-dashed border-foreground/10 text-foreground/60 hover:text-accent/80 hover:border-accent/30 transition-colors">
                    <Camera className="h-5 w-5" />
                    <span className="text-[10px] font-medium tracking-[0.2em]">POST YOUR OOTD</span>
                  </button>

                  {myPosts.length === 0 ? (
                    <div className="py-16 text-center space-y-3">
                      <p className="text-[13px] text-foreground/80">No outfits posted yet</p>
                      <p className="text-[11px] text-foreground/50 max-w-[220px] mx-auto leading-relaxed">
                        Upload daily looks to build your style identity.
                      </p>
                    </div>
                  ) : (
                    <div className="columns-2 gap-3 md:columns-3">
                      {myPosts.map((post, i) => renderPostCard(post, i, false))}
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

              {/* Social Feed — Card Grid */}
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
                  {posts.map((post, i) => renderPostCard(post, i, true))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Post Detail Modal */}
      <AnimatePresence>
        {selectedPost && (
          <OOTDPostDetail
            post={selectedPost}
            profile={getProfile(selectedPost.user_id)}
            reaction={reactions[selectedPost.id]}
            isStarred={starredPosts.has(selectedPost.id)}
            isSaved={savedPosts.has(selectedPost.id)}
            starsLeft={starsLeft}
            onClose={() => setSelectedPost(null)}
            onReaction={handleReaction}
            onStar={handleStar}
            onSave={handleSavePost}
            onTopicClick={(topic) => { setActiveTopic(topic); setActiveTab("community"); }}
          />
        )}
      </AnimatePresence>

      <OOTDUploadSheet open={uploadOpen} onClose={() => setUploadOpen(false)} onPosted={handlePosted} />
    </div>
  );
};

export default OOTDPage;
