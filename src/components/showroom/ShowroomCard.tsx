import { Link } from "react-router-dom";
import { Star, Heart, Eye, Pin, Sparkles, Users } from "lucide-react";
import type { Showroom } from "@/lib/showroom/types";

export const ShowroomCard = ({ room }: { room: Showroom }) => {
  return (
    <Link
      to={`/showroom/${room.id}`}
      className="group block overflow-hidden rounded-xl border border-border/40 bg-card transition-all hover:-translate-y-0.5 hover:border-accent/30 hover:shadow-sm"
    >
      <div className="relative aspect-[4/3] overflow-hidden border-b border-border/30 bg-gradient-to-br from-accent/[0.08] via-secondary/40 to-background">
        {room.banner_url ? (
          <img
            src={room.banner_url}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border/30 bg-background/70 text-accent/70 backdrop-blur-sm">
              <Sparkles className="h-5 w-5" />
            </div>
          </div>
        )}

        {room.is_pinned && (
          <div className="absolute inset-x-0 top-0 flex items-center justify-between p-2">
            <span className="inline-flex items-center gap-1 rounded-full border border-border/30 bg-background/85 px-2 py-1 text-[9px] font-medium text-foreground/75 backdrop-blur-sm">
              <Pin className="h-2.5 w-2.5" /> Pinned
            </span>
          </div>
        )}
      </div>

      <div className="space-y-1.5 p-3">
        <h3 className="line-clamp-1 font-display text-sm text-foreground">{room.title}</h3>
        <p className="line-clamp-1 text-[11px] text-foreground/55">{room.intro || "Personal taste curation"}</p>
        <div className="flex items-center gap-3 pt-1 text-[10px] text-foreground/60">
          <span className="inline-flex items-center gap-1"><Star className="h-3 w-3" />{room.star_count}</span>
          <span className="inline-flex items-center gap-1"><Heart className="h-3 w-3" />{room.like_count}</span>
          <span className="inline-flex items-center gap-1"><Eye className="h-3 w-3" />{room.view_count}</span>
        </div>
        <p className="flex items-center gap-1 pt-0.5 text-[10px] text-foreground/55">
          <Users className="h-3 w-3" />
          {room.follower_count} {room.follower_count === 1 ? "follower" : "followers"}
        </p>
      </div>
    </Link>
  );
};
