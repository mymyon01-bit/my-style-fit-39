import { useEffect, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import PillTabs from "@/components/ui/PillTabs";
import OOTDCard, { type OOTDCardPost, type OOTDCardProfile } from "@/components/OOTDCard";
import ImageLightbox from "@/components/ootd/ImageLightbox";
import OOTDUploadSheet from "@/components/OOTDUploadSheet";
import CrownedBoard from "@/components/CrownedBoard";
import HotShowroomSection from "@/components/showroom/HotShowroomSection";
import { Plus, Loader2 } from "lucide-react";

type Tab = "for-you" | "following" | "ranking" | "showrooms";

const TAB_ALIASES: Record<string, Tab> = {
  "feed": "for-you",
  "for-you": "for-you",
  "foryou": "for-you",
  "following": "following",
  "ranking": "ranking",
  "showroom": "showrooms",
  "showrooms": "showrooms",
};

/**
 * FeedPage — the NEW, minimal feed shell.
 *
 *  • One PageHeader (title + subtitle + create CTA).
 *  • Compact PillTabs as in-page filter (For You / Following / Ranking /
 *    Showrooms). NOT a second nav bar.
 *  • Body switches only its content panel — chrome stays mounted.
 *
 *  All OOTD chrome (graffiti, neon bar, space background, waves sidebar,
 *  customize modal, second large menu, "My" sub-tab inside Feed) has been
 *  REMOVED — those features live in /profile (My) or are reachable via the
 *  upload CTA. Existing data + post detail logic is reused unchanged.
 */
const FeedPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialTab = (() => {
    const raw = searchParams.get("tab")?.toLowerCase();
    return (raw && TAB_ALIASES[raw]) || "for-you";
  })();
  const [tab, setTab] = useState<Tab>(initialTab);

  const setTabAndUrl = (next: Tab) => {
    setTab(next);
    const params = new URLSearchParams(searchParams);
    if (next === "for-you") params.delete("tab");
    else params.set("tab", next);
    setSearchParams(params, { replace: true });
  };

  // Posts state
  const [posts, setPosts] = useState<OOTDCardPost[]>([]);
  const [profiles, setProfiles] = useState<Record<string, OOTDCardProfile>>({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  const loadFollowingIds = useCallback(async (): Promise<string[] | null> => {
    if (!user) return null;
    const { data } = await (supabase as any)
      .from("circles")
      .select("following_id")
      .eq("follower_id", user.id);
    return ((data || []) as any[]).map((r) => r.following_id);
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        if (tab === "ranking" || tab === "showrooms") {
          if (!cancelled) setLoading(false);
          return;
        }

        let q = supabase
          .from("ootd_posts")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(30);

        if (tab === "following") {
          const ids = await loadFollowingIds();
          if (!ids || ids.length === 0) {
            if (!cancelled) {
              setPosts([]);
              setLoading(false);
            }
            return;
          }
          q = q.in("user_id", ids);
        }

        const { data } = await q;
        const rows = (data || []) as OOTDCardPost[];
        if (cancelled) return;
        setPosts(rows);

        const uids = Array.from(new Set(rows.map((r) => r.user_id)));
        if (uids.length) {
          const { data: profs } = await supabase
            .from("profiles")
            .select("user_id, display_name, avatar_url, username, is_official")
            .in("user_id", uids);
          const map: Record<string, OOTDCardProfile> = {};
          (profs || []).forEach((p: any) => (map[p.user_id] = p));
          if (!cancelled) setProfiles(map);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tab, user, loadFollowingIds]);

  const openPost = (p: OOTDCardPost) => setSelected(p);

  const tabs = [
    { value: "for-you" as const, label: "For You" },
    { value: "following" as const, label: "Following" },
    { value: "ranking" as const, label: "Ranking" },
    { value: "showrooms" as const, label: "Showrooms" },
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Feed"
        subtitle="OOTD, rankings, and style inspiration"
        action={
          <button
            onClick={() => {
              if (!user) {
                navigate("/auth");
                return;
              }
              setUploadOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3.5 py-2 text-[12.5px] font-medium text-foreground transition-colors hover:bg-secondary md:text-[13px]"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2} /> Post
          </button>
        }
      />

      <PillTabs tabs={tabs} value={tab} onChange={setTabAndUrl} className="mb-6" />

      <div className="min-h-[40vh]">
        {tab === "ranking" && (
          <CrownedBoard onPostClick={(p) => setSelected(p as any)} />
        )}

        {tab === "showrooms" && <HotShowroomSection />}

        {(tab === "for-you" || tab === "following") && (
          <>
            {loading && (
              <div className="flex justify-center py-16">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}
            {!loading && posts.length === 0 && (
              <div className="rounded-2xl border border-border/60 bg-card px-6 py-16 text-center">
                <p className="text-[14px] text-muted-foreground">
                  {tab === "following"
                    ? "Follow people to see their OOTDs here."
                    : "No posts yet. Be the first."}
                </p>
              </div>
            )}
            {!loading && posts.length > 0 && (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5">
                {posts.map((p, i) => (
                  <OOTDCard
                    key={p.id}
                    post={p}
                    profile={profiles[p.user_id] || null}
                    index={i}
                    showAuthor
                    onOpen={openPost}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <ImageLightbox
        images={selected ? [selected.image_url] : []}
        open={!!selected}
        onClose={() => setSelected(null)}
      />


      <OOTDUploadSheet
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onPosted={() => {
          setUploadOpen(false);
          // refetch
          setTab((t) => t);
        }}
      />
    </PageContainer>
  );
};

export default FeedPage;
