import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Crown, TrendingUp, Loader2 } from "lucide-react";
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

const CROWN_COLORS = [
  "from-yellow-400 to-amber-500", // 1st
  "from-slate-300 to-slate-400",   // 2nd
  "from-amber-600 to-amber-700",   // 3rd
  "from-foreground/20 to-foreground/30", // 4th
  "from-foreground/15 to-foreground/25", // 5th
];

const CROWN_SIZES = ["h-7 w-7", "h-5 w-5", "h-5 w-5", "h-4 w-4", "h-4 w-4"];

function computeScore(post: { like_count: number; dislike_count: number; star_count: number; created_at: string }): number {
  const likes = post.like_count || 0;
  const dislikes = post.dislike_count || 0;
  const stars = post.star_count || 0;
  const ageHours = (Date.now() - new Date(post.created_at).getTime()) / 3600000;
  const decay = Math.max(0.2, 1 - ageHours / 168); // decay over 1 week
  return (likes * 3 + stars * 5 - dislikes * 2) * decay;
}

export default function CrownedBoard() {
  const navigate = useNavigate();
  const [ranked, setRanked] = useState<RankedPost[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileInfo>>({});
  const [dailyWinner, setDailyWinner] = useState<DailyWinner | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRankings();
    loadDailyWinner();
  }, []);

  const loadRankings = async () => {
    setLoading(true);
    // Fetch recent posts with engagement
    const { data } = await supabase
      .from("ootd_posts")
      .select("id, user_id, image_url, caption, style_tags, like_count, dislike_count, star_count, created_at")
      .gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString())
      .order("created_at", { ascending: false })
      .limit(50);

    if (data) {
      const scored = data.map(p => ({
        ...p,
        like_count: p.like_count || 0,
        dislike_count: p.dislike_count || 0,
        star_count: p.star_count || 0,
        score: computeScore(p as any),
      }));
      scored.sort((a, b) => b.score - a.score);
      const top5 = scored.slice(0, 5);
      setRanked(top5);

      // Load profiles
      const userIds = [...new Set(top5.map(p => p.user_id))];
      if (userIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, display_name, avatar_url")
          .in("user_id", userIds);
        if (profs) {
          const map: Record<string, ProfileInfo> = {};
          for (const p of profs) map[p.user_id] = p;
          setProfiles(map);
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
      const winner = data[0] as any;
      const { data: prof } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url")
        .eq("user_id", winner.user_id)
        .maybeSingle();
      setDailyWinner({ ...winner, profile: prof });
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
      {/* CROWNED Header */}
      <div className="text-center space-y-3">
        <div className="flex items-center justify-center gap-2">
          <Crown className="h-6 w-6 text-yellow-400" />
          <h2
            className="text-2xl font-black tracking-[0.08em] text-foreground/90 uppercase"
            style={{
              fontFamily: "'Playfair Display', serif",
              textShadow: "0 0 30px hsl(var(--accent) / 0.15)",
            }}
          >
            CROWNED
          </h2>
          <Crown className="h-6 w-6 text-yellow-400" />
        </div>
        <p className="text-[10px] tracking-[0.3em] text-foreground/40 uppercase">
          Top Styles · Updated Live
        </p>
      </div>

      {/* Daily Winner Banner */}
      {dailyWinner && dailyWinner.profile && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-2xl border border-yellow-400/20 bg-gradient-to-r from-yellow-400/5 to-amber-500/5 p-4"
        >
          <div className="flex items-center gap-3">
            <Crown className="h-5 w-5 text-yellow-400 fill-yellow-400" />
            <div className="flex-1">
              <p className="text-[9px] font-bold tracking-[0.2em] text-yellow-400/70 uppercase">
                {dailyWinner.title}
              </p>
              <button
                onClick={() => navigate(`/user/${dailyWinner.user_id}`)}
                className="text-[13px] font-semibold text-foreground/85 hover:text-foreground transition-colors"
              >
                {dailyWinner.profile.display_name || "Anonymous"}
              </button>
            </div>
            <span className="text-[10px] text-foreground/40">{dailyWinner.award_date}</span>
          </div>
        </motion.div>
      )}

      {/* Rankings */}
      {ranked.length === 0 ? (
        <div className="py-16 text-center space-y-3">
          <TrendingUp className="h-6 w-6 text-foreground/20 mx-auto" />
          <p className="text-[12px] text-foreground/40">No rankings yet this week</p>
          <p className="text-[10px] text-foreground/30">Post OOTDs and get likes to enter the rankings</p>
        </div>
      ) : (
        <div className="space-y-4">
          {ranked.map((post, i) => {
            const profile = getProfile(post.user_id);
            const rank = i + 1;

            return (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.08 }}
                className={`relative overflow-hidden rounded-2xl border ${
                  rank === 1
                    ? "border-yellow-400/30 bg-gradient-to-r from-yellow-400/[0.04] to-amber-500/[0.04]"
                    : "border-border/15 bg-card/40"
                }`}
              >
                <div className="flex items-center gap-4 p-3">
                  {/* Rank */}
                  <div className={`flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br ${CROWN_COLORS[i]} flex-shrink-0`}>
                    <span className={`font-black text-white ${rank === 1 ? "text-lg" : "text-sm"}`}>
                      {rank}
                    </span>
                  </div>

                  {/* Thumbnail */}
                  <div className="h-16 w-12 rounded-lg overflow-hidden flex-shrink-0">
                    <img
                      src={post.image_url}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <button
                      onClick={() => navigate(`/user/${post.user_id}`)}
                      className="flex items-center gap-2 group"
                    >
                      <div className="h-5 w-5 rounded-full bg-foreground/[0.06] overflow-hidden flex-shrink-0">
                        {profile?.avatar_url ? (
                          <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-[8px] font-bold text-foreground/30">
                            {(profile?.display_name || "?")[0].toUpperCase()}
                          </div>
                        )}
                      </div>
                      <span className="text-[11px] font-semibold text-foreground/75 group-hover:text-foreground/90 transition-colors truncate">
                        {profile?.display_name || "Anonymous"}
                      </span>
                    </button>

                    {/* Style tags */}
                    {post.style_tags && post.style_tags.length > 0 && (
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {post.style_tags.slice(0, 3).map(tag => (
                          <span key={tag} className="text-[8px] text-accent/50 bg-accent/[0.06] rounded-full px-1.5 py-0.5">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Score */}
                  <div className="text-right flex-shrink-0">
                    <p className={`text-sm font-bold ${rank === 1 ? "text-yellow-400" : "text-foreground/60"}`}>
                      {Math.round(post.score)}
                    </p>
                    <p className="text-[8px] text-foreground/30 tracking-wider">PTS</p>
                  </div>
                </div>

                {/* 1st place gets expanded view */}
                {rank === 1 && (
                  <div className="px-3 pb-3">
                    <div className="rounded-xl overflow-hidden">
                      <img
                        src={post.image_url}
                        alt={post.caption || ""}
                        className="w-full object-cover"
                        style={{ maxHeight: "300px" }}
                        loading="lazy"
                      />
                    </div>
                    {post.caption && (
                      <p className="text-[11px] text-foreground/50 mt-2 line-clamp-2 px-1">{post.caption}</p>
                    )}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
