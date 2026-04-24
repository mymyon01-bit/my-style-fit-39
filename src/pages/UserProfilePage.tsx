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
import type { SongOfDay } from "@/components/ootd/SongOfTheDayPicker";
import OOTDPostDetail from "@/components/OOTDPostDetail";

interface UserProfileData {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  hashtags: string[] | null;
  is_private: boolean | null;
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

const UserProfilePage = () => {
  const { userId } = useParams<{ userId: string }>();
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

  useEffect(() => {
    if (!userId) return;
    loadProfile();
    loadPosts();
    loadCircleInfo();
    loadDailyWins();
    loadBlockStatus();
  }, [userId]);

  const loadProfile = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("user_id, display_name, avatar_url, bio, hashtags, is_private, ootd_bg_theme, ootd_bg_realistic, ootd_card_color, song_of_the_day")
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
                {dailyWins.length > 0 && <Crown className="h-4 w-4 text-yellow-400 fill-yellow-400" />}
                {profile.is_private && <Lock className="h-3 w-3 text-foreground/30" />}
              </div>
              {profile.bio && (
                <p className="text-[11px] text-foreground/50 mt-0.5 line-clamp-2">{profile.bio}</p>
              )}

              {/* Stats: Posts, Circle, Ripple */}
              <div className="flex items-center gap-4 mt-2">
                <span className="text-[10px] text-foreground/50">
                  <span className="font-semibold text-foreground/70">{postCount}</span> posts
                </span>
                <span className="text-[10px] text-foreground/50">
                  <span className="font-semibold text-foreground/70">{circleCount}</span> circle
                </span>
                <span className="text-[10px] text-foreground/50">
                  <span className="font-semibold text-foreground/70">{rippleCount}</span> ripple
                </span>
              </div>

              {/* Actions */}
              {user && user.id !== userId && (
                <div className="flex items-center gap-2 mt-2">
                  <AuthGate action="join circle">
                    <button
                      onClick={toggleCircle}
                      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-semibold transition-all ${
                        inCircle
                          ? "bg-accent/10 text-accent/70 border border-accent/20"
                          : "bg-foreground/[0.06] text-foreground/60 hover:bg-accent/10 hover:text-accent/70"
                      }`}
                    >
                      {inCircle ? <UserCheck className="h-3 w-3" /> : <UserPlus className="h-3 w-3" />}
                      {inCircle ? "IN CIRCLE" : "JOIN CIRCLE"}
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
                      className="flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-[10px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                    >
                      <MessageCircle className="h-3 w-3" />
                      MESSAGE
                    </button>
                  </AuthGate>
                  <button
                    onClick={toggleBlock}
                    className={`flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[10px] font-medium transition-all ${
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

        {/* Song of the day — the song the profile owner picked */}
        {visitorSong && (
          <a
            href={visitorSong.spotifyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mb-4 flex items-center gap-3 rounded-xl border border-border/30 p-2.5 backdrop-blur-md hover:border-accent/40 transition-colors"
            style={cardStyle ?? { background: "hsl(var(--card) / 0.5)" }}
          >
            <img src={visitorSong.artwork} alt="" className="h-10 w-10 rounded-md object-cover shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 text-[9px] font-semibold tracking-[0.2em] text-accent/80 uppercase">
                <Music className="h-2.5 w-2.5" /> Song of the day
              </div>
              <p className="text-[12px] font-medium text-foreground/90 truncate">{visitorSong.title}</p>
              <p className="text-[10px] text-foreground/55 truncate">{visitorSong.artist}</p>
            </div>
          </a>
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
                    onClick={() => setLightboxIdx(i)}
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

      {/* Lightbox — view photos full-size with prev/next */}
      {lightboxIdx !== null && posts[lightboxIdx] && (
        <div
          className="fixed inset-0 z-[120] bg-black/95 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setLightboxIdx(null)}
        >
          <button
            onClick={(e) => { e.stopPropagation(); setLightboxIdx(null); }}
            className="absolute top-4 right-4 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
            aria-label="Close"
          >
            <ArrowLeft className="h-5 w-5 rotate-45" />
          </button>
          {lightboxIdx > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); setLightboxIdx(lightboxIdx - 1); }}
              className="absolute left-3 md:left-8 h-11 w-11 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
              aria-label="Previous"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          {lightboxIdx < posts.length - 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); setLightboxIdx(lightboxIdx + 1); }}
              className="absolute right-3 md:right-8 h-11 w-11 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
              aria-label="Next"
            >
              <ArrowLeft className="h-5 w-5 rotate-180" />
            </button>
          )}
          <motion.img
            key={posts[lightboxIdx].id}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            src={posts[lightboxIdx].image_url}
            alt={posts[lightboxIdx].caption || ""}
            className="max-h-[88vh] max-w-[92vw] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          {posts[lightboxIdx].caption && (
            <div className="absolute bottom-6 inset-x-6 text-center">
              <p className="inline-block bg-black/50 backdrop-blur-md text-white text-[13px] px-4 py-2 rounded-full max-w-[90vw] truncate">
                {posts[lightboxIdx].caption}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Direct-to-thread messages sheet — opens when MESSAGE is tapped */}
      <MessagesFullSheet
        open={messageSheet.open}
        onClose={() => setMessageSheet({ open: false, conversationId: null })}
        initialConversationId={messageSheet.conversationId}
        initialOtherUserId={userId || null}
      />
    </div>
  );
};

export default UserProfilePage;
