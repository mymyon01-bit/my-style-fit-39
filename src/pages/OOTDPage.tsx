import { useState, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Star, Camera, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AuthGate } from "@/components/AuthGate";
import { motion, AnimatePresence } from "framer-motion";
import OOTDUploadSheet from "@/components/OOTDUploadSheet";

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
  const [uploadOpen, setUploadOpen] = useState(false);

  useEffect(() => {
    loadPosts();
    if (user) { loadMyPosts(); loadTodayStars(); }
  }, [user]);

  const loadPosts = async () => {
    setIsLoading(true);
    const { data } = await supabase.from("ootd_posts").select("*").order("star_count", { ascending: false }).limit(20);
    setPosts(data || []);
    setIsLoading(false);
  };

  const loadMyPosts = async () => {
    if (!user) return;
    const { data } = await supabase.from("ootd_posts").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    setMyPosts(data || []);
  };

  const loadTodayStars = async () => {
    if (!user) return;
    const today = new Date().toISOString().split("T")[0];
    const { data } = await supabase.from("ootd_stars").select("id, post_id").eq("user_id", user.id).gte("created_at", today);
    const given = data || [];
    setStarsLeft(3 - given.length);
    setStarredPosts(new Set(given.map(s => s.post_id)));
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

  const handlePosted = () => { loadPosts(); loadMyPosts(); };

  return (
    <div className="min-h-screen bg-background pb-28 md:pb-28 lg:pb-16 lg:pt-24">
      {/* Header */}
      <div className="mx-auto max-w-lg px-8 pt-10 md:max-w-2xl md:px-10 md:pt-10 lg:max-w-4xl lg:px-12">
        <div className="flex items-baseline justify-between mb-8 md:mb-10 lg:mb-12">
          <span className="font-display text-[12px] font-medium tracking-[0.35em] text-foreground/30 md:text-[13px] lg:hidden">WARDROBE</span>
          <div className="flex items-center gap-4">
            {user && (
              <div className="flex items-center gap-1.5">
                <Star className="h-3.5 w-3.5 fill-[hsl(var(--star))] text-[hsl(var(--star))]" />
                <span className="text-[10px] font-medium text-foreground/35">{starsLeft}</span>
              </div>
            )}
            <span className="text-[10px] font-medium tracking-[0.25em] text-foreground/25 md:text-[11px]">OOTD</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex">
          {(["mypage", "community"] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className="relative flex-1 pb-5 text-center md:pb-6">
              <span className={`text-[10px] font-medium tracking-[0.2em] transition-colors duration-300 md:text-[11px] ${
                activeTab === tab ? "text-foreground/70" : "text-foreground/25"
              }`}>
                {tab === "mypage" ? "MY PAGE" : "COMMUNITY"}
              </span>
              {activeTab === tab && (
                <motion.div layoutId="ootd-tab" className="absolute bottom-0 left-1/4 right-1/4 h-px bg-accent/50" />
              )}
            </button>
          ))}
        </div>
        <div className="h-px bg-accent/[0.08]" />
      </div>

      <div className="mx-auto max-w-lg px-8 pt-10 md:max-w-2xl md:px-10 lg:max-w-4xl lg:px-12 lg:pt-12">
        <AnimatePresence mode="wait">
          {activeTab === "mypage" ? (
            <motion.div key="mypage" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-8">
              {!user ? (
                <div className="py-20 text-center space-y-5 md:py-24 lg:py-28">
                  <Camera className="h-6 w-6 text-foreground/12 mx-auto" />
                  <p className="text-[14px] text-foreground/40">Sign in to create your style page</p>
                  <button onClick={() => navigate("/auth")} className="text-[10px] font-medium tracking-[0.2em] text-accent/60 hover:text-accent">SIGN IN</button>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => setUploadOpen(true)}
                    className="flex w-full items-center justify-center gap-3 py-14 text-foreground/18 hover:text-accent/40 transition-colors md:py-16"
                  >
                    <Camera className="h-5 w-5" />
                    <span className="text-[10px] font-medium tracking-[0.2em] md:text-[11px]">POST YOUR OOTD</span>
                  </button>
                  <div className="h-px bg-accent/[0.08]" />

                  {myPosts.length === 0 ? (
                    <div className="py-16 text-center space-y-3 md:py-20">
                      <p className="text-[13px] text-foreground/30">No outfits posted yet</p>
                      <p className="text-[11px] text-foreground/18 max-w-[220px] mx-auto leading-relaxed">
                        Upload daily looks to build your style identity.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:gap-5">
                      {myPosts.map(post => (
                        <div key={post.id} className="group">
                          <img src={post.image_url} alt={post.caption || ""} className="aspect-[3/4] w-full object-cover" />
                          <div className="pt-3 flex items-center justify-between">
                            <p className="text-[11px] text-foreground/35 truncate flex-1 md:text-[12px]">{post.caption || ""}</p>
                            <div className="flex items-center gap-0.5">
                              <Star className="h-2.5 w-2.5 fill-[hsl(var(--star))] text-[hsl(var(--star))]" />
                              <span className="text-[10px] text-foreground/30">{post.star_count || 0}</span>
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
            <motion.div key="community" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-8">
              {isLoading ? (
                <div className="flex items-center justify-center py-24">
                  <Loader2 className="h-4 w-4 animate-spin text-foreground/15" />
                </div>
              ) : posts.length === 0 ? (
                <div className="py-20 text-center space-y-4 md:py-24 lg:py-28">
                  <Camera className="h-6 w-6 text-foreground/12 mx-auto" />
                  <p className="text-[14px] text-foreground/35">Community feed is growing</p>
                  {user && (
                    <button onClick={() => { setActiveTab("mypage"); setUploadOpen(true); }} className="text-[10px] font-medium tracking-[0.2em] text-foreground/25 hover:text-foreground/40">
                      POST FIRST
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-10 md:grid md:grid-cols-2 md:gap-6 md:space-y-0 lg:gap-8">
                  {posts.map((post, index) => {
                    const isStarred = starredPosts.has(post.id);
                    return (
                      <motion.div
                        key={post.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <div className="relative overflow-hidden">
                          <img src={post.image_url} alt={post.caption || ""} className="aspect-[3/4] w-full object-cover" loading="lazy" />
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/40 to-transparent p-5 pt-24">
                            <div className="flex items-end justify-between">
                              <p className="text-[12px] text-white/75 max-w-[70%]">{post.caption || ""}</p>
                              <AuthGate action="give stars">
                                <button
                                  onClick={() => handleStar(post.id)}
                                  disabled={starsLeft <= 0 && !isStarred}
                                  className={`flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium backdrop-blur-sm transition-all ${
                                    isStarred ? "text-[hsl(var(--star))]" : "text-white/60 hover:text-white/80"
                                  }`}
                                >
                                  <Star className={`h-3.5 w-3.5 ${isStarred ? "fill-current" : ""}`} />
                                  {post.star_count || 0}
                                </button>
                              </AuthGate>
                            </div>
                          </div>
                          {index < 3 && (
                            <span className="absolute left-4 top-4 text-[11px] font-medium text-white/40">{index + 1}</span>
                          )}
                        </div>
                        {post.style_tags && post.style_tags.length > 0 && (
                          <div className="mt-3 flex gap-2.5 flex-wrap">
                            {post.style_tags.map(tag => (
                              <span key={tag} className="text-[10px] text-foreground/25">{tag}</span>
                            ))}
                          </div>
                        )}
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
