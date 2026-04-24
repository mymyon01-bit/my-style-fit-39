export type ShowroomVisibility = "public" | "private" | "invite_only";

export interface PlaylistLink {
  url: string;
  label?: string;
  provider?: "spotify" | "youtube" | "apple" | "other";
}

export interface Showroom {
  id: string;
  user_id: string;
  title: string;
  intro: string | null;
  theme: string;
  background_url: string | null;
  banner_url: string | null;
  theme_color: string | null;
  hashtags: string[];
  playlist_links: PlaylistLink[];
  visibility: ShowroomVisibility;
  is_pinned: boolean;
  best_item_id: string | null;
  star_count: number;
  like_count: number;
  save_count: number;
  view_count: number;
  created_at: string;
  updated_at: string;
}

export interface ShowroomItem {
  id: string;
  showroom_id: string;
  source_type: "discover" | "ootd" | "saved" | "image";
  product_id: string | null;
  image_url: string | null;
  title: string | null;
  brand: string | null;
  note: string | null;
  hashtags: string[];
  position_order: number;
  created_at: string;
}

export const detectPlaylistProvider = (url: string): PlaylistLink["provider"] => {
  const u = url.toLowerCase();
  if (u.includes("spotify.com") || u.includes("open.spotify")) return "spotify";
  if (u.includes("youtube.com") || u.includes("youtu.be") || u.includes("music.youtube")) return "youtube";
  if (u.includes("music.apple.com") || u.includes("apple.com/music")) return "apple";
  return "other";
};
