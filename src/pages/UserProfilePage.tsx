import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Loader2, ArrowLeft, Crown, UserPlus, UserCheck, ShieldOff, Lock, MessageCircle, Music } from "lucide-react";
import { motion } from "framer-motion";
import { AuthGate } from "@/components/AuthGate";
import { openConversationWith } from "@/hooks/useMessages";
import MessagesFullSheet from "@/components/messages/MessagesFullSheet";
import { toast } from "sonner";
import OOTDBackground, { type OOTDBgTheme } from "@/components/ootd/OOTDBackground";
import type { CardColor } from "@/components/ootd/CardColorPicker";
import { VisitorSongPlayer, type SongOfDay } from "@/components/ootd/SongOfTheDayPicker";
import OOTDPostDetail from "@/components/OOTDPostDetail";
import { OfficialBadge, OfficialAvatarRing } from "@/components/OfficialBadge";
import { claimStarAction } from "@/lib/starGrants";
import PublicCirclesSheet from "@/components/PublicCirclesSheet";

interface UserProfileData {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  hashtags: string[] | null;
  is_private: boolean | null;
  is_official: boolean | null;
  ootd_bg_theme: string | null;
  ootd_bg_realistic: boolean | null;
  ootd_card_color: CardColor | null;
  song_of_the_day: SongOfDay | null;
}

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

interface DailyWin {
  award_date: string;
  title: string;
}

interface UserProfilePageProps {
  userIdOverride?: string;
}

const UserProfilePage = ({ userIdOverride }: UserProfilePageProps = {}) => {
  const { userId: routeUserId } = useParams<{ userId: string }>();
  const userId = userIdOverride ?? routeUserId;
  const navigate = useNavigate();
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [posts, setPosts] = useState<OOTDPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [inCircle, setInCircle] = useState(false);
  const [circleCount, setCircleCount] = useState(0);
  const [rippleCount, setRippleCount] = useState(0);
  const [dailyWins, setDailyWins] = useState<DailyWin[]>([]);
  const [isBlocked, setIsBlocked] = useState(false);
  const [postCount, setPostCount] = useState(0);
  const [selectedPost, setSelectedPost] = useState<OOTDPost | null>(null);
  const [reactions, setReactions] = useState<Record<string, "like" | "dislike">>({});
  const [starredPosts, setStarredPosts] = useState<Set<string>>(new Set());
  const [savedPosts, setSavedPosts] = useState<Set<string>>(new Set());
  const [starsLeft, setStarsLeft] = useState(3);
  // Inline messages sheet — opens directly into the chat with this user.
  const [messageSheet, setMessageSheet] = useState<{ open: boolean; conversationId: string | null }>({
    open: false,
    conversationId: null,
  });
  const [circlesSheet, setCirclesSheet] = useState<{ open: boolean; tab: "circle" | "ripple" }>({ open: false, tab: "circle" });

  useEffect(() => {
    if (!userId) return;
    loadProfile();
    loadPosts();
    loadCircleInfo();
    loadDailyWins();
    loadBlockStatus();
  }, [userId]);

  // Viewer's own reactions/stars/saves so the detail sheet shows correct state
  useEffect(() => {
    if (!user) return;
    (async () => {
      const today = new Date().toISOString().split("T")[0];
      const [{ data: rxns }, { data: stars }, { data: saved }] = await Promise.all([
        supabase.from("ootd_reactions").select("post_id, reaction").eq("user_id", user.id),
        supabase.from("ootd_stars").select("post_id, created_at").eq("user_id", user.id).gte("created_at", today),
        supabase.from("saved_posts").select("post_id").eq("user_id", user.id),
      ]);
      const rmap: Record<string, "like" | "dislike"> = {};
      (rxns || []).forEach((r: any) => { rmap[r.post_id] = r.reaction; });
      setReactions(rmap);
      setStarredPosts(new Set((stars || []).map((s: any) => s.post_id)));
      setStarsLeft(Math.max(0, 3 - (stars?.length || 0)));
      setSavedPosts(new Set((saved || []).map((s: any) => s.post_id)));
    })();
  }, [user?.id]);

  const handleReaction = async (postId: string, type: "like" | "dislike") => {
    if (!user) return;
    const current = reactions[postId];
    const updateLocal = (deltaLike: number, deltaDislike: number) => {
      setPosts(prev => prev.map(p => p.id === postId ? {
        ...p,
        like_count: Math.max(0, (p.like_count || 0) + deltaLike),
        dislike_count: Math.max(0, (p.dislike_count || 0) + deltaDislike),
      } : p));
      setSelectedPost(prev => prev && prev.id === postId ? {
        ...prev,
        like_count: Math.max(0, (prev.like_count || 0) + deltaLike),
        dislike_count: Math.max(0, (prev.dislike_count || 0) + deltaDislike),
      } : prev);
    };
    if (current === type) {
      await supabase.from("ootd_reactions").delete().eq("post_id", postId).eq("user_id", user.id);
      setReactions(prev => { const n = { ...prev }; delete n[postId]; return n; });
      updateLocal(type === "like" ? -1 : 0, type === "dislike" ? -1 : 0);
    } else if (current) {
      await supabase.from("ootd_reactions").update({ reaction: type }).eq("post_id", postId).eq("user_id", user.id);
      setReactions(prev => ({ ...prev, [postId]: type }));
      updateLocal(type === "like" ? 1 : -1, type === "dislike" ? 1 : -1);
    } else {
      await supabase.from("ootd_reactions").insert({ post_id: postId, user_id: user.id, reaction: type });
      setReactions(prev => ({ ...prev, [postId]: type }));
      updateLocal(type === "like" ? 1 : 0, type === "dislike" ? 1 : 0);
    }
  };

  const handleStar = async (postId: string) => {
    if (!user || starsLeft <= 0 || starredPosts.has(postId)) return;
    const { error } = await supabase.from("ootd_stars").insert({ user_id: user.id, post_id: postId });
    if (!error) {
      setStarsLeft(prev => prev - 1);
      setStarredPosts(prev => new Set(prev).add(postId));
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, star_count: (p.star_count || 0) + 1 } : p));
      setSelectedPost(prev => prev && prev.id === postId ? { ...prev, star_count: (prev.star_count || 0) + 1 } : prev);
    }
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


  const loadProfile = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("user_id, display_name, avatar_url, bio, hashtags, is_private, is_official, ootd_bg_theme, ootd_bg_realistic, ootd_card_color, song_of_the_day")
      .eq("user_id", userId!)
      .maybeSingle();
    setProfile(data as unknown as UserProfileData | null);
  };

  const loadPosts = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("ootd_posts")
      .select("id, user_id, image_url, caption, style_tags, topics, star_count, like_count, dislike_count, created_at")
      .eq("user_id", userId!)
      .order("created_at", { ascending: false })
      .limit(30);
    const fetched = (data as OOTDPost[]) || [];
    setPosts(fetched);
    setPostCount(fetched.length);
    setLoading(false);
  };

  const loadCircleInfo = async () => {
    const [{ count: following }, { count: followers }] = await Promise.all([
      supabase.from("circles").select("id", { count: "exact", head: true }).eq("follower_id", userId!),
      supabase.from("circles").select("id", { count: "exact", head: true }).eq("following_id", userId!),
    ]);
    setCircleCount(following || 0);
    setRippleCount(followers || 0);

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

  const loadBlockStatus = async () => {
    if (!user || user.id === userId) return;
    const { data } = await supabase
      .from("blocked_users")
      .select("id")
      .eq("blocker_id", user.id)
      .eq("blocked_id", userId!)
      .maybeSingle();
    setIsBlocked(!!data);
  };

  const toggleCircle = async () => {
    if (!user || user.id === userId) return;
    if (inCircle) {
      await supabase.from("circles").delete().eq("follower_id", user.id).eq("following_id", userId!);
      setInCircle(false);
      setRippleCount(prev => Math.max(0, prev - 1));
    } else {
      await supabase.from("circles").insert({ follower_id: user.id, following_id: userId! });
      setInCircle(true);
      setRippleCount(prev => prev + 1);
      claimStarAction("join_circle");
    }
  };

  const toggleBlock = async () => {
    if (!user || user.id === userId) return;
    if (isBlocked) {
      await supabase.from("blocked_users").delete().eq("blocker_id", user.id).eq("blocked_id", userId!);
      setIsBlocked(false);
      toast.success("User unblocked");
    } else {
      await supabase.from("blocked_users").insert({ blocker_id: user.id, blocked_id: userId! });
      setIsBlocked(true);
      // Also remove from circle
      if (inCircle) {
        await supabase.from("circles").delete().eq("follower_id", user.id).eq("following_id", userId!);
        setInCircle(false);
        setRippleCount(prev => Math.max(0, prev - 1));
      }
      toast.success("User blocked");
    }
  };

  const isPrivate = profile?.is_private && user?.id !== userId && !inCircle;
  const styleTags = [...new Set(posts.flatMap(p => p.style_tags || []))].slice(0, 6);
  const hashtags = profile?.hashtags || [];

  // Their chosen vibe — visitors see exactly what the user picked on My Page.
  const visitorBgTheme = (profile?.ootd_bg_theme as OOTDBgTheme | undefined) ?? "none";
  const visitorBgRealistic = profile?.ootd_bg_realistic ?? true;
  const visitorCard = profile?.ootd_card_color ?? null;
  const visitorSong = profile?.song_of_the_day ?? null;
  const cardStyle = useMemo(() => {
    if (!visitorCard?.hex) return undefined;
    return { background: `${visitorCard.hex}D6` } as React.CSSProperties;
  }, [visitorCard]);

  return (
    <div className={`relative min-h-screen pb-28 lg:pb-16 lg:pt-24 ${visitorBgTheme !== "none" ? "" : "bg-background"}`}>
      {visitorBgTheme !== "none" && (
        <div className="pointer-events-none fixed inset-0 z-0">
          <OOTDBackground theme={visitorBgTheme} realistic={visitorBgRealistic} />
        </div>
      )}
      <div className="relative z-10 mx-auto max-w-lg px-6 pt-10 md:max-w-2xl md:px-10 lg:max-w-4xl lg:px-12">
        {/* Back button */}
        <button onClick={() => navigate(-1)} className="mb-6 flex items-center gap-2 text-foreground/50 hover:text-foreground/70 transition-colors">
          <ArrowLeft className="h-4 w-4" />
          <span className="text-[10px] font-medium tracking-[0.15em]">BACK</span>
        </button>

        {/* Profile header — wrapped in a card tinted with the owner's chosen card color */}
        {profile ? (
          <div
            className="flex items-start gap-4 mb-6 rounded-2xl border border-border/30 p-4 backdrop-blur-md"
            style={cardStyle ?? { background: "hsl(var(--card) / 0.5)" }}
          >
            <OfficialAvatarRing isOfficial={profile.is_official}>
              <div className="h-16 w-16 rounded-full bg-foreground/[0.06] overflow-hidden flex-shrink-0">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-foreground/20 text-lg font-bold">
                    {(profile.display_name || "?")[0].toUpperCase()}
                  </div>
                )}
              </div>
            </OfficialAvatarRing>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-display text-base font-semibold text-foreground/90 truncate max-w-full">
                  {profile.display_name || "Anonymous"}
                </h2>
                {profile.is_official && <OfficialBadge />}
                {dailyWins.length > 0 && <Crown className="h-4 w-4 text-yellow-400 fill-yellow-400 shrink-0" />}
                {profile.is_private && <Lock className="h-3 w-3 text-foreground/30 shrink-0" />}
              </div>
              {profile.bio && (
                <p className="text-[11px] text-foreground/50 mt-0.5 line-clamp-2 break-words">{profile.bio}</p>
              )}

              {/* Stats: Posts, Circle, Ripple */}
              <div className="flex items-center gap-x-4 gap-y-1 mt-2 flex-wrap">
                <span className="text-[10px] text-foreground/50 whitespace-nowrap">
                  <span className="font-semibold text-foreground/70">{postCount}</span> posts
                </span>
                <button
                  type="button"
                  onClick={() => setCirclesSheet({ open: true, tab: "circle" })}
                  className="text-[10px] text-foreground/50 whitespace-nowrap hover:text-foreground/80 transition-colors"
                >
                  <span className="font-semibold text-foreground/70">{circleCount}</span> circle
                </button>
                <button
                  type="button"
                  onClick={() => setCirclesSheet({ open: true, tab: "ripple" })}
                  className="text-[10px] text-foreground/50 whitespace-nowrap hover:text-foreground/80 transition-colors"
                >
                  <span className="font-semibold text-foreground/70">{rippleCount}</span> ripple
                </button>
              </div>

              {/* Actions — wrap so they never stretch the card at large font sizes */}
              {user && user.id !== userId && (
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  <AuthGate action="join circle">
                    <button
                      onClick={toggleCircle}
                      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold whitespace-nowrap transition-all ${
                        inCircle
                          ? "bg-accent/10 text-accent/70 border border-accent/20"
                          : "bg-foreground/[0.06] text-foreground/60 hover:bg-accent/10 hover:text-accent/70"
                      }`}
                    >
                      {inCircle ? <UserCheck className="h-3 w-3" /> : <UserPlus className="h-3 w-3" />}
                      {inCircle ? "IN CIRCLE" : "JOIN"}
                    </button>
                  </AuthGate>
                  <AuthGate action="message">
                    <button
                      onClick={async () => {
                        const cid = await openConversationWith(userId!);
                        if (cid) {
                          setMessageSheet({ open: true, conversationId: cid });
                        } else {
                          toast.error("Could not open chat");
                        }
                      }}
                      className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[10px] font-semibold text-primary-foreground whitespace-nowrap transition-opacity hover:opacity-90"
                    >
                      <MessageCircle className="h-3 w-3" />
                      MESSAGE
                    </button>
                  </AuthGate>
                  <button
                    onClick={toggleBlock}
                    className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium whitespace-nowrap transition-all ${
                      isBlocked ? "bg-destructive/10 text-destructive/60 border border-destructive/20" : "text-foreground/30 hover:text-foreground/50"
                    }`}
                  >
                    <ShieldOff className="h-3 w-3" />
                    {isBlocked ? "BLOCKED" : "BLOCK"}
                  </button>
                </div>
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

        {/* Song of the day — inline player so visitors can listen without leaving the page */}
        {visitorSong && (
          <VisitorSongPlayer song={visitorSong} cardStyle={cardStyle ?? undefined} />
        )}


        {/* Hashtags + daily wins + posts grid — wrapped so they read clearly
            against custom OOTD backgrounds (otherwise they blend into the
            visitor's themed background). */}
        <div
          className="rounded-2xl border border-border/30 p-4 backdrop-blur-md"
          style={cardStyle ?? { background: "hsl(var(--card) / 0.5)" }}
        >
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
                <span key={win.award_date} className="flex items-center gap-1 rounded-full bg-yellow-400/10 border border-yellow-400/20 px-2.5 py-1 text-[9px] font-semibold text-yellow-400/80">
                  <Crown className="h-2.5 w-2.5" />
                  {win.title} · {win.award_date}
                </span>
              ))}
            </div>
          )}

          {/* Private profile gate */}
          {isPrivate ? (
            <div className="py-20 text-center space-y-4">
              <Lock className="h-8 w-8 text-foreground/20 mx-auto" />
              <p className="text-[13px] text-foreground/50">This account is private</p>
              <p className="text-[10px] text-foreground/30">Join their circle to see posts</p>
            </div>
          ) : (
            <>
              {/* Style identity */}
              {styleTags.length > 0 && (
                <div className="mb-6">
                  <p className="text-[9px] font-semibold tracking-[0.2em] text-foreground/40 uppercase mb-2">Style Identity</p>
                  <div className="flex flex-wrap gap-1.5">
                    {styleTags.map(tag => (
                      <span key={tag} className="rounded-full bg-accent/10 px-2.5 py-1 text-[10px] font-medium text-accent/70">{tag}</span>
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
                <div className="grid grid-cols-3 gap-1.5 md:grid-cols-4">
                  {posts.map((post, i) => (
                    <motion.button
                      key={post.id}
                      type="button"
                      onClick={() => setSelectedPost(post)}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="group relative overflow-hidden rounded-lg aspect-[3/4] focus:outline-none focus:ring-2 focus:ring-accent/60"
                    >
                      <img
                        src={post.image_url}
                        alt={post.caption || ""}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                        loading="lazy"
                      />
                    </motion.button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Full OOTD detail sheet — likes, stars, comments, save, share */}
      {selectedPost && profile && (
        <OOTDPostDetail
          post={selectedPost}
          profile={{ display_name: profile.display_name, avatar_url: profile.avatar_url, is_official: profile.is_official }}
          reaction={reactions[selectedPost.id]}
          isStarred={starredPosts.has(selectedPost.id)}
          isSaved={savedPosts.has(selectedPost.id)}
          starsLeft={starsLeft}
          onClose={() => setSelectedPost(null)}
          onReaction={handleReaction}
          onStar={handleStar}
          onSave={handleSavePost}
          onTopicClick={(topic) => navigate(`/ootd?topic=${encodeURIComponent(topic)}`)}
        />
      )}

      {/* Direct-to-thread messages sheet — opens when MESSAGE is tapped */}
      <MessagesFullSheet
        open={messageSheet.open}
        onClose={() => setMessageSheet({ open: false, conversationId: null })}
        initialConversationId={messageSheet.conversationId}
        initialOtherUserId={userId || null}
      />

      {/* Public Circle / Ripple viewer */}
      {userId && (
        <PublicCirclesSheet
          open={circlesSheet.open}
          onClose={() => setCirclesSheet({ open: false, tab: circlesSheet.tab })}
          targetUserId={userId}
          targetDisplayName={profile?.display_name}
          initialTab={circlesSheet.tab}
        />
      )}
    </div>
  );
};

export default UserProfilePage;
