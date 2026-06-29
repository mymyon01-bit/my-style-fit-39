/**
 * QuicksSection — Stories rail + short-form video feed.
 * Renders inside the OOTD shell as one of the editorial tabs.
 */
import { Suspense, lazy, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const OOTDShortsFeed = lazy(() => import("@/components/ootd/OOTDShortsFeed"));

interface StoryUser {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
}

const QuicksSection = () => {
  const navigate = useNavigate();
  const [stories, setStories] = useState<StoryUser[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
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
        .slice(0, 14)
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
    <div className="mx-auto w-full max-w-md px-0 pb-10 lg:max-w-none">
      <div className="border-b border-border/40 pb-4">
        <div className="flex gap-3 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
                    <img src={s.avatar_url} alt={s.display_name ?? ""} className="h-full w-full object-cover" loading="lazy" />
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
  );
};

export default QuicksSection;
