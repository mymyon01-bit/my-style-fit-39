export interface TodayLookPiece {
  id?: string;
  name: string;
  color: string;
  category: string;
  brand?: string | null;
  image_url?: string | null;
  price?: string | null;
  source_url?: string | null;
}

export interface TodayLook {
  id: string;
  title: string;
  vibe: string;
  pieces: TodayLookPiece[];
  reason: string;
  weatherTag: string;
}
