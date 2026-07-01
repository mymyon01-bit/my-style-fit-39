/**
 * FeedSection — OOTD auto-personalized social feed.
 *
 * No visible tabs / category chips. When the user opens #OOTD, we silently
 * blend posts that match their style_profile (preferred_styles + occasions)
 * with globally trending looks, mixing in a light dose of Circle posts so
 * the feed feels like a social timeline. Infinite scroll keeps things flowing.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MessageCircle, Bookmark, Share2, MoreHorizontal, Plus, Loader2 } from "lucide-react";
import WaveButton from "@/components/ootd/WaveButton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatCount } from "@/lib/formatCount";

interface PostRow {
  id: string;
  user_id: string;
  image_url: string;
  caption: string | null;
  style_tags: string[] | null;
  topics: string[] | null;
  star_count: number;
  like_count: number | null;
  wave_count?: number | null;
  created_at: string;
  _score?: number;
  profile?: {
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  } | null;
}

const PAGE_SIZE = 18;

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

  const [interests, setInterests] = useState<Set<string>>(new Set());
  const [circleIds, setCircleIds] = useState<Set<string>>(new Set());
  const [profileReady, setProfileReady] = useState(false);

  const [posts, setPosts] = useState<PostRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [done, setDone] = useState(false);
  const pageRef = useRef(0);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Load interest signals once per user.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user) { setProfileReady(true); return; }
      const [sp, ci] = await Promise.all([
        supabase.from("style_profiles")
          .select("preferred_styles, occasions")
          .eq("user_id", user.id).maybeSingle(),
        supabase.from("circles")
          .select("following_id")
          .eq("follower_id", user.id),
      ]);
      if (cancelled) return;
      const bag = new Set<string>();
      ((sp.data as any)?.preferred_styles ?? []).forEach((s: string) => bag.add(s.toLowerCase()));
      ((sp.data as any)?.occasions ?? []).forEach((s: string) => bag.add(s.toLowerCase()));
      setInterests(bag);
      setCircleIds(new Set((ci.data ?? []).map((r: any) => r.following_id).filter(Boolean)));
      setProfileReady(true);
    })();
    return () => { cancelled = true; };
  }, [user]);

  const scorePost = useCallback(
    (p: PostRow) => {
      const tags = [
        ...((p.style_tags ?? []) as string[]),
        ...((p.topics ?? []) as string[]),
      ].map((t) => (t || "").toLowerCase());
      let s = 0;
      for (const t of tags) if (interests.has(t)) s += 3;
      if (circleIds.has(p.user_id)) s += 2;
      s += Math.min(4, Math.log2(1 + (p.star_count ?? 0) + (p.like_count ?? 0)));
      // Recency boost — halve every 3 days.
      const days = Math.max(0, (Date.now() - new Date(p.created_at).getTime()) / 86_400_000);
      s += Math.max(0, 3 - days / 3);
      return s;
    },
    [interests, circleIds],
  );

  const loadPage = useCallback(
    async (reset = false) => {
      if (loadingMore) return;
      if (reset) { pageRef.current = 0; setDone(false); }
      const page = pageRef.current;
      if (page === 0) setLoading(true); else setLoadingMore(true);

      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data } = await supabase
        .from("ootd_posts")
        .select("id, user_id, image_url, caption, style_tags, topics, star_count, like_count, wave_count, created_at")
        .not("image_url", "is", null)
        .order("created_at", { ascending: false })
        .range(from, to);

      const rows = (data ?? []) as PostRow[];
      // hydrate profiles for this page
      const ids = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean)));
      if (ids.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, display_name, username, avatar_url")
          .in("user_id", ids);
        const map = new Map((profs ?? []).map((p: any) => [p.user_id, p]));
        rows.forEach((r) => { r.profile = map.get(r.user_id) ?? null; });
      }
      rows.forEach((r) => { r._score = scorePost(r); });
      // Re-rank the newly fetched page by personal score so interests bubble up.
      rows.sort((a, b) => (b._score! - a._score!));

      setPosts((prev) => (reset ? rows : [...prev, ...rows]));
      pageRef.current = page + 1;
      if (rows.length < PAGE_SIZE) setDone(true);
      setLoading(false);
      setLoadingMore(false);
    },
    [scorePost, loadingMore],
  );

  // Initial + when interests resolve, rebuild feed.
  useEffect(() => {
    if (!profileReady) return;
    loadPage(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileReady, interests.size, circleIds.size]);

  // Infinite scroll.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || done) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) loadPage(false);
    }, { rootMargin: "600px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [loadPage, done, posts.length]);

  const empty = !loading && posts.length === 0;

  return (
    <div className="mx-auto w-full max-w-md px-0 pb-10 lg:max-w-none">
      {/* Feed — single column mobile, 2-col tablet, 3-col desktop */}
      <div className="mt-2 grid gap-4 px-3 lg:grid-cols-2 lg:gap-6 lg:px-0 xl:grid-cols-3">
        {loading && (
          <div className="col-span-full flex min-h-[30vh] items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-accent/65" />
          </div>
        )}
        {empty && (
          <div className="col-span-full rounded-2xl border border-border bg-card p-8 text-center text-sm text-foreground/55">
            No posts yet — check back soon.
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
                    <img
                      src={p.profile.avatar_url}
                      alt=""
                      className="h-full w-full object-cover"
                      referrerPolicy="no-referrer"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                    />
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

            <button
              type="button"
              onClick={() => navigate(`/ootd?post=${p.id}`)}
              className="relative block w-full overflow-hidden bg-gradient-to-br from-muted to-foreground/[0.06]"
              style={{ aspectRatio: "4 / 5" }}
            >
              <img
                src={p.image_url}
                alt={p.caption ?? "OOTD"}
                className="absolute inset-0 h-full w-full object-cover"
                loading="lazy"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  const img = e.currentTarget as HTMLImageElement;
                  img.style.display = "none";
                  const parent = img.parentElement;
                  if (parent && !parent.querySelector("[data-img-fallback]")) {
                    const span = document.createElement("span");
                    span.dataset.imgFallback = "1";
                    span.className = "absolute inset-0 flex items-center justify-center text-[11px] text-foreground/40";
                    span.textContent = "Image unavailable";
                    parent.appendChild(span);
                  }
                }}
              />
            </button>

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

            <footer className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-5 text-foreground/75">
                <WaveButton postId={p.id} initialCount={(p as any).wave_count ?? 0} />
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

        {/* Infinite scroll sentinel */}
        {!loading && !empty && (
          <div ref={sentinelRef} className="col-span-full flex items-center justify-center py-8">
            {loadingMore
              ? <Loader2 className="h-4 w-4 animate-spin text-accent/65" />
              : done
                ? <span className="text-[11px] text-foreground/40">You're all caught up</span>
                : <span className="h-4" />}
          </div>
        )}
      </div>

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
