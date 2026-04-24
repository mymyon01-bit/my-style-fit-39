import { Link } from "react-router-dom";
import { Star, Heart, Eye, Pin } from "lucide-react";
import { getTheme } from "@/lib/showroom/themes";
import type { Showroom } from "@/lib/showroom/types";

export const ShowroomCard = ({ room }: { room: Showroom }) => {
  const theme = getTheme(room.theme);
  return (
    <Link
      to={`/showroom/${room.id}`}
      className={`group relative block overflow-hidden rounded-xl ${theme.bgClass} aspect-[4/5] transition-transform hover:-translate-y-0.5`}
    >
      {room.banner_url ? (
        <img src={room.banner_url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-60" loading="lazy" />
      ) : null}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
      {room.is_pinned && (
        <div className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-stone-900">
          <Pin className="h-2.5 w-2.5" /> Pinned
        </div>
      )}
      <div className="absolute right-3 top-3 rounded-full bg-black/40 px-2 py-0.5 text-[9px] uppercase tracking-wider text-white backdrop-blur-sm">
        {theme.label}
      </div>
      <div className="absolute inset-x-0 bottom-0 p-4 text-white">
        <h3 className="font-display text-lg leading-tight">{room.title}</h3>
        {room.intro && <p className="mt-0.5 line-clamp-1 text-[11px] opacity-80">{room.intro}</p>}
        <div className="mt-2 flex items-center gap-3 text-[10px] opacity-90">
          <span className="flex items-center gap-1"><Star className="h-3 w-3" />{room.star_count}</span>
          <span className="flex items-center gap-1"><Heart className="h-3 w-3" />{room.like_count}</span>
          <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{room.view_count}</span>
        </div>
      </div>
    </Link>
  );
};
