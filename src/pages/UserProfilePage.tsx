import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Loader2, ArrowLeft, Crown, UserPlus, UserCheck } from "lucide-react";
import { motion } from "framer-motion";
import { AuthGate } from "@/components/AuthGate";

interface UserProfileData {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  hashtags: string[] | null;
}

interface OOTDPost {
  id: string;
  image_url: string;
  caption: string | null;
  style_tags: string[] | null;
  star_count: number | null;
  like_count: number | null;
  created_at: string;
}

interface DailyWin {
  award_date: string;
  title: string;
}

const UserProfilePage = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [posts, setPosts] = useState<OOTDPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [inCircle, setInCircle] = useState(false);
  const [circleCount, setCircleCount] = useState(0);
  const [addedByCount, setAddedByCount] = useState(0);
  const [dailyWins, setDailyWins] = useState<DailyWin[]>([]);

  useEffect(() => {
    if (!userId) return;
    loadProfile();
    loadPosts();
    loadCircleInfo();
    loadDailyWins();
  }, [userId]);

  const loadProfile = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("user_id, display_name, avatar_url, bio, hashtags")
      .eq("user_id", userId!)
      .maybeSingle();
    setProfile(data as UserProfileData | null);
  };

  const loadPosts = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("ootd_posts")
      .select("id, image_url, caption, style_tags, star_count, like_count, created_at")
      .eq("user_id", userId!)
      .order("created_at", { ascending: false })
      .limit(30);
    setPosts((data as OOTDPost[]) || []);
    setLoading(false);
  };

  const loadCircleInfo = async () => {
    // How many people this user follows
    const { count: following } = await supabase
      .from("circles")
      .select("id", { count: "exact", head: true })
      .eq("follower_id", userId!);
    setCircleCount(following || 0);

    // How many follow this user
    const { count: followers } = await supabase
      .from("circles")
      .select("id", { count: "exact", head: true })
      .eq("following_id", userId!);
    setAddedByCount(followers || 0);

    // Check if current user is in circle
    if (user && user.id !== userId) {
      const { data } = await supabase
        .from("circles")
        .select("id")
        .eq("follower_id", user.id)
        .eq("following_id", userId!)
        .maybeSingle();
      setInCircle(!!data);
    }
  };

  const loadDailyWins = async () => {
    const { data } = await supabase
      .from("daily_winners")
      .select("award_date, title")
      .eq("user_id", userId!)
      .order("award_date", { ascending: false })
      .limit(5);
    setDailyWins((data as DailyWin[]) || []);
  };

  const toggleCircle = async () => {
    if (!user || user.id === userId) return;
    if (inCircle) {
      await supabase.from("circles").delete().eq("follower_id", user.id).eq("following_id", userId!);
      setInCircle(false);
      setAddedByCount(prev => Math.max(0, prev - 1));
    } else {
      await supabase.from("circles").insert({ follower_id: user.id, following_id: userId! });
      setInCircle(true);
      setAddedByCount(prev => prev + 1);
    }
  };

  const styleTags = [...new Set(posts.flatMap(p => p.style_tags || []))].slice(0, 6);
  const hashtags = profile?.hashtags || [];

  return (
    <div className="min-h-screen bg-background pb-28 lg:pb-16 lg:pt-24">
      <div className="mx-auto max-w-lg px-6 pt-10 md:max-w-2xl md:px-10 lg:max-w-4xl lg:px-12">
        {/* Back button */}
        <button onClick={() => navigate(-1)} className="mb-6 flex items-center gap-2 text-foreground/50 hover:text-foreground/70 transition-colors">
          <ArrowLeft className="h-4 w-4" />
          <span className="text-[10px] font-medium tracking-[0.15em]">BACK</span>
        </button>

        {/* Profile header */}
        {profile ? (
          <div className="flex items-start gap-4 mb-6">
            <div className="h-16 w-16 rounded-full bg-foreground/[0.06] overflow-hidden flex-shrink-0">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full flex items-center justify-center text-foreground/20 text-lg font-bold">
                  {(profile.display_name || "?")[0].toUpperCase()}
                </div>
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h2 className="font-display text-base font-semibold text-foreground/90">
                  {profile.display_name || "Anonymous"}
                </h2>
                {dailyWins.length > 0 && (
                  <Crown className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                )}
              </div>
              {profile.bio && (
                <p className="text-[11px] text-foreground/50 mt-0.5 line-clamp-2">{profile.bio}</p>
              )}

              {/* Circle stats */}
              <div className="flex items-center gap-4 mt-2">
                <span className="text-[10px] text-foreground/50">
                  <span className="font-semibold text-foreground/70">{circleCount}</span> in circle
                </span>
                <span className="text-[10px] text-foreground/50">
                  <span className="font-semibold text-foreground/70">{addedByCount}</span> added by
                </span>
                <span className="text-[10px] text-foreground/40">{posts.length} posts</span>
              </div>

              {/* Circle button */}
              {user && user.id !== userId && (
                <AuthGate action="join circle">
                  <button
                    onClick={toggleCircle}
                    className={`mt-2 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-semibold transition-all ${
                      inCircle
                        ? "bg-accent/10 text-accent/70 border border-accent/20"
                        : "bg-foreground/[0.06] text-foreground/60 hover:bg-accent/10 hover:text-accent/70"
                    }`}
                  >
                    {inCircle ? <UserCheck className="h-3 w-3" /> : <UserPlus className="h-3 w-3" />}
                    {inCircle ? "IN CIRCLE" : "ADD TO CIRCLE"}
                  </button>
                </AuthGate>
              )}
            </div>
          </div>
        ) : (
          <div className="mb-8 animate-pulse flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-foreground/[0.04]" />
            <div className="space-y-2">
              <div className="h-4 w-24 rounded bg-foreground/[0.04]" />
              <div className="h-3 w-16 rounded bg-foreground/[0.04]" />
            </div>
          </div>
        )}

        {/* Hashtags */}
        {hashtags.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-1.5">
            {hashtags.map(tag => (
              <span key={tag} className="text-[10px] text-accent/60">#{tag}</span>
            ))}
          </div>
        )}

        {/* Daily wins */}
        {dailyWins.length > 0 && (
          <div className="mb-6 flex items-center gap-2 flex-wrap">
            {dailyWins.map(win => (
              <span
                key={win.award_date}
                className="flex items-center gap-1 rounded-full bg-yellow-400/10 border border-yellow-400/20 px-2.5 py-1 text-[9px] font-semibold text-yellow-400/80"
              >
                <Crown className="h-2.5 w-2.5" />
                {win.title} · {win.award_date}
              </span>
            ))}
          </div>
        )}

        {/* Style identity */}
        {styleTags.length > 0 && (
          <div className="mb-6">
            <p className="text-[9px] font-semibold tracking-[0.2em] text-foreground/40 uppercase mb-2">Style Identity</p>
            <div className="flex flex-wrap gap-1.5">
              {styleTags.map(tag => (
                <span key={tag} className="rounded-full bg-accent/10 px-2.5 py-1 text-[10px] font-medium text-accent/70">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="h-px bg-border/20 mb-6" />

        {/* Posts grid */}
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-4 w-4 animate-spin text-foreground/30" />
          </div>
        ) : posts.length === 0 ? (
          <p className="text-center text-[12px] text-foreground/40 py-16">No outfits posted yet</p>
        ) : (
          <div className="columns-2 gap-3 md:columns-3">
            {posts.map((post, i) => (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="mb-3 break-inside-avoid"
              >
                <div className="overflow-hidden rounded-xl">
                  <img src={post.image_url} alt={post.caption || ""} className="w-full object-cover" loading="lazy" />
                </div>
                {post.caption && (
                  <p className="mt-1.5 text-[10px] text-foreground/50 line-clamp-2 px-0.5">{post.caption}</p>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default UserProfilePage;
