/**
 * MyPageSection — User's OOTD profile archive.
 * Reference: image 2 (avatar + bio + stats + sub-tabs + 3-col grid).
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Heart, Bookmark, Loader2, Camera, Film } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatCount } from "@/lib/formatCount";
import { Button } from "@/components/ui/button";
import { useCircleCounts } from "@/hooks/useCircleCounts";
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
  const [profile, setProfile] = useState<Profile | null>(null);
  const [outfitsCount, setOutfitsCount] = useState(0);
  const { counts: circleCounts } = useCircleCounts(user?.id);
  const [tab, setTab] = useState<SubTab>("outfits");
  const [posts, setPosts] = useState<PostThumb[]>([]);
  const [loading, setLoading] = useState(true);

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
  }, [user, tab]);

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
    </div>
  );
};

export default MyPageSection;
