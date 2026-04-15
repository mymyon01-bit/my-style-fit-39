import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { mockOOTDPosts } from "@/lib/mockData";
import { Star } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AuthGate } from "@/components/AuthGate";
import NavDropdown from "@/components/NavDropdown";

const OOTDPage = () => {
  const { t } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [starsLeft, setStarsLeft] = useState(3);
  const [starredPosts, setStarredPosts] = useState<Set<string>>(new Set());

  const sortedPosts = [...mockOOTDPosts].sort((a, b) => b.stars - a.stars);

  const handleStar = (postId: string) => {
    if (starsLeft <= 0 || starredPosts.has(postId)) return;
    setStarsLeft(prev => prev - 1);
    setStarredPosts(prev => new Set(prev).add(postId));
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-lg items-center justify-between px-6 py-4">
          <NavDropdown />
          <div className="flex items-center gap-3">
            {user && (
              <div className="flex items-center gap-1 rounded-full bg-foreground/[0.04] px-2.5 py-1">
                <Star className="h-3 w-3 fill-[hsl(var(--star))] text-[hsl(var(--star))]" />
                <span className="text-[10px] font-semibold text-foreground/50">{starsLeft}</span>
              </div>
            )}
            <span className="text-[10px] font-semibold tracking-[0.2em] text-foreground/30">OOTD</span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-lg px-6">
        {/* Guest hint */}
        {!user && (
          <p className="pb-4 text-center text-[11px] text-foreground/25">
            <button onClick={() => navigate("/auth")} className="text-foreground/40 underline underline-offset-2">
              Sign in
            </button>{" "}
            to give stars and post outfits
          </p>
        )}

        {/* Clean feed — just images and interaction */}
        <div className="space-y-6 pb-12">
          {sortedPosts.map((post, index) => {
            const isStarred = starredPosts.has(post.id);

            return (
              <div key={post.id} className="group">
                {/* Image */}
                <div className="relative overflow-hidden rounded-xl">
                  <img
                    src={post.image}
                    alt={post.caption}
                    className="aspect-[3/4] w-full object-cover"
                    loading="lazy"
                  />
                  {/* Minimal overlay */}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 to-transparent p-4 pt-20">
                    <div className="flex items-end justify-between">
                      <div className="flex items-center gap-2">
                        <img
                          src={post.avatar}
                          alt={post.creator}
                          className="h-7 w-7 rounded-full border border-white/20 object-cover"
                        />
                        <span className="text-[11px] font-medium text-white/80">{post.creator}</span>
                      </div>
                      <AuthGate action="give stars">
                        <button
                          onClick={() => handleStar(post.id)}
                          disabled={starsLeft <= 0 && !isStarred}
                          className={`flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] font-semibold backdrop-blur-sm transition-all ${
                            isStarred
                              ? "bg-[hsl(var(--star)_/_0.9)] text-black"
                              : "bg-white/15 text-white/80 hover:bg-white/25"
                          }`}
                        >
                          <Star className={`h-3 w-3 ${isStarred ? "fill-current" : ""}`} />
                          {post.stars + (isStarred ? 1 : 0)}
                        </button>
                      </AuthGate>
                    </div>
                  </div>

                  {/* Rank — only top 3 */}
                  {index < 3 && (
                    <div className="absolute left-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-[hsl(var(--star))] text-[10px] font-bold text-black">
                      {index + 1}
                    </div>
                  )}
                </div>

                {/* Caption only — no tags, no buttons */}
                {post.caption && (
                  <p className="mt-2 text-[11px] font-light text-foreground/40">{post.caption}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default OOTDPage;
