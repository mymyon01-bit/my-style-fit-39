import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Crown, Loader2, TrendingUp, Sparkles, ChevronRight, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import ContactUsDialog from "@/components/ContactUsDialog";

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

interface AdProduct {
  id: string;
  name: string;
  brand: string | null;
  image_url: string | null;
  source_url: string | null;
}

interface CrownedBoardProps {
  /** When provided, clicking a ranking card opens this post in detail. */
  onPostClick?: (post: RankedPost) => void;
  /** Optional style preferences used to personalize the AI AD strip. */
  styleHints?: string[];
}

const RANK_BADGE = [
  "bg-foreground text-background",
  "bg-foreground/90 text-background",
  "bg-foreground/75 text-background",
  "bg-muted text-foreground/80",
  "bg-muted text-foreground/80",
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

export default function CrownedBoard({ onPostClick, styleHints }: CrownedBoardProps = {}) {
  const navigate = useNavigate();
  const [topRanked, setTopRanked] = useState<RankedPost[]>([]);
  const [risingStars, setRisingStars] = useState<RankedPost[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileInfo>>({});
  const [dailyWinner, setDailyWinner] = useState<DailyWinner | null>(null);
  const [ads, setAds] = useState<AdProduct[]>([]);
  const [contactOpen, setContactOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRankings();
    loadDailyWinner();
  }, []);

  // AI AD strip — personalized when style hints are present.
  useEffect(() => {
    (async () => {
      const tags = (styleHints || []).filter(Boolean).slice(0, 3);
      let q = supabase
        .from("product_cache")
        .select("id, name, brand, image_url, source_url")
        .not("image_url", "is", null)
        .order("trend_score", { ascending: false })
        .limit(8);
      if (tags.length > 0) q = q.overlaps("style_tags", tags);
      const { data } = await q;
      setAds(((data || []) as AdProduct[]).slice(0, 6));
    })();
  }, [styleHints?.join(",")]);

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

  const handleCardClick = (post: RankedPost) => {
    if (onPostClick) onPostClick(post);
    else navigate(`/ootd?post=${post.id}`);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-foreground/30" />
      </div>
    );
  }

  // Split top 5 → hero (#1) + others (#2-5)
  const hero = topRanked[0];
  const others = topRanked.slice(1, 5);

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
          {/* TOP 5 — Layout:  hero #1 (left, tall) + 2x2 grid (right) */}
          <section className="space-y-4">
            <div className="flex items-end justify-between border-b border-border/15 pb-2">
              <div>
                <h3 className="font-display text-[18px] font-semibold text-foreground/92">Top 5</h3>
                <p className="text-[10px] uppercase tracking-[0.24em] text-foreground/38">Crowned board</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Hero — #1 */}
              {hero && (
                <motion.button
                  type="button"
                  onClick={() => handleCardClick(hero)}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="group relative aspect-[3/4] overflow-hidden rounded-[1.25rem] border border-accent/40 bg-accent/[0.08] text-left"
                >
                  <img
                    src={hero.image_url}
                    alt={hero.caption || `${getProfile(hero.user_id)?.display_name || "Anonymous"} OOTD`}
                    className="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.02]"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-b from-background/10 via-background/0 to-background/85" />

                  <div className="absolute left-2 top-2 flex items-center gap-2">
                    <div className="flex h-8 min-w-8 items-center justify-center rounded-full bg-foreground px-1.5 text-[12px] font-semibold text-background">
                      1
                    </div>
                    <span
                      onClick={(e) => { e.stopPropagation(); navigate(`/user/${hero.user_id}`); }}
                      className="flex max-w-[55%] items-center gap-2 rounded-full bg-background/72 px-2.5 py-1 backdrop-blur-sm transition-colors hover:bg-background/88 cursor-pointer"
                    >
                      <span className="h-5 w-5 overflow-hidden rounded-full bg-muted">
                        {getProfile(hero.user_id)?.avatar_url ? (
                          <img src={getProfile(hero.user_id)?.avatar_url || ""} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center text-[8px] font-bold text-foreground/45">
                            {(getProfile(hero.user_id)?.display_name || "?")[0].toUpperCase()}
                          </span>
                        )}
                      </span>
                      <span className="truncate text-[10px] font-medium text-foreground/88">
                        {getProfile(hero.user_id)?.display_name || "Anonymous"}
                      </span>
                    </span>
                  </div>

                  <div className="absolute right-3 top-3 rounded-full bg-background/72 px-2.5 py-1 text-right backdrop-blur-sm">
                    <p className="text-[13px] font-semibold text-foreground">{formatPoints(hero.score)}</p>
                    <p className="text-[8px] uppercase tracking-[0.22em] text-foreground/38">PTS</p>
                  </div>

                  <div className="absolute inset-x-0 bottom-0 p-3">
                    {hero.style_tags && hero.style_tags.length > 0 && (
                      <div className="mb-2 flex flex-wrap gap-1.5">
                        {hero.style_tags.slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full border border-background/15 bg-background/70 px-2 py-1 text-[8px] uppercase tracking-[0.18em] text-foreground/62 backdrop-blur-sm"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    {hero.caption && (
                      <p className="text-[12px] line-clamp-2 max-w-[92%] text-foreground/86">{hero.caption}</p>
                    )}
                  </div>
                </motion.button>
              )}

              {/* 2x2 grid — ranks 2..5 */}
              <div className="grid grid-cols-2 grid-rows-2 gap-3">
                {others.map((post, idx) => {
                  const rank = idx + 2;
                  const profile = getProfile(post.user_id);
                  return (
                    <motion.button
                      key={post.id}
                      type="button"
                      onClick={() => handleCardClick(post)}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="group relative aspect-square overflow-hidden rounded-xl border border-border/15 bg-card/45 text-left"
                    >
                      <img
                        src={post.image_url}
                        alt={post.caption || `${profile?.display_name || "Anonymous"} OOTD`}
                        className="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.03]"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-b from-background/10 via-background/0 to-background/85" />

                      <div className="absolute left-1.5 top-1.5">
                        <div className={`flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold ${RANK_BADGE[idx + 1]}`}>
                          {rank}
                        </div>
                      </div>

                      <div className="absolute right-1.5 top-1.5 rounded-full bg-background/72 px-1.5 py-0.5 text-right backdrop-blur-sm">
                        <p className="text-[10px] font-semibold text-foreground/80">{formatPoints(post.score)}</p>
                      </div>

                      <div className="absolute inset-x-0 bottom-0 px-2 pb-1.5 pt-6 bg-gradient-to-t from-background/90 to-transparent">
                        <span
                          onClick={(e) => { e.stopPropagation(); navigate(`/user/${post.user_id}`); }}
                          className="flex w-full items-center gap-1.5 text-left cursor-pointer"
                        >
                          <span className="h-4 w-4 overflow-hidden rounded-full bg-muted shrink-0">
                            {profile?.avatar_url ? (
                              <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <span className="flex h-full w-full items-center justify-center text-[7px] font-bold text-foreground/45">
                                {(profile?.display_name || "?")[0].toUpperCase()}
                              </span>
                            )}
                          </span>
                          <span className="truncate text-[9px] font-medium text-foreground/85">
                            {profile?.display_name || "Anonymous"}
                          </span>
                        </span>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* AI AD — between Top 5 and Rising Stars (always shown so users can ADD YOUR AD) */}
          <section className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-3 w-3 text-accent/70" />
                <span className="text-[9px] font-semibold tracking-[0.22em] text-foreground/55">FOR YOU</span>
                <span className="rounded-full bg-accent/15 px-1.5 py-px text-[8px] font-bold tracking-[0.15em] text-accent">
                  AI AD
                </span>
              </div>
            </div>
            <div className="grid grid-cols-6 gap-2">
              {ads.slice(0, 5).map((p) => (
                <a
                  key={p.id}
                  href={p.source_url || "#"}
                  target={p.source_url ? "_blank" : undefined}
                  rel="noopener noreferrer"
                  className="flex flex-col gap-1"
                >
                  <div className="aspect-[3/4] w-full overflow-hidden rounded-lg bg-foreground/[0.04]">
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" loading="lazy" />
                    ) : null}
                  </div>
                  <p className="line-clamp-1 text-[9px] text-foreground/60">{p.brand || p.name}</p>
                </a>
              ))}
              {Array.from({ length: Math.max(0, 5 - ads.slice(0, 5).length) }).map((_, i) => (
                <div key={`spacer-${i}`} className="aspect-[3/4] rounded-lg bg-foreground/[0.02]" />
              ))}
              <button
                onClick={() => setContactOpen(true)}
                className="group flex flex-col gap-1 text-left"
                aria-label="Add your ad — contact us"
              >
                <div className="flex aspect-[3/4] w-full items-center justify-center rounded-lg border border-dashed border-accent/40 bg-accent/[0.04] transition-all group-hover:bg-accent/[0.1] group-hover:border-accent/60">
                  <Plus className="h-4 w-4 text-accent/70 transition-transform group-hover:scale-110" />
                </div>
                <p className="line-clamp-1 text-[9px] font-semibold tracking-[0.14em] text-accent/75">
                  ADD YOUR AD
                </p>
              </button>
            </div>
          </section>

          {/* RISING STARS */}
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
                    <motion.button
                      key={post.id}
                      type="button"
                      onClick={() => handleCardClick(post)}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.04 }}
                      className="flex items-center gap-3 rounded-2xl border border-border/12 bg-card/35 p-3 text-left transition-colors hover:border-border/30"
                    >
                      <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-border/10 bg-muted/40">
                        <img src={post.image_url} alt={post.caption || "Rising star OOTD"} className="h-full w-full object-cover object-top" loading="lazy" />
                      </span>

                      <span className="min-w-0 flex-1 space-y-1.5">
                        <span className="flex items-center justify-between gap-3">
                          <span
                            onClick={(e) => { e.stopPropagation(); navigate(`/user/${post.user_id}`); }}
                            className="truncate text-left text-[12px] font-medium text-foreground/84 transition-colors hover:text-foreground cursor-pointer"
                          >
                            {profile?.display_name || "Anonymous"}
                          </span>
                          <span className="shrink-0 text-right">
                            <span className="block text-[14px] font-semibold text-foreground/88">{formatPoints(post.score)}</span>
                            <span className="block text-[8px] uppercase tracking-[0.22em] text-foreground/36">PTS</span>
                          </span>
                        </span>

                        {post.caption && (
                          <span className="line-clamp-2 text-[11px] leading-relaxed text-foreground/56 block">{post.caption}</span>
                        )}

                        <span className="flex items-center gap-2 text-[9px] uppercase tracking-[0.2em] text-foreground/34">
                          <span>{post.like_count} likes</span>
                          <span>•</span>
                          <span>{post.star_count} stars</span>
                        </span>
                      </span>
                    </motion.button>
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
