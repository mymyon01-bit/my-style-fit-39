/**
 * MyPageSection — User's OOTD profile archive.
 * Reference: image 2 (avatar + bio + stats + sub-tabs + 3-col grid).
 *
 * Also hosts the "Stories" rail (moved from the Quicks video section) so
 * users manage adding a story from their own page, and the rail shows
 * their friends (people in their Circle) with a gold animated ring.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Heart, Bookmark, Loader2, Camera, Film, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatCount } from "@/lib/formatCount";
import { Button } from "@/components/ui/button";
import { useCircleCounts } from "@/hooks/useCircleCounts";
import { useOOTDModal } from "@/lib/ootdModal";
import OOTDUploadSheet from "@/components/OOTDUploadSheet";
import OOTDShortUploadSheet from "@/components/ootd/OOTDShortUploadSheet";

type SubTab = "outfits" | "looks" | "saved" | "reviews";

const SUB_TABS: { key: SubTab; label: string }[] = [
  { key: "outfits", label: "Outfits" },
  { key: "looks", label: "Looks" },
  { key: "saved", label: "Saved" },
  { key: "reviews", label: "Reviews" },
];

interface Profile {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
}

interface PostThumb {
  id: string;
  image_url: string;
  caption: string | null;
  star_count: number;
  created_at: string;
}

interface StoryUser {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  isFriend: boolean;
}

function timeAgo(iso: string) {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return `${Math.max(1, Math.floor(diff / 60_000))}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const MyPageSection = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { open: openOOTDModal } = useOOTDModal();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [outfitsCount, setOutfitsCount] = useState(0);
  const { counts: circleCounts } = useCircleCounts(user?.id);
  const [tab, setTab] = useState<SubTab>("outfits");
  const [posts, setPosts] = useState<PostThumb[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [videoUploadOpen, setVideoUploadOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [stories, setStories] = useState<StoryUser[]>([]);

  // Stories rail — recent posters, with friends (people the user follows)
  // marked so we can decorate their avatars with the gold animated ring.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("ootd_posts")
        .select("user_id, created_at")
        .order("created_at", { ascending: false })
        .limit(60);
      if (cancelled || !data) return;
      const seen = new Set<string>();
      const ids = (data as { user_id: string }[])
        .filter((r) => {
          if (!r.user_id || seen.has(r.user_id)) return false;
          seen.add(r.user_id);
          return true;
        })
        .slice(0, 16)
        .map((r) => r.user_id);
      if (!ids.length) return;
      const [{ data: profiles }, { data: friends }] = await Promise.all([
        supabase
          .from("profiles")
          .select("user_id, display_name, username, avatar_url")
          .in("user_id", ids),
        user
          ? supabase
              .from("circles")
              .select("following_id")
              .eq("follower_id", user.id)
              .in("following_id", ids)
          : Promise.resolve({ data: [] as { following_id: string }[] }),
      ]);
      if (cancelled) return;
      const friendSet = new Set(
        ((friends as any[]) || []).map((f) => f.following_id as string),
      );
      const map = new Map((profiles || []).map((p: any) => [p.user_id, p]));
      const rows: StoryUser[] = ids
        .map((id) => {
          const p: any = map.get(id);
          if (!p) return null;
          return {
            user_id: p.user_id,
            display_name: p.display_name,
            username: p.username,
            avatar_url: p.avatar_url,
            isFriend: friendSet.has(p.user_id),
          } as StoryUser;
        })
        .filter(Boolean) as StoryUser[];
      // Show friends first so the gold rings lead the rail.
      rows.sort((a, b) => Number(b.isFriend) - Number(a.isFriend));
      setStories(rows);
    })();
    return () => { cancelled = true; };
  }, [user, reloadKey]);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      const [{ data: prof }, { count: outfits }] = await Promise.all([
        supabase
          .from("profiles")
          .select("user_id, display_name, username, avatar_url, bio")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("ootd_posts")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id),
      ]);
      if (cancelled) return;
      setProfile((prof as Profile) ?? { user_id: user.id, display_name: null, username: null, avatar_url: null, bio: null });
      setOutfitsCount(outfits ?? 0);
    })();
    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      let rows: PostThumb[] = [];
      if (tab === "outfits" || tab === "looks") {
        const { data } = await supabase
          .from("ootd_posts")
          .select("id, image_url, caption, star_count, created_at")
          .eq("user_id", user.id)
          .not("image_url", "is", null)
          .order("created_at", { ascending: false })
          .limit(60);
        rows = (data ?? []) as PostThumb[];
      } else if (tab === "saved") {
        const { data } = await supabase
          .from("saved_items")
          .select("created_at, ootd_post_id, ootd_posts(id, image_url, caption, star_count, created_at)")
          .eq("user_id", user.id)
          .not("ootd_post_id", "is", null)
          .order("created_at", { ascending: false })
          .limit(60);
        rows = ((data ?? []) as any[])
          .map((r) => r.ootd_posts)
          .filter(Boolean) as PostThumb[];
      } else {
        rows = [];
      }
      if (!cancelled) {
        setPosts(rows);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user, tab, reloadKey]);

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-6 py-16 text-center">
        <p className="text-sm text-foreground/65">Sign in to see your OOTD page.</p>
        <Button className="mt-4" onClick={() => navigate("/profile")}>Sign in</Button>
      </div>
    );
  }

  const name = profile?.display_name ?? profile?.username ?? "You";
  const handle = profile?.username ? `@${profile.username}` : "";

  return (
    <div className="mx-auto max-w-md px-5 pb-10 lg:max-w-4xl lg:px-0">
      {/* Profile header */}
      <header className="flex items-start gap-4 pt-5">
        <span className="h-[72px] w-[72px] shrink-0 overflow-hidden rounded-full bg-muted">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt={name} className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center font-display text-2xl text-foreground/40">
              {name.slice(0, 1).toUpperCase()}
            </span>
          )}
        </span>
        <div className="min-w-0 flex-1 pt-1">
          <h1 className="font-display text-[22px] leading-tight tracking-tight text-foreground">{name}</h1>
          {handle && <p className="text-[12px] text-foreground/50">{handle}</p>}
          {profile?.bio && (
            <p className="mt-1.5 line-clamp-2 text-[12.5px] leading-snug text-foreground/70">
              {profile.bio}
            </p>
          )}
        </div>
      </header>

      {/* Stories rail — Add-your-own first, then friends (gold ring), then others */}
      <div className="mt-5 -mx-5 border-b border-border/40 pb-4 lg:mx-0">
        <div className="flex gap-3 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button
            type="button"
            onClick={() => setUploadOpen(true)}
            className="flex shrink-0 flex-col items-center gap-1.5"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-full border border-dashed border-foreground/30 bg-background text-foreground/70">
              <Plus className="h-5 w-5" strokeWidth={1.6} />
            </span>
            <span className="text-[10px] text-foreground/60">Add</span>
          </button>
          {stories.map((s) => (
            <button
              key={s.user_id}
              type="button"
              onClick={() => navigate(`/user/${s.user_id}`)}
              className="flex shrink-0 flex-col items-center gap-1.5"
            >
              {s.isFriend ? (
                <span className="relative flex h-14 w-14 items-center justify-center">
                  {/* Rotating gold conic ring for friends only */}
                  <span
                    aria-hidden
                    className="absolute inset-0 rounded-full animate-[spin_6s_linear_infinite]"
                    style={{
                      background:
                        "conic-gradient(from 0deg, #f5d67a, #b8860b, #fff2c2, #d4a437, #f5d67a)",
                    }}
                  />
                  <span className="relative block h-[52px] w-[52px] overflow-hidden rounded-full border-2 border-background bg-muted">
                    {s.avatar_url ? (
                      <img src={s.avatar_url} alt="" className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center font-display text-sm text-foreground/50">
                        {(s.display_name ?? s.username ?? "?").slice(0, 1).toUpperCase()}
                      </span>
                    )}
                  </span>
                </span>
              ) : (
                <span className="block h-14 w-14 overflow-hidden rounded-full border border-border/60 bg-muted">
                  {s.avatar_url ? (
                    <img src={s.avatar_url} alt="" className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center font-display text-sm text-foreground/50">
                      {(s.display_name ?? s.username ?? "?").slice(0, 1).toUpperCase()}
                    </span>
                  )}
                </span>
              )}
              <span className="max-w-[60px] truncate text-[10px] text-foreground/70">
                {s.display_name ?? s.username ?? "—"}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="mt-5 grid grid-cols-3 gap-3 text-center">
        {[
          { label: "Outfits", value: outfitsCount },
          { label: "Circle", value: circleCounts?.circle ?? 0 },
          { label: "Ripple", value: circleCounts?.ripple ?? 0 },
        ].map((s) => (
          <div key={s.label}>
            <div className="font-display text-[20px] font-medium text-foreground">{formatCount(s.value)}</div>
            <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-foreground/55">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Edit + Save */}
      <div className="mt-4 flex items-center gap-2">
        <Button
          variant="outline"
          className="h-10 flex-1 rounded-xl border-border bg-card text-[13px] font-medium"
          onClick={() => navigate("/profile")}
        >
          Edit Profile
        </Button>
        <Button
          variant="outline"
          size="icon"
          aria-label="Saved"
          className="h-10 w-10 rounded-xl border-border bg-card"
          onClick={() => setTab("saved")}
        >
          <Bookmark className="h-[16px] w-[16px]" strokeWidth={1.6} />
        </Button>
      </div>

      {/* POST OOTD — photo or video */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setUploadOpen(true)}
          className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-foreground/15 bg-background/60 py-3 text-foreground/65 transition-all hover:border-accent/40 hover:bg-accent/[0.06] hover:text-accent"
        >
          <Camera className="h-4 w-4" />
          <span className="text-[10px] font-medium tracking-[0.22em]">POST PHOTO</span>
        </button>
        <button
          type="button"
          onClick={() => setVideoUploadOpen(true)}
          className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-foreground/15 bg-background/60 py-3 text-foreground/65 transition-all hover:border-accent/40 hover:bg-accent/[0.06] hover:text-accent"
        >
          <Film className="h-4 w-4" />
          <span className="text-[10px] font-medium tracking-[0.22em]">POST VIDEO</span>
        </button>
      </div>


      {/* Sub-tabs */}
      <div className="mt-6 flex items-center justify-around border-b border-border/60">
        {SUB_TABS.map((s) => {
          const active = tab === s.key;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => setTab(s.key)}
              className={`relative pb-2.5 text-[13px] tracking-tight transition ${
                active ? "font-semibold text-foreground" : "text-foreground/45"
              }`}
            >
              {s.label}
              {active && <span className="absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-foreground" />}
            </button>
          );
        })}
      </div>

      {/* Grid */}
      <div className="mt-4">
        {loading ? (
          <div className="flex min-h-[30vh] items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-accent/65" />
          </div>
        ) : posts.length === 0 ? (
          <div className="flex min-h-[30vh] flex-col items-center justify-center gap-3 text-foreground/55">
            <Camera className="h-6 w-6" strokeWidth={1.4} />
            <p className="text-sm">No {SUB_TABS.find(s => s.key === tab)?.label.toLowerCase()} yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2.5">
            {posts.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => navigate(`/ootd?post=${p.id}`)}
                className="group relative overflow-hidden rounded-xl bg-foreground/[0.04] text-left"
                style={{ aspectRatio: "3 / 4" }}
              >
                <img
                  src={p.image_url}
                  alt={p.caption ?? ""}
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  loading="lazy"
                />
                <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-background/85 px-1.5 py-0.5 text-[9px] font-semibold text-foreground/85 backdrop-blur-md">
                  <Heart className="h-2.5 w-2.5 fill-accent text-accent" strokeWidth={0} />
                  {formatCount(p.star_count ?? 0)}
                </span>
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/85 to-transparent px-2 py-1.5 text-[10px] text-foreground/80">
                  <span className="block truncate">{p.caption ?? "—"}</span>
                  <span className="block text-foreground/45">{timeAgo(p.created_at)}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <OOTDUploadSheet
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onPosted={() => { setUploadOpen(false); setReloadKey((k) => k + 1); }}
        onSwitchToVideo={() => { setUploadOpen(false); setVideoUploadOpen(true); }}
      />
      <OOTDShortUploadSheet
        open={videoUploadOpen}
        onClose={() => setVideoUploadOpen(false)}
        onPosted={() => { setVideoUploadOpen(false); setReloadKey((k) => k + 1); }}
      />
    </div>
  );
};

export default MyPageSection;
