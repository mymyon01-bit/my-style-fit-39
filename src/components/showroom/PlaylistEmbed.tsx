import { Music } from "lucide-react";
import type { PlaylistLink } from "@/lib/showroom/types";

const toEmbedUrl = (link: PlaylistLink): string | null => {
  const url = link.url;
  try {
    const u = new URL(url);
    if (link.provider === "spotify" || u.host.includes("spotify")) {
      // https://open.spotify.com/playlist/XYZ → /embed/playlist/XYZ
      const path = u.pathname.replace(/^\/(intl-[a-z]{2}\/)?/, "/");
      return `https://open.spotify.com${path.replace(/^\/(playlist|album|track|artist)/, "/embed/$1")}`;
    }
    if (link.provider === "youtube" || u.host.includes("youtu")) {
      // playlist?list=ID
      const list = u.searchParams.get("list");
      const v = u.searchParams.get("v");
      if (list) return `https://www.youtube.com/embed/videoseries?list=${list}`;
      if (v) return `https://www.youtube.com/embed/${v}`;
      const id = u.pathname.split("/").filter(Boolean).pop();
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
    if (link.provider === "apple" || u.host.includes("apple")) {
      return url.replace("music.apple.com", "embed.music.apple.com");
    }
  } catch {/* ignore */}
  return null;
};

export const PlaylistEmbed = ({ link }: { link: PlaylistLink }) => {
  const embed = toEmbedUrl(link);
  const isSpotify = link.provider === "spotify";
  const isYouTube = link.provider === "youtube";

  if (embed) {
    return (
      <iframe
        src={embed}
        loading="lazy"
        allow="autoplay; encrypted-media; clipboard-write; picture-in-picture"
        sandbox="allow-scripts allow-same-origin allow-popups allow-presentation"
        className="w-full rounded-lg border border-foreground/10"
        style={{
          height: isYouTube ? 200 : isSpotify ? 152 : 175,
        }}
        title={link.label || "Playlist"}
      />
    );
  }
  return (
    <a
      href={link.url}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-2 rounded-lg border border-foreground/10 bg-foreground/5 px-3 py-2 text-xs hover:bg-foreground/10"
    >
      <Music className="h-3.5 w-3.5" />
      <span className="truncate">{link.label || link.url}</span>
    </a>
  );
};
