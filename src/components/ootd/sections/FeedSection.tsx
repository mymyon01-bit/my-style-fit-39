/**
 * FeedSection — OOTD card-style editorial feed.
 * Reference: image 1 (For You / Following + category chips + posts).
 * Stories rail intentionally removed — moved to /quicks.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Heart,
  MessageCircle,
  Bookmark,
  Share2,
  MoreHorizontal,
  Plus,
  Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatCount } from "@/lib/formatCount";

type Tab = "foryou" | "circle";
type Category = "all" | "outfit" | "tip" | "review" | "qa";

const CATEGORIES: { key: Category; label: string }[] = [
  { key: "all", label: "All" },
  { key: "outfit", label: "Outfit" },
  { key: "tip", label: "Style Tip" },
  { key: "review", label: "Review" },
  { key: "qa", label: "Q&A" },
];

interface PostRow {
  id: string;
  user_id: string;
  image_url: string;
  caption: string | null;
  style_tags: string[] | null;
  topics: string[] | null;
  star_count: number;
  like_count: number | null;
  created_at: string;
  profile?: {
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  } | null;
}

function timeAgo(iso: string) {
  const d = new Date(iso).getTime();
  const diff = Math.max(0, Date.now() - d);
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return `${Math.max(1, Math.floor(diff / 60_000))}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const FeedSection = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("foryou");
  const [category, setCategory] = useState<Category>("all");
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      // For the Circle tab, restrict posts to people this user follows.
      let circleIds: string[] | null = null;
      if (tab === "circle") {
        if (!user) {
          if (!cancelled) { setPosts([]); setLoading(false); }
          return;
        }
        const { data: c } = await supabase
          .from("circles")
          .select("following_id")
          .eq("follower_id", user.id);
        circleIds = Array.from(new Set((c ?? []).map((r: any) => r.following_id).filter(Boolean)));
        if (circleIds.length === 0) {
          if (!cancelled) { setPosts([]); setLoading(false); }
          return;
        }
      }

      let q = supabase
        .from("ootd_posts")
        .select("id, user_id, image_url, caption, style_tags, topics, star_count, like_count, created_at")
        .not("image_url", "is", null);

      if (tab === "foryou") {
        q = q.order("star_count", { ascending: false }).order("created_at", { ascending: false });
      } else {
        q = q.in("user_id", circleIds!).order("created_at", { ascending: false });
      }
      q = q.limit(20);

      const { data } = await q;
      if (cancelled) return;

      const rows = (data ?? []) as PostRow[];
      const filtered = category === "all"
        ? rows
        : rows.filter((r) => (r.topics ?? []).includes(category));

      // hydrate profiles
      const ids = Array.from(new Set(filtered.map((r) => r.user_id).filter(Boolean)));
      if (ids.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, display_name, username, avatar_url")
          .in("user_id", ids);
        const map = new Map((profs ?? []).map((p: any) => [p.user_id, p]));
        filtered.forEach((r) => { r.profile = map.get(r.user_id) ?? null; });
      }

      if (!cancelled) {
        setPosts(filtered);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tab, category, user]);

  const empty = !loading && posts.length === 0;

  return (
    <div className="mx-auto w-full max-w-md px-0 pb-10 lg:max-w-none">
      {/* For You / Circle */}
      <div className="px-5 pt-3 lg:px-0">
        <div className="flex items-center gap-6">
          {(["foryou", "circle"] as Tab[]).map((t) => {
            const active = tab === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`relative pb-2 font-display text-[18px] tracking-tight transition ${
                  active ? "text-foreground" : "text-foreground/40 hover:text-foreground/70"
                }`}
              >
                {t === "foryou" ? "For You" : "Circle"}
                {active && (
                  <span className="absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-foreground" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Category chips */}
      <div className="mt-3 overflow-x-auto px-5 lg:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex gap-2 pb-1">
          {CATEGORIES.map((c) => {
            const active = category === c.key;
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => setCategory(c.key)}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-medium tracking-tight transition ${
                  active
                    ? "bg-foreground text-background"
                    : "bg-foreground/[0.06] text-foreground/65 hover:bg-foreground/[0.1]"
                }`}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Feed — single column mobile, 2-col tablet, 3-col desktop */}
      <div className="mt-4 grid gap-4 px-3 lg:grid-cols-2 lg:gap-6 lg:px-0 xl:grid-cols-3">

        {loading && (
          <div className="col-span-full flex min-h-[30vh] items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-accent/65" />
          </div>
        )}
        {empty && (
          <div className="col-span-full rounded-2xl border border-border bg-card p-8 text-center text-sm text-foreground/55">
            {tab === "circle"
              ? "Add people to your Circle to see their looks here."
              : "No posts yet — check back soon."}
          </div>
        )}
        {posts.map((p) => (
          <article
            key={p.id}
            className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-1)]"
          >
            {/* Author row */}
            <header className="flex items-center justify-between px-4 pt-3 pb-2.5">
              <button
                type="button"
                onClick={() => navigate(`/user/${p.user_id}`)}
                className="flex items-center gap-2.5"
              >
                <span className="h-8 w-8 overflow-hidden rounded-full bg-muted">
                  {p.profile?.avatar_url ? (
                    <img src={p.profile.avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-[11px] text-foreground/50">
                      {(p.profile?.display_name ?? "?").slice(0, 1).toUpperCase()}
                    </span>
                  )}
                </span>
                <span className="text-left">
                  <span className="block text-[13px] font-medium leading-tight text-foreground">
                    {p.profile?.display_name ?? p.profile?.username ?? "Anonymous"}
                  </span>
                  <span className="block text-[10px] text-foreground/45">{timeAgo(p.created_at)}</span>
                </span>
              </button>
              <button type="button" aria-label="More" className="text-foreground/55 hover:text-foreground">
                <MoreHorizontal className="h-4 w-4" strokeWidth={1.6} />
              </button>
            </header>

            {/* Image */}
            <button
              type="button"
              onClick={() => navigate(`/ootd?post=${p.id}`)}
              className="relative block w-full overflow-hidden bg-foreground/[0.04]"
              style={{ aspectRatio: "4 / 5" }}
            >
              <img
                src={p.image_url}
                alt={p.caption ?? "OOTD"}
                className="absolute inset-0 h-full w-full object-cover"
                loading="lazy"
              />
            </button>

            {/* Caption + tags */}
            <div className="px-4 pt-3">
              {p.caption && (
                <p className="text-[14px] leading-snug text-foreground">{p.caption}</p>
              )}
              {p.style_tags && p.style_tags.length > 0 && (
                <p className="mt-1.5 text-[12px] text-foreground/55">
                  {p.style_tags.slice(0, 4).map((t) => `#${t}`).join("  ")}
                </p>
              )}
            </div>

            {/* Actions — open detail to like/comment/save/share. */}
            <footer className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-5 text-foreground/75">
                <button
                  type="button"
                  onClick={() => navigate(`/ootd?post=${p.id}`)}
                  className="flex items-center gap-1.5 text-[12px] transition hover:text-foreground"
                  aria-label="View likes"
                >
                  <Heart className="h-[18px] w-[18px]" strokeWidth={1.6} />
                  {formatCount(p.like_count ?? 0)}
                </button>
                <button
                  type="button"
                  onClick={() => navigate(`/ootd?post=${p.id}`)}
                  className="flex items-center gap-1.5 text-[12px] transition hover:text-foreground"
                  aria-label="View comments"
                >
                  <MessageCircle className="h-[18px] w-[18px]" strokeWidth={1.6} />
                  {formatCount(p.star_count ?? 0)}
                </button>
                <button
                  type="button"
                  onClick={() => navigate(`/ootd?post=${p.id}`)}
                  aria-label="Save"
                  className="transition hover:text-foreground"
                >
                  <Bookmark className="h-[18px] w-[18px]" strokeWidth={1.6} />
                </button>
              </div>
              <button
                type="button"
                onClick={() => navigate(`/ootd?post=${p.id}`)}
                aria-label="Share"
                className="text-foreground/75 transition hover:text-foreground"
              >
                <Share2 className="h-[18px] w-[18px]" strokeWidth={1.6} />
              </button>
            </footer>
          </article>
        ))}
      </div>

      {/* Floating post button */}
      {user && (
        <button
          type="button"
          onClick={() => navigate("/ootd?section=my&action=post")}
          aria-label="Post OOTD"
          className="fixed bottom-24 right-5 z-20 flex h-12 w-12 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-[var(--shadow-3)] transition hover:scale-105 md:bottom-12"
        >
          <Plus className="h-5 w-5" strokeWidth={2} />
        </button>
      )}
    </div>
  );
};

export default FeedSection;
