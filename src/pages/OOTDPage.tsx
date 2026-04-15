import { useState, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Star, Camera, Plus, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AuthGate } from "@/components/AuthGate";
import { motion, AnimatePresence } from "framer-motion";

interface OOTDPost {
  id: string;
  user_id: string;
  image_url: string;
  caption: string | null;
  style_tags: string[] | null;
  weather_tag: string | null;
  occasion_tags: string[] | null;
  star_count: number | null;
  created_at: string;
}

type Tab = "community" | "mypage";

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

  useEffect(() => {
    loadPosts();
    if (user) {
      loadMyPosts();
      loadTodayStars();
    }
  }, [user]);

  const loadPosts = async () => {
    setIsLoading(true);
    const { data } = await supabase
      .from("ootd_posts")
      .select("*")
      .order("star_count", { ascending: false })
      .limit(20);
    setPosts(data || []);
    setIsLoading(false);
  };

  const loadMyPosts = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("ootd_posts")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setMyPosts(data || []);
  };

  const loadTodayStars = async () => {
    if (!user) return;
    const today = new Date().toISOString().split("T")[0];
    const { data } = await supabase
      .from("ootd_stars")
      .select("id, post_id")
      .eq("user_id", user.id)
      .gte("created_at", today);
    const given = data || [];
    setStarsLeft(3 - given.length);
    setStarredPosts(new Set(given.map(s => s.post_id)));
  };

  const handleStar = async (postId: string) => {
    if (!user || starsLeft <= 0 || starredPosts.has(postId)) return;
    const { error } = await supabase.from("ootd_stars").insert({
      user_id: user.id,
      post_id: postId,
    });
    if (!error) {
      setStarsLeft(prev => prev - 1);
      setStarredPosts(prev => new Set(prev).add(postId));
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, star_count: (p.star_count || 0) + 1 } : p));
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-foreground/[0.04]">
        <div className="mx-auto max-w-lg px-6 pt-4 pb-0">
          <div className="flex items-center justify-between mb-3">
            <span className="font-display text-[13px] font-semibold tracking-[0.25em] text-foreground/40">WARDROBE</span>
            <div className="flex items-center gap-3">
              {user && (
                <div className="flex items-center gap-1 rounded-full bg-foreground/[0.04] px-2.5 py-1">
                  <Star className="h-3 w-3 fill-[hsl(var(--star))] text-[hsl(var(--star))]" />
                  <span className="text-[10px] font-semibold text-foreground/50">{starsLeft}</span>
                </div>
              )}
              <span className="text-[10px] font-semibold tracking-[0.2em] text-foreground/30">OOTD</span>
            </div>
          </div>

          {/* Tab switch */}
          <div className="flex">
            {(["mypage", "community"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="relative flex-1 pb-3 text-center"
              >
                <span className={`text-[10px] font-semibold tracking-[0.15em] transition-colors ${
                  activeTab === tab ? "text-foreground" : "text-foreground/25"
                }`}>
                  {tab === "mypage" ? "MY PAGE" : "COMMUNITY"}
                </span>
                {activeTab === tab && (
                  <motion.div
                    layoutId="ootd-tab"
                    className="absolute bottom-0 left-4 right-4 h-[2px] rounded-full bg-accent"
                  />
                )}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-lg px-6 pt-4">
        <AnimatePresence mode="wait">
          {activeTab === "mypage" ? (
            <motion.div
              key="mypage"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-6"
            >
              {!user ? (
                <div className="py-16 text-center space-y-4">
                  <Camera className="h-8 w-8 text-foreground/10 mx-auto" />
                  <p className="text-sm text-foreground/30">Sign in to create your style page</p>
                  <button
                    onClick={() => navigate("/auth")}
                    className="rounded-xl bg-foreground py-3 px-8 text-sm font-semibold text-background"
                  >
                    Sign In
                  </button>
                </div>
              ) : (
                <>
                  {/* Upload CTA */}
                  <button className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-foreground/10 bg-card/20 py-8 text-foreground/25 hover:border-accent/30 hover:text-accent/50 transition-colors">
                    <Plus className="h-5 w-5" />
                    <span className="text-xs font-semibold tracking-[0.1em]">POST YOUR OOTD</span>
                  </button>

                  {/* My posts */}
                  {myPosts.length === 0 ? (
                    <div className="py-12 text-center space-y-2">
                      <p className="text-xs text-foreground/25">No outfits posted yet</p>
                      <p className="text-[10px] text-foreground/15 max-w-xs mx-auto">
                        Upload your daily looks to build your style identity and improve recommendations.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {myPosts.map(post => (
                        <div key={post.id} className="group rounded-xl overflow-hidden">
                          <img src={post.image_url} alt={post.caption || "OOTD"} className="aspect-[3/4] w-full object-cover" />
                          <div className="py-2 flex items-center justify-between">
                            <p className="text-[11px] text-foreground/40">{post.caption}</p>
                            <div className="flex items-center gap-1">
                              <Star className="h-3 w-3 fill-[hsl(var(--star))] text-[hsl(var(--star))]" />
                              <span className="text-[10px] font-semibold text-foreground/50">{post.star_count || 0}</span>
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
            <motion.div
              key="community"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              {isLoading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="h-5 w-5 animate-spin text-foreground/20" />
                </div>
              ) : posts.length === 0 ? (
                <div className="py-16 text-center space-y-3">
                  <Camera className="h-8 w-8 text-foreground/10 mx-auto" />
                  <p className="text-sm text-foreground/30">Community feed is still growing</p>
                  <p className="text-xs text-foreground/15 max-w-xs mx-auto">
                    Be the first to post your outfit and start building the community.
                  </p>
                </div>
              ) : (
                <div className="space-y-6 pb-4">
                  {posts.map((post, index) => {
                    const isStarred = starredPosts.has(post.id);
                    return (
                      <div key={post.id} className="group">
                        <div className="relative overflow-hidden rounded-xl">
                          <img src={post.image_url} alt={post.caption || "OOTD"} className="aspect-[3/4] w-full object-cover" loading="lazy" />
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 to-transparent p-4 pt-20">
                            <div className="flex items-end justify-between">
                              <div>
                                {post.caption && (
                                  <p className="text-[11px] text-white/70">{post.caption}</p>
                                )}
                              </div>
                              <AuthGate action="give stars">
                                <button
                                  onClick={() => handleStar(post.id)}
                                  disabled={starsLeft <= 0 && !isStarred}
                                  className={`flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] font-semibold backdrop-blur-sm transition-all ${
                                    isStarred ? "bg-[hsl(var(--star)_/_0.9)] text-black" : "bg-white/15 text-white/80 hover:bg-white/25"
                                  }`}
                                >
                                  <Star className={`h-3 w-3 ${isStarred ? "fill-current" : ""}`} />
                                  {post.star_count || 0}
                                </button>
                              </AuthGate>
                            </div>
                          </div>
                          {index < 3 && (
                            <div className="absolute left-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-[hsl(var(--star))] text-[10px] font-bold text-black">
                              {index + 1}
                            </div>
                          )}
                        </div>
                        {post.style_tags && post.style_tags.length > 0 && (
                          <div className="mt-2 flex gap-1.5 flex-wrap">
                            {post.style_tags.map(tag => (
                              <span key={tag} className="text-[9px] text-foreground/25 bg-foreground/[0.03] px-2 py-0.5 rounded-full">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default OOTDPage;
