import { memo } from "react";
import { motion } from "framer-motion";
import { Heart, Star, Edit3, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

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
  avatar_url: string | null;
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
  const initial = (profile?.display_name?.[0] || "?").toUpperCase();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: Math.min(index * 0.02, 0.3) }}
      className="cursor-pointer group relative"
      onClick={() => onOpen(post)}
    >
      <div className="relative overflow-hidden rounded-lg aspect-[3/4] bg-foreground/[0.04]">
        <img
          src={post.image_url}
          alt={post.caption || ""}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          loading="lazy"
        />

        {/* Avatar — community feed only */}
        {showAuthor && !isMyPage && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/u/${post.user_id}`);
            }}
            className="absolute top-2 left-2 z-10"
            aria-label={profile?.display_name || "View profile"}
          >
            <div className="h-9 w-9 rounded-full overflow-hidden ring-2 ring-white/90 shadow-md bg-foreground/20 backdrop-blur-sm">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.display_name || ""}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[11px] font-semibold text-white">
                  {initial}
                </div>
              )}
            </div>
          </button>
        )}

        {/* Footer overlay: title + counters */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 to-transparent p-1.5 pt-6">
          {title && (
            <p className="text-[8px] font-semibold text-white/80 truncate">{title}</p>
          )}
          {showAuthor && !title && (
            <p className="text-[8px] font-medium text-white/70 truncate">
              {profile?.display_name || "Anonymous"}
            </p>
          )}
          <div className="flex items-center gap-1.5 mt-0.5">
            {likes > 0 && (
              <span className="flex items-center gap-0.5">
                <Heart className="h-2 w-2 text-white/60" />
                <span className="text-[7px] text-white/60">{likes}</span>
              </span>
            )}
            {stars > 0 && (
              <span className="flex items-center gap-0.5">
                <Star className="h-2 w-2 fill-[hsl(var(--star))] text-[hsl(var(--star))]" />
                <span className="text-[7px] text-white/70">{stars}</span>
              </span>
            )}
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
    prev.showAuthor === next.showAuthor &&
    prev.isMyPage === next.isMyPage
  );
});

export default OOTDCard;
