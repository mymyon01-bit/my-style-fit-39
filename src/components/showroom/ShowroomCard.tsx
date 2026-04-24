import { Link } from "react-router-dom";
import { Star, Heart, Eye, Pin } from "lucide-react";
import { getTheme } from "@/lib/showroom/themes";
import type { Showroom } from "@/lib/showroom/types";

/**
 * Showroom card — always readable regardless of theme.
 * Banner area uses theme bg as a mood preview; title block sits below
 * on a solid card surface so text is always legible.
 */
export const ShowroomCard = ({ room }: { room: Showroom }) => {
  const theme = getTheme(room.theme);
  return (
    <Link
      to={`/showroom/${room.id}`}
      className="group relative block overflow-hidden rounded-xl border border-border/40 bg-card transition-all hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-lg"
    >
      {/* Mood banner (theme preview) */}
      <div className={`relative aspect-[4/3] overflow-hidden ${theme.bgClass}`}>
        {room.banner_url ? (
          <img
            src={room.banner_url}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-display text-2xl opacity-30">{theme.label.charAt(0)}</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
        {room.is_pinned && (
          <div className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-background/90 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wider text-foreground">
            <Pin className="h-2.5 w-2.5" /> Pinned
          </div>
        )}
        <div className="absolute right-2 top-2 rounded-full bg-background/80 px-1.5 py-0.5 text-[8px] font-medium uppercase tracking-wider text-foreground/80 backdrop-blur-sm">
          {theme.label}
        </div>
      </div>

      {/* Title block — solid surface, always readable */}
      <div className="space-y-1 p-3">
        <h3 className="line-clamp-1 font-display text-sm leading-tight text-foreground">{room.title}</h3>
        {room.intro && (
          <p className="line-clamp-1 text-[10px] leading-snug text-foreground/55">{room.intro}</p>
        )}
        <div className="flex items-center gap-3 pt-1 text-[10px] text-foreground/60">
          <span className="flex items-center gap-1"><Star className="h-3 w-3" />{room.star_count}</span>
          <span className="flex items-center gap-1"><Heart className="h-3 w-3" />{room.like_count}</span>
          <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{room.view_count}</span>
        </div>
      </div>
    </Link>
  );
};
