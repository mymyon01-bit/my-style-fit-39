import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Music, Search, X, Loader2, Play, Pause, Trash2 } from "lucide-react";

/**
 * Cyworld-style "Song of the Day" picker.
 *
 * Lets the user search for a track and pin it as the soundtrack of their
 * profile page. We use Apple's iTunes Search API because it requires no
 * auth, returns Spotify-compatible metadata (artist, track, art, 30s
 * preview), and is generally the closest free analog to a Spotify search.
 *
 * The selection is persisted to localStorage so it survives reloads, and
 * a global event lets the page render the chosen track elsewhere if it
 * wants to.
 */
export interface SongOfDay {
  id: string;
  title: string;
  artist: string;
  artwork: string;
  preview: string;
  spotifyUrl: string;
}

const STORAGE_KEY = "ootd-song-of-the-day";

export function loadSongOfDay(): SongOfDay | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SongOfDay;
  } catch {
    return null;
  }
}

export function saveSongOfDay(song: SongOfDay | null) {
  try {
    if (song) localStorage.setItem(STORAGE_KEY, JSON.stringify(song));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {}
  try { window.dispatchEvent(new CustomEvent("ootd-sotd-change", { detail: song })); } catch {}
}

interface ITunesResult {
  trackId: number;
  trackName: string;
  artistName: string;
  artworkUrl100: string;
  previewUrl?: string;
  trackViewUrl?: string;
}

interface Props {
  value: SongOfDay | null;
  onChange: (song: SongOfDay | null) => void;
}

export default function SongOfTheDayPicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ITunesResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [playingId, setPlayingId] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Lock body scroll & stop playback when the modal closes.
  useEffect(() => {
    if (!open) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Debounced iTunes search. The endpoint is CORS-friendly and free.
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 2) { setResults([]); return; }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const url = `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=music&entity=song&limit=20`;
        const res = await fetch(url);
        const json = await res.json();
        setResults((json.results || []) as ITunesResult[]);
      } catch (e) {
        console.warn("[sotd] search failed", e);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, open]);

  const togglePreview = (track: ITunesResult) => {
    if (!track.previewUrl) return;
    if (playingId === track.trackId) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    if (audioRef.current) audioRef.current.pause();
    const audio = new Audio(track.previewUrl);
    audio.volume = 0.7;
    audio.play().catch(() => {});
    audio.onended = () => setPlayingId(null);
    audioRef.current = audio;
    setPlayingId(track.trackId);
  };

  const pickTrack = (t: ITunesResult) => {
    audioRef.current?.pause();
    setPlayingId(null);
    const artwork = t.artworkUrl100?.replace("100x100", "300x300") ?? t.artworkUrl100;
    const spotifyUrl = `https://open.spotify.com/search/${encodeURIComponent(`${t.trackName} ${t.artistName}`)}`;
    const song: SongOfDay = {
      id: String(t.trackId),
      title: t.trackName,
      artist: t.artistName,
      artwork,
      preview: t.previewUrl ?? "",
      spotifyUrl,
    };
    saveSongOfDay(song);
    onChange(song);
    setOpen(false);
    setQuery("");
    setResults([]);
  };

  const clearSong = () => {
    saveSongOfDay(null);
    onChange(null);
  };

  const modal = open ? (
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/65 backdrop-blur-sm animate-fade-in"
      onClick={() => setOpen(false)}
    >
      <div
        className="relative w-full sm:max-w-md mx-auto rounded-t-3xl sm:rounded-3xl border border-border/40 bg-card p-5 shadow-2xl animate-scale-in max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1 shrink-0">
          <div className="flex items-center gap-2">
            <Music className="h-3.5 w-3.5 text-accent" />
            <h3 className="text-[12px] font-medium tracking-[0.2em] text-foreground/85">
              SONG OF THE DAY
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-full p-1 text-foreground/50 hover:text-foreground hover:bg-foreground/5 transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-[11px] text-foreground/55 leading-relaxed mb-3 shrink-0">
          Pick the track that scores your day — Cyworld-style.
        </p>

        {/* Currently selected */}
        {value && (
          <div className="mb-3 flex items-center gap-3 rounded-xl border border-accent/30 bg-accent/5 p-2.5 shrink-0">
            <img src={value.artwork} alt="" className="h-10 w-10 rounded-md object-cover" />
            <div className="flex-1 min-w-0">
              <p className="text-[11.5px] font-medium text-foreground/90 truncate">{value.title}</p>
              <p className="text-[10px] text-foreground/55 truncate">{value.artist}</p>
            </div>
            <button
              type="button"
              onClick={clearSong}
              className="rounded-full p-1.5 text-foreground/45 hover:text-destructive hover:bg-destructive/10 transition-colors"
              aria-label="Remove song"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Search input */}
        <div className="relative mb-3 shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-foreground/40" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a song or artist…"
            className="w-full rounded-full border border-border/40 bg-background/60 pl-9 pr-3 py-2 text-[12px] outline-none focus:border-accent/60"
          />
          {loading && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-foreground/40 animate-spin" />
          )}
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto -mx-1 px-1">
          {results.length === 0 && !loading && query.trim().length >= 2 && (
            <p className="py-6 text-center text-[11px] text-foreground/45">No results found.</p>
          )}
          {results.length === 0 && query.trim().length < 2 && (
            <p className="py-6 text-center text-[11px] text-foreground/45">
              Try “Coldplay”, “IU”, “New Jeans”…
            </p>
          )}
          <ul className="space-y-1.5">
            {results.map((t) => {
              const isPlaying = playingId === t.trackId;
              return (
                <li
                  key={t.trackId}
                  className="flex items-center gap-3 rounded-xl border border-border/30 bg-background/40 p-2 hover:border-accent/40 hover:bg-accent/5 transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => togglePreview(t)}
                    disabled={!t.previewUrl}
                    className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md disabled:opacity-50"
                    aria-label={isPlaying ? "Pause preview" : "Play preview"}
                  >
                    <img src={t.artworkUrl100} alt="" className="h-full w-full object-cover" />
                    {t.previewUrl && (
                      <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 hover:opacity-100 transition-opacity">
                        {isPlaying ? <Pause className="h-4 w-4 text-white" /> : <Play className="h-4 w-4 text-white" />}
                      </span>
                    )}
                    {isPlaying && (
                      <span className="absolute inset-0 flex items-center justify-center bg-black/50">
                        <Pause className="h-4 w-4 text-white" />
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => pickTrack(t)}
                    className="flex-1 min-w-0 text-left"
                  >
                    <p className="text-[11.5px] font-medium text-foreground/90 truncate">{t.trackName}</p>
                    <p className="text-[10px] text-foreground/55 truncate">{t.artistName}</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => pickTrack(t)}
                    className="shrink-0 rounded-full bg-accent px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wider text-background hover:opacity-90"
                  >
                    Pick
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-full border border-border/40 bg-background/60 backdrop-blur px-3 py-1.5 text-[10px] font-medium tracking-[0.18em] text-foreground/75 hover:border-accent/60 hover:text-accent transition-colors shrink-0"
        aria-label="Pick song of the day"
      >
        <Music className="h-3 w-3" />
        SOTD
        {value ? (
          <span className="text-foreground/40 normal-case tracking-normal text-[10px] truncate max-w-[120px]">
            · {value.title}
          </span>
        ) : (
          <span className="text-foreground/40 normal-case tracking-normal text-[10px]">
            · pick a song
          </span>
        )}
      </button>

      {modal && typeof document !== "undefined" && createPortal(modal, document.body)}
    </>
  );
}
