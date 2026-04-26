import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

interface Story {
  id: string;
  user_id: string;
  media_url: string;
  media_type: string;
  created_at: string;
  expires_at: string | null;
  caption?: string | null;
}

interface ProfileLite {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface UserStories {
  user_id: string;
  profile: ProfileLite | null;
  stories: Story[];
  hasUnseen: boolean;
}

interface Props {
  onUploadClick: () => void;
  onOpenStories: (userIndex: number, allUserStories: UserStories[]) => void;
  refreshKey?: number;
  /** When true, only show stories from users the current user follows (their circle) + their own. */
  circlesOnly?: boolean;
  /** Notifies parent whenever the grouped story list refreshes. */
  onLoaded?: (users: UserStories[]) => void;
  /** Render smaller circles — used on My Page where space is tight. */
  compact?: boolean;
}

const SEEN_KEY = "wardrobe.seenStories";

const getSeen = (): Record<string, string> => {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) || "{}");
  } catch {
    return {};
  }
};

const StoriesRow = ({ onUploadClick, onOpenStories, refreshKey, circlesOnly = false, onLoaded, compact = false }: Props) => {
  const { user } = useAuth();
  const [grouped, setGrouped] = useState<UserStories[]>([]);
  const [myProfile, setMyProfile] = useState<ProfileLite | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, [user, refreshKey, circlesOnly]);

  const load = async () => {
    setLoading(true);
    const nowIso = new Date().toISOString();

    // If circlesOnly, fetch the user's followings to filter
    let allowedUserIds: string[] | null = null;
    if (circlesOnly && user) {
      const { data: follows } = await supabase
        .from("circles")
        .select("following_id")
        .eq("follower_id", user.id);
      allowedUserIds = [user.id, ...((follows || []).map((f: any) => f.following_id))];
    }

    let q = supabase
      .from("stories")
      .select("id, user_id, media_url, media_type, created_at, expires_at, caption")
      .or(`expires_at.gt.${nowIso},expires_at.is.null`)
      .eq("is_highlight", false)
      .order("created_at", { ascending: false })
      .limit(100);
    if (allowedUserIds) q = q.in("user_id", allowedUserIds);
    const { data: stories } = await q;

    const list = (stories || []) as Story[];
    const userIds = [...new Set(list.map((s) => s.user_id))];
    if (user && !userIds.includes(user.id)) userIds.push(user.id);

    let profileMap: Record<string, ProfileLite> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url")
        .in("user_id", userIds);
      for (const p of profiles || []) profileMap[p.user_id] = p as ProfileLite;
    }
    if (user) setMyProfile(profileMap[user.id] || null);

    const seen = getSeen();
    const byUser: Record<string, UserStories> = {};
    for (const s of list) {
      if (!byUser[s.user_id]) {
        byUser[s.user_id] = {
          user_id: s.user_id,
          profile: profileMap[s.user_id] || null,
          stories: [],
          hasUnseen: false,
        };
      }
      byUser[s.user_id].stories.push(s);
    }
    // Sort stories per user oldest -> newest for natural playback
    Object.values(byUser).forEach((u) => {
      u.stories.sort((a, b) => a.created_at.localeCompare(b.created_at));
      const lastSeen = seen[u.user_id];
      u.hasUnseen = !lastSeen || u.stories.some((s) => s.created_at > lastSeen);
    });

    // Order: own user first if they have stories, then unseen, then seen
    const ordered = Object.values(byUser).sort((a, b) => {
      if (user) {
        if (a.user_id === user.id) return -1;
        if (b.user_id === user.id) return 1;
      }
      if (a.hasUnseen !== b.hasUnseen) return a.hasUnseen ? -1 : 1;
      return b.stories[b.stories.length - 1].created_at.localeCompare(
        a.stories[a.stories.length - 1].created_at
      );
    });

    setGrouped(ordered);
    setLoading(false);
    onLoaded?.(ordered);
  };

  const myHasStory = !!user && grouped.some((g) => g.user_id === user.id);
  const others = grouped.filter((g) => !user || g.user_id !== user.id);

  return (
    <div className="-mx-6 md:-mx-10 lg:-mx-12 px-6 md:px-10 lg:px-12 mb-6">
      <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-none [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {/* Own avatar — upload entry point */}
        {user && (
          <button
            onClick={() => {
              if (myHasStory) {
                const idx = grouped.findIndex((g) => g.user_id === user.id);
                if (idx >= 0) onOpenStories(idx, grouped);
              } else {
                onUploadClick();
              }
            }}
            className="flex flex-col items-center gap-1.5 flex-shrink-0 w-16 group"
          >
            <div className="relative">
              <RippleRing active={myHasStory} unseen={myHasStory && grouped.find((g) => g.user_id === user.id)?.hasUnseen} />
              <div className="relative h-16 w-16 rounded-full overflow-hidden bg-foreground/[0.06] border-2 border-background">
                {myProfile?.avatar_url ? (
                  <img src={myProfile.avatar_url} alt="You" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[10px] font-medium text-foreground/50">
                    {(myProfile?.display_name?.[0] || "Y").toUpperCase()}
                  </div>
                )}
              </div>
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  onUploadClick();
                }}
                role="button"
                aria-label="Add story"
                className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-gradient-to-tr from-accent via-pink-400 to-amber-300 text-background flex items-center justify-center border-2 border-background shadow-md hover:scale-110 active:scale-95 transition-transform cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={3} />
              </span>
            </div>
            <span className="text-[9px] font-medium tracking-[0.05em] text-foreground/60 truncate max-w-[60px]">
              Your story
            </span>
          </button>
        )}

        {loading && others.length === 0
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-1.5 flex-shrink-0 w-16">
                <div className="h-16 w-16 rounded-full bg-foreground/[0.05] animate-pulse" />
                <div className="h-2 w-10 rounded bg-foreground/[0.05] animate-pulse" />
              </div>
            ))
          : others.map((u, idx) => {
              const realIndex = grouped.indexOf(u);
              return (
                <button
                  key={u.user_id}
                  onClick={() => onOpenStories(realIndex, grouped)}
                  className="flex flex-col items-center gap-1.5 flex-shrink-0 w-16 group"
                >
                  <div className="relative">
                    <RippleRing active unseen={u.hasUnseen} />
                    <div className="relative h-16 w-16 rounded-full overflow-hidden bg-foreground/[0.06] border-2 border-background">
                      {u.profile?.avatar_url ? (
                        <img src={u.profile.avatar_url} alt={u.profile.display_name || ""} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[10px] font-medium text-foreground/50">
                          {(u.profile?.display_name?.[0] || "?").toUpperCase()}
                        </div>
                      )}
                    </div>
                  </div>
                  <span className="text-[9px] font-medium tracking-[0.05em] text-foreground/60 truncate max-w-[60px]">
                    {u.profile?.display_name || "User"}
                  </span>
                </button>
              );
            })}
      </div>
    </div>
  );
};

const RippleRing = ({ active, unseen }: { active?: boolean; unseen?: boolean }) => {
  if (!active) return null;
  return (
    <>
      {/* Solid gradient ring */}
      <div
        className={`absolute inset-0 rounded-full p-[2px] -m-[2px] ${
          unseen
            ? "bg-gradient-to-tr from-accent via-pink-400 to-amber-300"
            : "bg-foreground/15"
        }`}
        style={{ height: "calc(100% + 4px)", width: "calc(100% + 4px)", top: -2, left: -2 }}
      />
      {/* Animated ripples (only for unseen) */}
      {unseen && (
        <>
          <motion.span
            className="absolute inset-0 rounded-full border-2 border-accent/40 pointer-events-none"
            style={{ height: "calc(100% + 4px)", width: "calc(100% + 4px)", top: -2, left: -2 }}
            initial={{ scale: 1, opacity: 0.6 }}
            animate={{ scale: 1.35, opacity: 0 }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
          />
          <motion.span
            className="absolute inset-0 rounded-full border border-pink-300/30 pointer-events-none"
            style={{ height: "calc(100% + 4px)", width: "calc(100% + 4px)", top: -2, left: -2 }}
            initial={{ scale: 1, opacity: 0.5 }}
            animate={{ scale: 1.55, opacity: 0 }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeOut", delay: 0.4 }}
          />
        </>
      )}
    </>
  );
};

export default StoriesRow;
export type { UserStories, Story, ProfileLite };
