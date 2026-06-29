/**
 * QuicksPage — Stories + short-form video feed.
 * Moved out of OOTD into its own top-level surface.
 */
import { Suspense, lazy, useEffect, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

const OOTDShortsFeed = lazy(() => import("@/components/ootd/OOTDShortsFeed"));

interface StoryUser {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
}

const QuicksPage = () => {
  const navigate = useNavigate();
  const [stories, setStories] = useState<StoryUser[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Recent posters become the "stories" rail for now — light surrogate
      // until a dedicated stories table exists.
      const { data } = await supabase
        .from("ootd_posts")
        .select("user_id, created_at")
        .order("created_at", { ascending: false })
        .limit(40);
      if (cancelled || !data) return;
      const seen = new Set<string>();
      const ids = (data as { user_id: string }[])
        .filter((r) => {
          if (!r.user_id || seen.has(r.user_id)) return false;
          seen.add(r.user_id);
          return true;
        })
        .slice(0, 12)
        .map((r) => r.user_id);
      if (!ids.length) return;
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name, username, avatar_url")
        .in("user_id", ids);
      if (!cancelled && profiles) setStories(profiles as StoryUser[]);
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="min-h-screen bg-background pb-28 md:pb-16">
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 pt-4 pb-3 md:px-8">
          <h1 className="font-display text-[22px] font-medium tracking-tight text-foreground">
            Quicks
          </h1>
          <span className="font-mono text-[10px] uppercase tracking-[0.32em] text-foreground/45">
            Stories · Shorts
          </span>
        </div>

        {/* Stories rail */}
        <div className="border-b border-border/40 pb-3">
          <div className="mx-auto flex max-w-3xl gap-3 overflow-x-auto px-5 [scrollbar-width:none] md:px-8 [&::-webkit-scrollbar]:hidden">
            <button
              type="button"
              onClick={() => navigate("/ootd?section=my")}
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
                <span
                  className="rounded-full p-[2px]"
                  style={{
                    background:
                      "conic-gradient(from 180deg, hsl(var(--accent)), hsl(var(--primary)), hsl(var(--accent)))",
                  }}
                >
                  <span className="block h-14 w-14 overflow-hidden rounded-full border-2 border-background bg-muted">
                    {s.avatar_url ? (
                      <img
                        src={s.avatar_url}
                        alt={s.display_name ?? s.username ?? ""}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center font-display text-sm text-foreground/50">
                        {(s.display_name ?? s.username ?? "?").slice(0, 1).toUpperCase()}
                      </span>
                    )}
                  </span>
                </span>
                <span className="max-w-[60px] truncate text-[10px] text-foreground/70">
                  {s.display_name ?? s.username ?? "—"}
                </span>
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-md">
        <Suspense
          fallback={
            <div className="flex min-h-[40vh] items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-accent/65" />
            </div>
          }
        >
          <OOTDShortsFeed />
        </Suspense>
      </div>
    </div>
  );
};

export default QuicksPage;
