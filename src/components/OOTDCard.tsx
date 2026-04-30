import { memo } from "react";
import { motion } from "framer-motion";
import { Heart, Star, Edit3, Trash2, MessageCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { OfficialBadge, OfficialAvatarRing } from "@/components/OfficialBadge";
import { formatCount } from "@/lib/formatCount";

/**
 * Hardcoded, reusable OOTD card frame.
 * Structure is fixed; only the data inside the slots changes between posts.
 *
 *   [ avatar ]         <-- top-left, optional
 *   [ media (3:4) ]    <-- fixed aspect ratio
 *   [ title / author ] <-- caption first word OR display name
 *   [ likes · stars ]  <-- counters
 *
 * On My Page: edit + delete actions appear in the top-right on hover.
 */

export interface OOTDCardPost {
  id: string;
  user_id: string;
  image_url: string;
  caption: string | null;
  star_count: number | null;
  like_count: number | null;
}

export interface OOTDCardProfile {
  user_id: string;
  display_name: string | null;
  username?: string | null;
  avatar_url: string | null;
  is_official?: boolean | null;
}

interface Props {
  post: OOTDCardPost;
  profile: OOTDCardProfile | null;
  index?: number;
  showAuthor?: boolean;
  isMyPage?: boolean;
  onOpen: (post: OOTDCardPost) => void;
  onEdit?: (post: OOTDCardPost) => void;
  onDelete?: (postId: string) => void;
}

function OOTDCardImpl({
  post,
  profile,
  index = 0,
  showAuthor = true,
  isMyPage = false,
  onOpen,
  onEdit,
  onDelete,
}: Props) {
  const navigate = useNavigate();
  const likes = post.like_count || 0;
  const stars = post.star_count || 0;
  const title = post.caption ? post.caption.split(/\s+/)[0] : null;
  // OOTD 표시 이름은 항상 username(@핸들). display_name은 폴백/이니셜용.
  const handleName = profile?.username || profile?.display_name || "anonymous";
  const initial = (profile?.username?.[0] || profile?.display_name?.[0] || "?").toUpperCase();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: Math.min(index * 0.02, 0.3) }}
      className="cursor-pointer group relative"
      onClick={() => onOpen(post)}
    >
      <div className="relative overflow-hidden rounded-lg aspect-square bg-foreground/[0.04]">
        <img
          src={post.image_url}
          alt={post.caption || ""}
          className="w-full h-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.02]"
          loading="lazy"
        />

        {/* Bottom gradient — readable footer */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 via-black/25 to-transparent p-2 pt-10">
          <div className="flex items-end justify-between gap-2">
            {/* Bottom-left: profile avatar (community feed only) */}
            {showAuthor && !isMyPage ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/user/${post.user_id}`);
                }}
                className="flex items-center gap-1.5 min-w-0"
                aria-label={profile?.display_name || "View profile"}
              >
                <OfficialAvatarRing isOfficial={profile?.is_official}>
                  <div className="h-7 w-7 rounded-full overflow-hidden ring-1 ring-white/80 shadow-md bg-foreground/20 backdrop-blur-sm shrink-0">
                    {profile?.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt={profile.display_name || ""}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[9px] font-semibold text-white">
                        {initial}
                      </div>
                    )}
                  </div>
                </OfficialAvatarRing>
                <span className="flex items-center gap-1 min-w-0">
                  <span className="text-[9px] font-medium text-white/85 truncate max-w-[80px]">
                    {profile?.display_name || "Anonymous"}
                  </span>
                  {profile?.is_official && <OfficialBadge compact className="text-white" />}
                </span>
              </button>
            ) : (
              <div className="min-w-0">
                {title && (
                  <p className="text-[9px] font-semibold text-white/85 truncate">{title}</p>
                )}
              </div>
            )}

            {/* Bottom-right: comment + counters */}
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="flex items-center gap-1 rounded-full bg-black/35 backdrop-blur-md px-1.5 py-0.5 ring-1 ring-white/10">
                <Heart className={`h-3 w-3 ${likes > 0 ? "fill-rose-400 text-rose-400" : "text-white/80"}`} />
                <span className="text-[9px] font-semibold text-white tabular-nums">{formatCount(likes)}</span>
              </span>
              {stars > 0 && (
                <span className="flex items-center gap-1 rounded-full bg-black/35 backdrop-blur-md px-1.5 py-0.5 ring-1 ring-white/10">
                  <Star className="h-3 w-3 fill-[hsl(var(--star))] text-[hsl(var(--star))]" />
                  <span className="text-[9px] font-semibold text-white tabular-nums">{formatCount(stars)}</span>
                </span>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpen(post);
                }}
                className="rounded-full bg-white/15 p-1.5 text-white backdrop-blur-sm hover:bg-white/25 transition-colors"
                aria-label="Add a comment"
              >
                <MessageCircle className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* My Page actions */}
      {isMyPage && (onEdit || onDelete) && (
        <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          {onEdit && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(post);
              }}
              className="rounded-full bg-black/50 p-1 text-white/70 hover:text-white backdrop-blur-sm"
              aria-label="Edit post"
            >
              <Edit3 className="h-2.5 w-2.5" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(post.id);
              }}
              className="rounded-full bg-black/50 p-1 text-white/70 hover:text-destructive backdrop-blur-sm"
              aria-label="Delete post"
            >
              <Trash2 className="h-2.5 w-2.5" />
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
}

/**
 * Memoized so the feed only re-renders cards whose data actually changed.
 * Comparison is shallow on the fields the card uses for display.
 */
const OOTDCard = memo(OOTDCardImpl, (prev, next) => {
  return (
    prev.post.id === next.post.id &&
    prev.post.image_url === next.post.image_url &&
    prev.post.caption === next.post.caption &&
    prev.post.like_count === next.post.like_count &&
    prev.post.star_count === next.post.star_count &&
    prev.profile?.avatar_url === next.profile?.avatar_url &&
    prev.profile?.display_name === next.profile?.display_name &&
    prev.profile?.is_official === next.profile?.is_official &&
    prev.showAuthor === next.showAuthor &&
    prev.isMyPage === next.isMyPage
  );
});

export default OOTDCard;
