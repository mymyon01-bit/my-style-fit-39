import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { mockOOTDPosts } from "@/lib/mockData";
import { Star, Plus, Shirt } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AuthGate } from "@/components/AuthGate";

const OOTDPage = () => {
  const { t } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [starsLeft, setStarsLeft] = useState(3);
  const [starredPosts, setStarredPosts] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<"dailyTop" | "weeklyTop" | "allTime">("dailyTop");

  const sortedPosts = [...mockOOTDPosts].sort((a, b) => b.stars - a.stars);
  const topCreators = [...new Map(sortedPosts.map(p => [p.creator, p])).values()].slice(0, 5);

  const handleStar = (postId: string) => {
    if (starsLeft <= 0 || starredPosts.has(postId)) return;
    setStarsLeft(prev => prev - 1);
    setStarredPosts(prev => new Set(prev).add(postId));
  };

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
          <h1 className="font-display text-xl font-bold tracking-wide text-foreground">
            {t("ootd")}
          </h1>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1">
              <Star className="h-3 w-3 fill-[hsl(var(--star))] text-[hsl(var(--star))]" />
              <span className="text-[11px] font-semibold text-foreground">{user ? starsLeft : 0}</span>
            </div>
            <AuthGate action="post your outfits">
              <button className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Plus className="h-4 w-4" />
              </button>
            </AuthGate>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-lg">
        {/* Guest banner */}
        {!user && (
          <div className="mx-4 mt-3 rounded-2xl border border-accent/20 bg-accent/5 p-3.5 text-center">
            <p className="text-xs text-muted-foreground">
              You're browsing as a guest.{" "}
              <button onClick={() => navigate("/auth")} className="font-semibold text-accent">
                Sign up
              </button>{" "}
              to give stars and post outfits.
            </p>
          </div>
        )}

        {/* Tab filters */}
        <div className="flex gap-1 px-4 pt-3">
          {(["dailyTop", "weeklyTop", "allTime"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 rounded-lg py-2 text-xs font-medium transition-colors ${
                activeTab === tab
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary"
              }`}
            >
              {t(tab)}
            </button>
          ))}
        </div>

        {/* Top Creators */}
        <div className="px-4 pt-4 pb-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("topCreators")}
          </p>
          <div className="mt-2.5 flex gap-3 overflow-x-auto scrollbar-hide">
            {topCreators.map((post, i) => (
              <div key={post.id} className="flex flex-col items-center gap-1">
                <div className={`relative rounded-full p-0.5 ${i === 0 ? "bg-gradient-to-br from-[hsl(var(--star))] to-[hsl(var(--accent))]" : "bg-border"}`}>
                  <img
                    src={post.avatar}
                    alt={post.creator}
                    className="h-14 w-14 rounded-full object-cover border-2 border-background"
                    loading="lazy"
                  />
                  {i < 3 && (
                    <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-[hsl(var(--star))] text-[9px] font-bold text-foreground">
                      {i + 1}
                    </span>
                  )}
                </div>
                <span className="max-w-[60px] truncate text-[10px] text-muted-foreground">{post.creator}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Feed */}
        <div className="space-y-4 px-4 pt-2 pb-4">
          {sortedPosts.map((post, index) => {
            const isStarred = starredPosts.has(post.id);
            const isTop3 = index < 3;

            return (
              <div
                key={post.id}
                className={`overflow-hidden rounded-2xl border bg-card shadow-card transition-all ${
                  isTop3 ? "border-[hsl(var(--star)_/_0.3)]" : "border-border"
                }`}
              >
                {/* Image */}
                <div className="relative aspect-[3/4] overflow-hidden">
                  <img
                    src={post.image}
                    alt={post.caption}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                  {/* Overlay */}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-4 pt-16">
                    <div className="flex items-end justify-between">
                      <div className="flex items-center gap-2">
                        <img
                          src={post.avatar}
                          alt={post.creator}
                          className="h-8 w-8 rounded-full border border-white/30 object-cover"
                        />
                        <div>
                          <p className="text-sm font-semibold text-white">{post.creator}</p>
                          <p className="text-[10px] text-white/70">{post.caption}</p>
                        </div>
                      </div>
                      {/* Star button — gated */}
                      <AuthGate action="give stars">
                        <button
                          onClick={() => handleStar(post.id)}
                          disabled={starsLeft <= 0 && !isStarred}
                          className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold backdrop-blur-sm transition-all ${
                            isStarred
                              ? "bg-[hsl(var(--star)_/_0.9)] text-black"
                              : "bg-white/20 text-white hover:bg-white/30"
                          }`}
                        >
                          <Star className={`h-3.5 w-3.5 ${isStarred ? "fill-current" : ""}`} />
                          <span>{post.stars + (isStarred ? 1 : 0)}</span>
                        </button>
                      </AuthGate>
                    </div>
                  </div>
                  {/* Rank badge */}
                  {isTop3 && (
                    <div className="absolute left-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-[hsl(var(--star))] text-xs font-bold text-black shadow-lg">
                      {index + 1}
                    </div>
                  )}
                </div>

                {/* Tags + Actions */}
                <div className="p-3">
                  <div className="flex flex-wrap gap-1.5">
                    {Object.values(post.tags).map(tag => (
                      <span key={tag} className="rounded-full bg-secondary px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="mt-2.5 flex gap-2">
                    <button className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-secondary py-2 text-xs font-medium text-secondary-foreground transition-colors hover:bg-muted">
                      <Shirt className="h-3.5 w-3.5" />
                      {t("viewItems")}
                    </button>
                    <AuthGate action="try on looks">
                      <button
                        onClick={() => post.items[0] && navigate(`/fit/${post.items[0].id}`)}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary py-2 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
                      >
                        {t("tryThisLook")}
                      </button>
                    </AuthGate>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default OOTDPage;
