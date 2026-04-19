import { useState, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Star, Camera, Loader2, TrendingUp, Heart, Crown, Edit3, Trash2, X, Save, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AuthGate } from "@/components/AuthGate";
import { motion, AnimatePresence } from "framer-motion";
import OOTDUploadSheet from "@/components/OOTDUploadSheet";
import OOTDPostDetail from "@/components/OOTDPostDetail";
import OOTDCard from "@/components/OOTDCard";
import CrownedBoard from "@/components/CrownedBoard";
import StoriesRow, { type UserStories } from "@/components/StoriesRow";
import StoryUploadSheet from "@/components/StoryUploadSheet";
import StoryViewer from "@/components/StoryViewer";
import MyPageProfileHeader from "@/components/MyPageProfileHeader";
import { toast } from "sonner";

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
  username?: string | null;
}

type Tab = "community" | "mypage" | "crowned";

const MAX_MESSAGE = 100;

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
  // Edit state
  const [editingPost, setEditingPost] = useState<OOTDPost | null>(null);
  const [editCaption, setEditCaption] = useState("");
  const [editTopics, setEditTopics] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  // Delete confirm
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  // Stories
  const [storyUploadOpen, setStoryUploadOpen] = useState(false);
  const [storiesRefreshKey, setStoriesRefreshKey] = useState(0);
  const [allStoryUsers, setAllStoryUsers] = useState<UserStories[]>([]);
  const [viewerState, setViewerState] = useState<{ open: boolean; index: number; users: UserStories[] }>({
    open: false,
    index: 0,
    users: [],
  });

  // Combined user + hashtag search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchUsers, setSearchUsers] = useState<ProfileInfo[]>([]);
  const [searchTopics, setSearchTopics] = useState<Topic[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const myStoryUser = user ? allStoryUsers.find((u) => u.user_id === user.id) : undefined;
  const hasOwnStory = !!myStoryUser;
  const hasOwnUnseen = !!myStoryUser?.hasUnseen;

  useEffect(() => {
    loadPosts();
    loadTopics();
    if (user) { loadMyPosts(); loadTodayStars(); loadUserReactions(); loadSavedPosts(); }
  }, [user]);

  useEffect(() => { loadPosts(); }, [activeTopic]);

  // Debounced combined search (users + hashtags)
  useEffect(() => {
    const raw = searchQuery.trim();
    if (!raw || raw.replace(/[@#\s]/g, "").length < 2) {
      setSearchUsers([]);
      setSearchTopics([]);
      setSearchLoading(false);
      return;
    }
    const intent: "user" | "tag" | "any" = raw.startsWith("@") ? "user" : raw.startsWith("#") ? "tag" : "any";
    const q = raw.replace(/^[@#]/, "").toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (q.length < 2) {
      setSearchUsers([]);
      setSearchTopics([]);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    const timer = setTimeout(async () => {
      const [userRes, topicRes] = await Promise.all([
        intent === "tag"
          ? Promise.resolve({ data: [] as ProfileInfo[] })
          : supabase
              .from("profiles")
              .select("user_id, display_name, avatar_url, username")
              .ilike("username", `${q}%`)
              .limit(15),
        intent === "user"
          ? Promise.resolve({ data: [] as Topic[] })
          : supabase
              .from("ootd_topics")
              .select("*")
              .ilike("name", `${q}%`)
              .order("post_count", { ascending: false })
              .limit(15),
      ]);
      setSearchUsers((userRes.data as ProfileInfo[]) || []);
      setSearchTopics((topicRes.data as Topic[]) || []);
      setSearchLoading(false);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

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
      const { data: profiles } = await supabase.from("profiles").select("user_id, display_name, avatar_url, username").in("user_id", userIds);
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
      const updatePosts = (list: OOTDPost[]) => list.map(p => p.id === postId ? {
        ...p,
        like_count: type === "like" ? Math.max(0, (p.like_count || 0) - 1) : p.like_count,
        dislike_count: type === "dislike" ? Math.max(0, (p.dislike_count || 0) - 1) : p.dislike_count,
      } : p);
      setPosts(updatePosts);
      setMyPosts(updatePosts);
    } else if (current) {
      await supabase.from("ootd_reactions").update({ reaction: type }).eq("post_id", postId).eq("user_id", user.id);
      setReactions(prev => ({ ...prev, [postId]: type }));
      const updatePosts = (list: OOTDPost[]) => list.map(p => p.id === postId ? {
        ...p,
        like_count: type === "like" ? (p.like_count || 0) + 1 : Math.max(0, (p.like_count || 0) - 1),
        dislike_count: type === "dislike" ? (p.dislike_count || 0) + 1 : Math.max(0, (p.dislike_count || 0) - 1),
      } : p);
      setPosts(updatePosts);
      setMyPosts(updatePosts);
    } else {
      await supabase.from("ootd_reactions").insert({ post_id: postId, user_id: user.id, reaction: type });
      setReactions(prev => ({ ...prev, [postId]: type }));
      const updatePosts = (list: OOTDPost[]) => list.map(p => p.id === postId ? {
        ...p,
        like_count: type === "like" ? (p.like_count || 0) + 1 : p.like_count,
        dislike_count: type === "dislike" ? (p.dislike_count || 0) + 1 : p.dislike_count,
      } : p);
      setPosts(updatePosts);
      setMyPosts(updatePosts);
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

  // Edit post
  const handleEditPost = (post: OOTDPost) => {
    setEditingPost(post);
    setEditCaption(post.caption || "");
    setEditTopics((post.topics || []).join(", "));
    setSelectedPost(null);
  };

  const saveEditPost = async () => {
    if (!editingPost || !user) return;
    setSavingEdit(true);
    const parsedTopics = editTopics.split(/[,\s]+/).map(t => t.replace(/^#/, "").trim().toLowerCase()).filter(Boolean);
    const { error } = await supabase.from("ootd_posts").update({
      caption: editCaption.slice(0, MAX_MESSAGE) || null,
      topics: parsedTopics.length > 0 ? parsedTopics : null,
    }).eq("id", editingPost.id);
    if (!error) {
      toast.success("Post updated");
      setEditingPost(null);
      loadMyPosts();
      loadPosts();
    } else {
      toast.error("Failed to update");
    }
    setSavingEdit(false);
  };

  // Delete post
  const handleDeletePost = (postId: string) => {
    setDeleteConfirm(postId);
    setSelectedPost(null);
  };

  const confirmDelete = async () => {
    if (!deleteConfirm || !user) return;
    const { error } = await supabase.from("ootd_posts").delete().eq("id", deleteConfirm);
    if (!error) {
      toast.success("Post deleted");
      setMyPosts(prev => prev.filter(p => p.id !== deleteConfirm));
      setPosts(prev => prev.filter(p => p.id !== deleteConfirm));
    } else {
      toast.error("Failed to delete");
    }
    setDeleteConfirm(null);
  };

  const handlePosted = () => { loadPosts(); loadMyPosts(); loadTopics(); };
  const getProfile = (userId: string) => profileMap[userId] || null;

  const getFeaturedPosts = () => {
    if (posts.length < 4) return { featured: [], rest: posts };
    const scored = [...posts].sort((a, b) => {
      const scoreA = (a.like_count || 0) * 3 + (a.star_count || 0) * 5 - (a.dislike_count || 0) * 2;
      const scoreB = (b.like_count || 0) * 3 + (b.star_count || 0) * 5 - (b.dislike_count || 0) * 2;
      return scoreB - scoreA;
    });
    return { featured: scored.slice(0, 3), rest: scored.slice(3) };
  };

  const renderPostCard = (post: OOTDPost, index: number, showAuthor = true, isMyPage = false) => (
    <OOTDCard
      key={post.id}
      post={post}
      profile={getProfile(post.user_id)}
      index={index}
      showAuthor={showAuthor}
      isMyPage={isMyPage}
      onOpen={(p) => setSelectedPost(p as OOTDPost)}
      onEdit={isMyPage ? (p) => handleEditPost(p as OOTDPost) : undefined}
      onDelete={isMyPage ? handleDeletePost : undefined}
    />
  );

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

        {/* My Page profile header — owner-only quick edit + privacy */}
        {activeTab === "mypage" && user && (
          <MyPageProfileHeader
            postCount={myPosts.length}
            totalStars={myPosts.reduce((sum, p) => sum + (p.star_count || 0), 0)}
            refreshKey={storiesRefreshKey}
            hasStory={hasOwnStory}
            hasUnseenStory={hasOwnUnseen}
            onUploadStory={() => setStoryUploadOpen(true)}
            onViewMyStory={() => {
              const idx = allStoryUsers.findIndex((u) => u.user_id === user.id);
              if (idx >= 0) setViewerState({ open: true, index: idx, users: allStoryUsers });
            }}
          />
        )}

        {/* Stories row — Community shows everyone, My Page shows your circle */}
        {activeTab !== "crowned" && (
          <StoriesRow
            key={activeTab}
            refreshKey={storiesRefreshKey}
            circlesOnly={activeTab === "mypage"}
            onUploadClick={() => {
              if (!user) { navigate("/auth"); return; }
              setStoryUploadOpen(true);
            }}
            onOpenStories={(index, users) => setViewerState({ open: true, index, users })}
            onLoaded={setAllStoryUsers}
          />
        )}
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
                    <div className="grid grid-cols-3 gap-1.5 md:grid-cols-4">
                      {myPosts.map((post, i) => renderPostCard(post, i, false, true))}
                    </div>
                  )}
                </>
              )}
            </motion.div>
          ) : (
            <motion.div key="community" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
              {/* User Search */}
              <div className="space-y-2.5">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-foreground/40" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search @user or #hashtag"
                    className="w-full rounded-full border border-border/40 bg-card/50 pl-9 pr-9 py-2.5 text-[12px] text-foreground placeholder:text-foreground/35 outline-none focus:border-accent/40 transition-colors"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground/40 hover:text-foreground/70">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                {searchQuery.trim().length >= 2 && (
                  <div className="rounded-xl border border-border/30 bg-card/30 overflow-hidden">
                    {searchLoading ? (
                      <div className="py-4 flex items-center justify-center">
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-foreground/40" />
                      </div>
                    ) : searchUsers.length === 0 && searchTopics.length === 0 ? (
                      <div className="py-4 text-center text-[11px] text-foreground/40">No matches</div>
                    ) : (
                      <div className="divide-y divide-border/20">
                        {searchUsers.length > 0 && (
                          <div>
                            <div className="px-3 pt-2.5 pb-1 text-[9px] font-medium tracking-[0.2em] text-foreground/40">USERS</div>
                            <ul>
                              {searchUsers.map((u) => (
                                <li key={u.user_id}>
                                  <button
                                    onClick={() => navigate(`/u/${u.user_id}`)}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-accent/5 transition-colors text-left"
                                  >
                                    {u.avatar_url ? (
                                      <img src={u.avatar_url} alt={u.username || ""} className="h-8 w-8 rounded-full object-cover" />
                                    ) : (
                                      <div className="h-8 w-8 rounded-full bg-foreground/10 flex items-center justify-center text-[10px] font-medium text-foreground/60">
                                        {(u.username || u.display_name || "?").charAt(0).toUpperCase()}
                                      </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <div className="text-[12px] font-medium text-foreground truncate">@{u.username}</div>
                                      {u.display_name && (
                                        <div className="text-[10px] text-foreground/50 truncate">{u.display_name}</div>
                                      )}
                                    </div>
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {searchTopics.length > 0 && (
                          <div>
                            <div className="px-3 pt-2.5 pb-1 text-[9px] font-medium tracking-[0.2em] text-foreground/40">HASHTAGS</div>
                            <ul>
                              {searchTopics.map((t) => (
                                <li key={t.id}>
                                  <button
                                    onClick={() => { setActiveTopic(t.name); setSearchQuery(""); }}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-accent/5 transition-colors text-left"
                                  >
                                    <div className="h-8 w-8 rounded-full bg-accent/10 flex items-center justify-center text-[12px] font-medium text-accent/80">#</div>
                                    <div className="flex-1 min-w-0">
                                      <div className="text-[12px] font-medium text-foreground truncate">#{t.name}</div>
                                      <div className="text-[10px] text-foreground/50">{t.post_count} {t.post_count === 1 ? "post" : "posts"}</div>
                                    </div>
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

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

              {/* Social Feed */}
              {isLoading ? (
                <div className="grid grid-cols-3 gap-1.5 md:grid-cols-4">
                  {Array.from({ length: 9 }).map((_, i) => (
                    <div key={i} className="animate-pulse">
                      <div className="rounded-lg bg-foreground/[0.04] aspect-[3/4]" />
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
              ) : (() => {
                const { featured, rest } = getFeaturedPosts();
                return (
                  <div className="space-y-3">
                    {featured.length > 0 && (
                      <div>
                        <span className="text-[9px] font-medium tracking-[0.2em] text-foreground/40 mb-1.5 block">FEATURED</span>
                        <div className="grid grid-cols-3 gap-1.5">
                          {featured.map((post, i) => (
                            <div key={post.id} className="ring-1 ring-accent/10 rounded-lg overflow-hidden">
                              {renderPostCard(post, i, true)}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="grid grid-cols-3 gap-1.5 md:grid-cols-4">
                      {rest.map((post, i) => renderPostCard(post, i, true))}
                    </div>
                  </div>
                );
              })()}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Edit Post Modal */}
      <AnimatePresence>
        {editingPost && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setEditingPost(null)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl bg-card border border-border p-5 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground/80">Edit Post</h3>
                <button onClick={() => setEditingPost(null)} className="text-foreground/40 hover:text-foreground/60">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div>
                <label className="text-[10px] font-medium text-foreground/50">Message</label>
                <input
                  type="text"
                  value={editCaption}
                  onChange={e => setEditCaption(e.target.value.slice(0, MAX_MESSAGE))}
                  maxLength={MAX_MESSAGE}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-[12px] text-foreground outline-none focus:border-accent/30"
                />
                <span className="text-[9px] text-foreground/30">{editCaption.length}/{MAX_MESSAGE}</span>
              </div>
              <div>
                <label className="text-[10px] font-medium text-foreground/50">Hashtags (comma separated)</label>
                <input
                  type="text"
                  value={editTopics}
                  onChange={e => setEditTopics(e.target.value)}
                  placeholder="#minimal, #street"
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-[12px] text-foreground outline-none focus:border-accent/30"
                />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setEditingPost(null)} className="flex-1 rounded-lg border border-border py-2.5 text-[11px] font-medium text-foreground/60">Cancel</button>
                <button onClick={saveEditPost} disabled={savingEdit} className="flex-1 rounded-lg bg-foreground py-2.5 text-[11px] font-semibold text-background disabled:opacity-50 flex items-center justify-center gap-1.5">
                  {savingEdit ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                  Save
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirm Modal */}
      <AnimatePresence>
        {deleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setDeleteConfirm(null)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-xs rounded-2xl bg-card border border-border p-5 text-center space-y-4"
            >
              <Trash2 className="h-6 w-6 text-destructive/60 mx-auto" />
              <p className="text-[13px] text-foreground/70">Delete this post?</p>
              <p className="text-[10px] text-foreground/40">This will permanently remove it from your page, the feed, and rankings.</p>
              <div className="flex gap-2">
                <button onClick={() => setDeleteConfirm(null)} className="flex-1 rounded-lg border border-border py-2.5 text-[11px] font-medium text-foreground/60">Cancel</button>
                <button onClick={confirmDelete} className="flex-1 rounded-lg bg-destructive/80 py-2.5 text-[11px] font-semibold text-white">Delete</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
            onEdit={user?.id === selectedPost.user_id ? handleEditPost : undefined}
            onDelete={user?.id === selectedPost.user_id ? handleDeletePost : undefined}
          />
        )}
      </AnimatePresence>

      <OOTDUploadSheet open={uploadOpen} onClose={() => setUploadOpen(false)} onPosted={handlePosted} />

      <StoryUploadSheet
        open={storyUploadOpen}
        onClose={() => setStoryUploadOpen(false)}
        onPosted={() => setStoriesRefreshKey(k => k + 1)}
      />

      <StoryViewer
        open={viewerState.open}
        startUserIndex={viewerState.index}
        userStories={viewerState.users}
        onClose={() => setViewerState(s => ({ ...s, open: false }))}
        onDeleted={() => setStoriesRefreshKey(k => k + 1)}
      />
    </div>
  );
};

export default OOTDPage;
