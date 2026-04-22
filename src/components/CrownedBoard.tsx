import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Crown, Loader2, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface RankedPost {
  id: string;
  user_id: string;
  image_url: string;
  caption: string | null;
  style_tags: string[] | null;
  like_count: number;
  dislike_count: number;
  star_count: number;
  created_at: string;
  score: number;
}

interface ProfileInfo {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface DailyWinner {
  award_date: string;
  user_id: string;
  title: string;
  score: number;
  profile?: ProfileInfo;
}

const BOARD_LAYOUTS = [
  "col-span-12 row-span-2 md:col-span-7",
  "col-span-6 row-span-1 md:col-span-5",
  "col-span-6 row-span-1 md:col-span-5",
  "col-span-6 row-span-1 md:col-span-6",
  "col-span-6 row-span-1 md:col-span-6",
];

const RANK_STYLES = [
  {
    frame: "border-accent/25 bg-accent/[0.08]",
    badge: "bg-foreground text-background",
    points: "text-foreground",
  },
  {
    frame: "border-border/20 bg-card/60",
    badge: "bg-foreground/90 text-background",
    points: "text-foreground/80",
  },
  {
    frame: "border-border/15 bg-card/45",
    badge: "bg-foreground/75 text-background",
    points: "text-foreground/70",
  },
  {
    frame: "border-border/10 bg-card/30",
    badge: "bg-muted text-foreground/80",
    points: "text-foreground/60",
  },
  {
    frame: "border-border/10 bg-card/30",
    badge: "bg-muted text-foreground/80",
    points: "text-foreground/60",
  },
];

function getAgeHours(createdAt: string) {
  return (Date.now() - new Date(createdAt).getTime()) / 3600000;
}

function computeScore(post: {
  like_count: number;
  dislike_count: number;
  star_count: number;
  created_at: string;
}): number {
  const likes = post.like_count || 0;
  const dislikes = post.dislike_count || 0;
  const stars = post.star_count || 0;
  const ageHours = getAgeHours(post.created_at);
  const decay = Math.max(0.2, 1 - ageHours / 168);
  return (likes * 3 + stars * 5 - dislikes * 2) * decay;
}

function computeRisingScore(post: RankedPost): number {
  const freshnessBoost = Math.max(0, 72 - getAgeHours(post.created_at)) * 0.45;
  return post.score + freshnessBoost;
}

function formatPoints(score: number) {
  return Math.max(0, Math.round(score));
}

export default function CrownedBoard() {
  const navigate = useNavigate();
  const [topRanked, setTopRanked] = useState<RankedPost[]>([]);
  const [risingStars, setRisingStars] = useState<RankedPost[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileInfo>>({});
  const [dailyWinner, setDailyWinner] = useState<DailyWinner | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRankings();
    loadDailyWinner();
  }, []);

  const loadRankings = async () => {
    setLoading(true);

    const { data } = await supabase
      .from("ootd_posts")
      .select("id, user_id, image_url, caption, style_tags, like_count, dislike_count, star_count, created_at")
      .gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString())
      .order("created_at", { ascending: false })
      .limit(80);

    if (data) {
      const scored: RankedPost[] = data
        .map((post) => ({
          ...post,
          like_count: post.like_count || 0,
          dislike_count: post.dislike_count || 0,
          star_count: post.star_count || 0,
          score: computeScore(post as RankedPost),
        }))
        .sort((a, b) => b.score - a.score);

      const topFive = scored.slice(0, 5);
      const topIds = new Set(topFive.map((post) => post.id));

      // Rising = anything not already in top 5, sorted by freshness-boosted
      // score. Widen window to 7 days when nothing is fresh enough so the
      // section never collapses silently.
      const fresh = scored
        .filter((post) => !topIds.has(post.id) && getAgeHours(post.created_at) <= 72)
        .sort((a, b) => computeRisingScore(b) - computeRisingScore(a));

      const wider = scored
        .filter((post) => !topIds.has(post.id))
        .sort((a, b) => computeRisingScore(b) - computeRisingScore(a));

      const rising = (fresh.length >= 3 ? fresh : wider).slice(0, 6);

      setTopRanked(topFive);
      setRisingStars(rising);

      const userIds = [...new Set([...topFive, ...rising].map((post) => post.user_id))];
      if (userIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, display_name, avatar_url")
          .in("user_id", userIds);

        if (profs) {
          const profileMap: Record<string, ProfileInfo> = {};
          for (const profile of profs) profileMap[profile.user_id] = profile;
          setProfiles(profileMap);
        }
      }
    }

    setLoading(false);
  };

  const loadDailyWinner = async () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
    const { data } = await supabase
      .from("daily_winners")
      .select("*")
      .gte("award_date", yesterday)
      .order("award_date", { ascending: false })
      .limit(1);

    if (data && data.length > 0) {
      const winner = data[0] as DailyWinner;
      const { data: profile } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url")
        .eq("user_id", winner.user_id)
        .maybeSingle();

      setDailyWinner({ ...winner, profile: profile || undefined });
    }
  };

  const getProfile = (userId: string) => profiles[userId];

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-foreground/30" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2 text-center">
        <h2 className="font-display text-[28px] font-semibold tracking-[0.02em] text-foreground/95">
          Ranking
        </h2>
        <p className="text-[10px] uppercase tracking-[0.3em] text-foreground/40">This week&apos;s top looks</p>
      </div>

      {dailyWinner?.profile && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-accent/20 bg-accent/[0.06] p-4"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-foreground text-background">
              <Crown className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-semibold uppercase tracking-[0.24em] text-foreground/45">
                {dailyWinner.title}
              </p>
              <button
                onClick={() => navigate(`/user/${dailyWinner.user_id}`)}
                className="truncate text-left text-[14px] font-medium text-foreground/90 transition-colors hover:text-foreground"
              >
                {dailyWinner.profile.display_name || "Anonymous"}
              </button>
            </div>
            <span className="text-[10px] text-foreground/40">{dailyWinner.award_date}</span>
          </div>
        </motion.div>
      )}

      {topRanked.length === 0 ? (
        <div className="space-y-3 py-16 text-center">
          <TrendingUp className="mx-auto h-6 w-6 text-foreground/20" />
          <p className="text-[12px] text-foreground/40">No rankings yet this week</p>
          <p className="text-[10px] text-foreground/30">Post OOTDs and get likes to enter the rankings</p>
        </div>
      ) : (
        <div className="space-y-10">
          <section className="space-y-4">
            <div className="flex items-end justify-between border-b border-border/15 pb-2">
              <div>
                <h3 className="font-display text-[18px] font-semibold text-foreground/92">Top 5</h3>
                <p className="text-[10px] uppercase tracking-[0.24em] text-foreground/38">Crowned board</p>
              </div>
            </div>

            <div className="grid grid-cols-12 auto-rows-[148px] gap-3 md:auto-rows-[180px] md:gap-4">
              {topRanked.map((post, index) => {
                const profile = getProfile(post.user_id);
                const rank = index + 1;
                const rankStyle = RANK_STYLES[index] || RANK_STYLES[4];
                const isFirst = rank === 1;

                return (
                  <motion.article
                    key={post.id}
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={`${BOARD_LAYOUTS[index] || "col-span-6"} group relative overflow-hidden rounded-[1.25rem] border ${rankStyle.frame}`}
                  >
                    <img
                      src={post.image_url}
                      alt={post.caption || `${profile?.display_name || "Anonymous"} OOTD`}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-b from-background/10 via-background/0 to-background/90" />

                    <div className="absolute left-3 top-3 flex items-center gap-2">
                      <div className={`flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-[11px] font-semibold ${rankStyle.badge}`}>
                        {rank}
                      </div>
                      <button
                        onClick={() => navigate(`/user/${post.user_id}`)}
                        className="flex max-w-[65vw] items-center gap-2 rounded-full bg-background/72 px-2.5 py-1 backdrop-blur-sm transition-colors hover:bg-background/88"
                      >
                        <div className="h-5 w-5 overflow-hidden rounded-full bg-muted">
                          {profile?.avatar_url ? (
                            <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-[8px] font-bold text-foreground/45">
                              {(profile?.display_name || "?")[0].toUpperCase()}
                            </div>
                          )}
                        </div>
                        <span className="truncate text-[10px] font-medium text-foreground/88">
                          {profile?.display_name || "Anonymous"}
                        </span>
                      </button>
                    </div>

                    <div className="absolute right-3 top-3 rounded-full bg-background/72 px-2.5 py-1 text-right backdrop-blur-sm">
                      <p className={`text-[13px] font-semibold ${rankStyle.points}`}>{formatPoints(post.score)}</p>
                      <p className="text-[8px] uppercase tracking-[0.22em] text-foreground/38">PTS</p>
                    </div>

                    <div className="absolute inset-x-0 bottom-0 p-3 md:p-4">
                      {post.style_tags && post.style_tags.length > 0 && (
                        <div className="mb-2 flex flex-wrap gap-1.5">
                          {post.style_tags.slice(0, isFirst ? 3 : 2).map((tag) => (
                            <span
                              key={tag}
                              className="rounded-full border border-background/15 bg-background/70 px-2 py-1 text-[8px] uppercase tracking-[0.18em] text-foreground/62 backdrop-blur-sm"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}

                      {post.caption && (
                        <p className={`${isFirst ? "text-[13px] line-clamp-2" : "text-[11px] line-clamp-2"} max-w-[92%] text-foreground/86`}>
                          {post.caption}
                        </p>
                      )}
                    </div>
                  </motion.article>
                );
              })}
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-end justify-between border-b border-border/15 pb-2">
              <div>
                <h3 className="font-display text-[18px] font-semibold text-foreground/92">Rising Stars</h3>
                <p className="text-[10px] uppercase tracking-[0.24em] text-foreground/38">
                  New most-liked, likely next up
                </p>
              </div>
            </div>

            {risingStars.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border/25 px-4 py-6 text-center text-[11px] text-foreground/45">
                No rising stars yet — fresh posts with momentum will appear here.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {risingStars.map((post, index) => {
                  const profile = getProfile(post.user_id);

                  return (
                    <motion.article
                      key={post.id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.04 }}
                      className="flex items-center gap-3 rounded-2xl border border-border/12 bg-card/35 p-3"
                    >
                      <div className="relative h-16 w-12 shrink-0 overflow-hidden rounded-xl border border-border/10 bg-muted/40">
                        <img src={post.image_url} alt={post.caption || "Rising star OOTD"} className="h-full w-full object-cover" loading="lazy" />
                      </div>

                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex items-center justify-between gap-3">
                          <button
                            onClick={() => navigate(`/user/${post.user_id}`)}
                            className="truncate text-left text-[12px] font-medium text-foreground/84 transition-colors hover:text-foreground"
                          >
                            {profile?.display_name || "Anonymous"}
                          </button>
                          <div className="shrink-0 text-right">
                            <p className="text-[14px] font-semibold text-foreground/88">{formatPoints(post.score)}</p>
                            <p className="text-[8px] uppercase tracking-[0.22em] text-foreground/36">PTS</p>
                          </div>
                        </div>

                        {post.caption && (
                          <p className="line-clamp-2 text-[11px] leading-relaxed text-foreground/56">{post.caption}</p>
                        )}

                        <div className="flex items-center gap-2 text-[9px] uppercase tracking-[0.2em] text-foreground/34">
                          <span>{post.like_count} likes</span>
                          <span>•</span>
                          <span>{post.star_count} stars</span>
                        </div>
                      </div>
                    </motion.article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
