import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Music,
  Search,
  X,
  Loader2,
  Play,
  Pause,
  Trash2,
  ListMusic,
  Plus,
  SkipForward,
  SkipBack,
  Volume2,
  ExternalLink,
  Check,
} from "lucide-react";

/**
 * Cyworld-style "Song of the Day" + mini playlist.
 *
 * - Pick a featured song (the SOTD), shown in the profile chip.
 * - Build a small playlist on top of that, persisted to localStorage.
 * - When a song is selected, a floating mini-player exposes
 *   play / pause / next / prev controls + track details.
 * - Search powered by the iTunes Search API (free, no auth, CORS-friendly,
 *   30-second previews — closest free analog to a Spotify search).
 */
export interface SongOfDay {
  id: string;
  title: string;
  artist: string;
  artwork: string;
  preview: string;
  spotifyUrl: string;
}

const SOTD_KEY = "ootd-song-of-the-day";
const PLAYLIST_KEY = "ootd-playlist";

// ---------- persistence helpers ----------
export function loadSongOfDay(): SongOfDay | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SOTD_KEY);
    return raw ? (JSON.parse(raw) as SongOfDay) : null;
  } catch {
    return null;
  }
}

export function saveSongOfDay(song: SongOfDay | null) {
  try {
    if (song) localStorage.setItem(SOTD_KEY, JSON.stringify(song));
    else localStorage.removeItem(SOTD_KEY);
  } catch {}
  try {
    window.dispatchEvent(new CustomEvent("ootd-sotd-change", { detail: song }));
  } catch {}
}

function loadPlaylist(): SongOfDay[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(PLAYLIST_KEY);
    return raw ? (JSON.parse(raw) as SongOfDay[]) : [];
  } catch {
    return [];
  }
}

function savePlaylist(list: SongOfDay[]) {
  try {
    localStorage.setItem(PLAYLIST_KEY, JSON.stringify(list));
  } catch {}
}

// ---------- iTunes search types ----------
interface ITunesResult {
  trackId: number;
  trackName: string;
  artistName: string;
  artworkUrl100: string;
  previewUrl?: string;
  trackViewUrl?: string;
}

function toSong(t: ITunesResult): SongOfDay {
  const artwork = t.artworkUrl100?.replace("100x100", "300x300") ?? t.artworkUrl100;
  const spotifyUrl = `https://open.spotify.com/search/${encodeURIComponent(`${t.trackName} ${t.artistName}`)}`;
  return {
    id: String(t.trackId),
    title: t.trackName,
    artist: t.artistName,
    artwork,
    preview: t.previewUrl ?? "",
    spotifyUrl,
  };
}

interface Props {
  value: SongOfDay | null;
  onChange: (song: SongOfDay | null) => void;
}

export default function SongOfTheDayPicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"search" | "playlist">("search");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ITunesResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null); // id being previewed in modal
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  // Persistent playlist
  const [playlist, setPlaylist] = useState<SongOfDay[]>(() => loadPlaylist());
  useEffect(() => {
    savePlaylist(playlist);
  }, [playlist]);

  // Mini-player state (lives outside the modal)
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const playerAudioRef = useRef<HTMLAudioElement | null>(null);

  // The "queue" is: [SOTD, ...playlist] de-duplicated by id
  const queue = useMemo<SongOfDay[]>(() => {
    const list: SongOfDay[] = [];
    if (value) list.push(value);
    for (const s of playlist) if (!list.find((x) => x.id === s.id)) list.push(s);
    return list;
  }, [value, playlist]);

  const currentTrack = currentIndex >= 0 ? queue[currentIndex] ?? null : null;

  // Lock body scroll & stop modal preview when modal closes.
  useEffect(() => {
    if (!open) {
      previewAudioRef.current?.pause();
      setPreviewId(null);
      return;
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Debounced iTunes search.
  useEffect(() => {
    if (!open || tab !== "search") return;
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
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
  }, [query, open, tab]);

  // ----- Modal preview controls -----
  const togglePreview = (song: SongOfDay) => {
    if (!song.preview) return;
    if (previewId === song.id) {
      previewAudioRef.current?.pause();
      setPreviewId(null);
      return;
    }
    previewAudioRef.current?.pause();
    const audio = new Audio(song.preview);
    audio.volume = 0.7;
    audio.play().catch(() => {});
    audio.onended = () => setPreviewId(null);
    previewAudioRef.current = audio;
    setPreviewId(song.id);
  };

  // ----- Selection actions -----
  const setAsSOTD = (t: ITunesResult | SongOfDay) => {
    const song = "trackId" in t ? toSong(t) : t;
    previewAudioRef.current?.pause();
    setPreviewId(null);
    saveSongOfDay(song);
    onChange(song);
    // start playing it
    const idx = 0; // SOTD is always queue[0]
    setCurrentIndex(idx);
    setIsPlaying(true);
  };

  const addToPlaylist = (t: ITunesResult | SongOfDay) => {
    const song = "trackId" in t ? toSong(t) : t;
    setPlaylist((prev) => {
      if (prev.find((s) => s.id === song.id)) return prev;
      return [...prev, song];
    });
  };

  const removeFromPlaylist = (id: string) => {
    setPlaylist((prev) => prev.filter((s) => s.id !== id));
    if (currentTrack?.id === id) {
      setIsPlaying(false);
      setCurrentIndex(-1);
    }
  };

  const clearSong = () => {
    saveSongOfDay(null);
    onChange(null);
    if (currentIndex === 0) {
      setIsPlaying(false);
      setCurrentIndex(-1);
    }
  };

  // ----- Mini-player controls -----
  const playFromQueue = (idx: number) => {
    setCurrentIndex(idx);
    setIsPlaying(true);
  };
  const togglePlayer = () => {
    if (currentIndex < 0 && queue.length > 0) {
      setCurrentIndex(0);
      setIsPlaying(true);
      return;
    }
    setIsPlaying((p) => !p);
  };
  const next = () => {
    if (queue.length === 0) return;
    setCurrentIndex((i) => (i + 1) % queue.length);
    setIsPlaying(true);
  };
  const prev = () => {
    if (queue.length === 0) return;
    setCurrentIndex((i) => (i - 1 + queue.length) % queue.length);
    setIsPlaying(true);
  };

  // Sync the player audio element to current track + play state
  useEffect(() => {
    const audio = playerAudioRef.current;
    if (!audio) return;
    if (!currentTrack || !currentTrack.preview) {
      audio.pause();
      setIsPlaying(false);
      return;
    }
    if (audio.src !== currentTrack.preview) {
      audio.src = currentTrack.preview;
      setProgress(0);
    }
    if (isPlaying) {
      audio.play().catch(() => setIsPlaying(false));
    } else {
      audio.pause();
    }
  }, [currentTrack, isPlaying]);

  const isInPlaylist = (id: string) => playlist.some((s) => s.id === id);
  const isSOTD = (id: string) => value?.id === id;

  // ============ MODAL ============
  const modal = open ? (
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/65 backdrop-blur-sm animate-fade-in"
      onClick={() => setOpen(false)}
    >
      <div
        className="relative w-full sm:max-w-md mx-auto rounded-t-3xl sm:rounded-3xl border border-border/40 bg-card p-5 shadow-2xl animate-scale-in max-h-[88vh] flex flex-col"
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

        {/* Currently selected SOTD */}
        {value && (
          <div className="mb-3 flex items-center gap-3 rounded-xl border border-accent/30 bg-accent/5 p-2.5 shrink-0">
            <img src={value.artwork} alt="" className="h-12 w-12 rounded-md object-cover" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-[0.18em] text-accent/85 font-semibold mb-0.5">
                Now featured
              </p>
              <p className="text-[12px] font-medium text-foreground/90 truncate">{value.title}</p>
              <p className="text-[10.5px] text-foreground/55 truncate">{value.artist}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => togglePreview(value)}
                disabled={!value.preview}
                className="rounded-full p-1.5 text-foreground/65 hover:text-accent hover:bg-accent/10 transition-colors disabled:opacity-40"
                aria-label="Preview"
              >
                {previewId === value.id ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              </button>
              <a
                href={value.spotifyUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-full p-1.5 text-foreground/55 hover:text-foreground hover:bg-foreground/5 transition-colors"
                aria-label="Open in Spotify"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
              <button
                type="button"
                onClick={clearSong}
                className="rounded-full p-1.5 text-foreground/45 hover:text-destructive hover:bg-destructive/10 transition-colors"
                aria-label="Remove song"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Tab switcher */}
        <div className="flex items-center gap-1 mb-3 shrink-0 rounded-full border border-border/40 bg-background/40 p-0.5">
          <button
            type="button"
            onClick={() => setTab("search")}
            className={`flex-1 rounded-full py-1.5 text-[10.5px] font-medium tracking-[0.16em] transition-colors ${
              tab === "search"
                ? "bg-accent text-background"
                : "text-foreground/60 hover:text-foreground"
            }`}
          >
            <Search className="inline h-3 w-3 mr-1 -mt-0.5" />
            SEARCH
          </button>
          <button
            type="button"
            onClick={() => setTab("playlist")}
            className={`flex-1 rounded-full py-1.5 text-[10.5px] font-medium tracking-[0.16em] transition-colors ${
              tab === "playlist"
                ? "bg-accent text-background"
                : "text-foreground/60 hover:text-foreground"
            }`}
          >
            <ListMusic className="inline h-3 w-3 mr-1 -mt-0.5" />
            PLAYLIST · {playlist.length}
          </button>
        </div>

        {tab === "search" && (
          <>
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
                  const id = String(t.trackId);
                  const playingPreview = previewId === id;
                  const inList = isInPlaylist(id);
                  const isFeatured = isSOTD(id);
                  return (
                    <li
                      key={id}
                      className="flex items-center gap-3 rounded-xl border border-border/30 bg-background/40 p-2 hover:border-accent/40 hover:bg-accent/5 transition-colors"
                    >
                      <button
                        type="button"
                        onClick={() => togglePreview(toSong(t))}
                        disabled={!t.previewUrl}
                        className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md disabled:opacity-50 group"
                        aria-label={playingPreview ? "Pause preview" : "Play preview"}
                      >
                        <img src={t.artworkUrl100} alt="" className="h-full w-full object-cover" />
                        <span
                          className={`absolute inset-0 flex items-center justify-center bg-black/45 transition-opacity ${
                            playingPreview ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                          }`}
                        >
                          {playingPreview ? (
                            <Pause className="h-4 w-4 text-white" />
                          ) : (
                            <Play className="h-4 w-4 text-white" />
                          )}
                        </span>
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11.5px] font-medium text-foreground/90 truncate">{t.trackName}</p>
                        <p className="text-[10px] text-foreground/55 truncate">{t.artistName}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => addToPlaylist(t)}
                        disabled={inList}
                        className="shrink-0 rounded-full p-1.5 text-foreground/55 hover:text-accent hover:bg-accent/10 transition-colors disabled:opacity-50"
                        aria-label={inList ? "Already in playlist" : "Add to playlist"}
                        title={inList ? "In playlist" : "Add to playlist"}
                      >
                        {inList ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => setAsSOTD(t)}
                        className={`shrink-0 rounded-full px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wider transition-opacity ${
                          isFeatured
                            ? "bg-accent/20 text-accent"
                            : "bg-accent text-background hover:opacity-90"
                        }`}
                      >
                        {isFeatured ? "Pinned" : "Pick"}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </>
        )}

        {tab === "playlist" && (
          <div className="flex-1 overflow-y-auto -mx-1 px-1">
            {playlist.length === 0 && (
              <p className="py-10 text-center text-[11px] text-foreground/45">
                Your playlist is empty.
                <br />
                Add tracks from the Search tab.
              </p>
            )}
            <ul className="space-y-1.5">
              {playlist.map((s, idx) => {
                const playingPreview = previewId === s.id;
                const isCurrent = currentTrack?.id === s.id && isPlaying;
                return (
                  <li
                    key={s.id}
                    className="flex items-center gap-3 rounded-xl border border-border/30 bg-background/40 p-2 hover:border-accent/40 hover:bg-accent/5 transition-colors"
                  >
                    <button
                      type="button"
                      onClick={() => togglePreview(s)}
                      disabled={!s.preview}
                      className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md disabled:opacity-50 group"
                    >
                      <img src={s.artwork} alt="" className="h-full w-full object-cover" />
                      <span
                        className={`absolute inset-0 flex items-center justify-center bg-black/45 transition-opacity ${
                          playingPreview || isCurrent ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                        }`}
                      >
                        {playingPreview || isCurrent ? (
                          <Pause className="h-4 w-4 text-white" />
                        ) : (
                          <Play className="h-4 w-4 text-white" />
                        )}
                      </span>
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11.5px] font-medium text-foreground/90 truncate">{s.title}</p>
                      <p className="text-[10px] text-foreground/55 truncate">{s.artist}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        // play this track in mini-player. Index in queue may be offset by SOTD.
                        const qIdx = queue.findIndex((q) => q.id === s.id);
                        if (qIdx >= 0) {
                          playFromQueue(qIdx);
                          setOpen(false);
                        }
                      }}
                      className="shrink-0 rounded-full px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wider bg-accent text-background hover:opacity-90"
                    >
                      Play
                    </button>
                    <button
                      type="button"
                      onClick={() => setAsSOTD(s)}
                      className={`shrink-0 rounded-full p-1.5 transition-colors ${
                        isSOTD(s.id)
                          ? "text-accent bg-accent/15"
                          : "text-foreground/55 hover:text-accent hover:bg-accent/10"
                      }`}
                      aria-label="Set as SOTD"
                      title="Pin as Song of the Day"
                    >
                      <Music className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeFromPlaylist(s.id)}
                      className="shrink-0 rounded-full p-1.5 text-foreground/45 hover:text-destructive hover:bg-destructive/10 transition-colors"
                      aria-label="Remove"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  ) : null;

  // ============ Trigger button + Mini-player ============
  return (
    <>
      {/* Inline player card — shows album art + title + artist + scrub bar.
          The small icon on the right opens the search/playlist modal. */}
      {value ? (
        <InlinePlayerCard
          track={value}
          isPlaying={isPlaying && currentTrack?.id === value.id}
          progress={currentTrack?.id === value.id ? progress : 0}
          duration={currentTrack?.id === value.id ? duration : 30}
          playlistCount={playlist.length}
          onTogglePlay={() => {
            // If the SOTD isn't the current track, switch to it (queue[0])
            if (currentTrack?.id !== value.id) {
              setCurrentIndex(0);
              setIsPlaying(true);
            } else {
              togglePlayer();
            }
          }}
          onNext={queue.length > 1 ? next : undefined}
          onPrev={queue.length > 1 ? prev : undefined}
          onOpenLibrary={() => setOpen(true)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 rounded-full border border-dashed border-border/50 bg-background/40 backdrop-blur px-3 py-1.5 text-[10px] font-medium tracking-[0.18em] text-foreground/60 hover:border-accent/60 hover:text-accent transition-colors shrink-0"
          aria-label="Pick song of the day"
        >
          <Music className="h-3 w-3" />
          PICK A SONG
        </button>
      )}

      {/* Hidden audio element that drives the mini-player */}
      <audio
        ref={playerAudioRef}
        onTimeUpdate={(e) => setProgress(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 30)}
        onEnded={next}
        preload="metadata"
      />

      {modal && typeof document !== "undefined" && createPortal(modal, document.body)}
    </>
  );
}

// =====================================================
// Floating mini-player (rendered into <body>)
// =====================================================
interface MiniPlayerProps {
  track: SongOfDay;
  isPlaying: boolean;
  progress: number;
  duration: number;
  queueIndex: number;
  queueLength: number;
  onTogglePlay: () => void;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
}

const POS_KEY = "ootd-miniplayer-pos";

function MiniPlayer({
  track,
  isPlaying,
  progress,
  duration,
  queueIndex,
  queueLength,
  onTogglePlay,
  onNext,
  onPrev,
  onClose,
}: MiniPlayerProps) {
  const pct = duration > 0 ? Math.min(100, (progress / duration) * 100) : 0;
  const fmt = (s: number) => {
    if (!isFinite(s) || s <= 0) return "0:00";
    const m = Math.floor(s / 60);
    const r = Math.floor(s % 60);
    return `${m}:${r.toString().padStart(2, "0")}`;
  };

  // ---- Draggable position (persisted) ----
  const PLAYER_W = 320;
  const PLAYER_H = 230;
  const defaultPos = () => {
    if (typeof window === "undefined") return { x: 16, y: 80 };
    return {
      x: Math.max(8, window.innerWidth - PLAYER_W - 16),
      y: Math.max(8, window.innerHeight - PLAYER_H - 80),
    };
  };
  const [pos, setPos] = useState<{ x: number; y: number }>(() => {
    if (typeof window === "undefined") return { x: 16, y: 80 };
    try {
      const raw = localStorage.getItem(POS_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if (typeof p?.x === "number" && typeof p?.y === "number") return p;
      }
    } catch {}
    return defaultPos();
  });
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button,a,input")) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    const maxX = window.innerWidth - PLAYER_W - 4;
    const maxY = window.innerHeight - 80;
    const nx = Math.max(4, Math.min(maxX, dragRef.current.origX + dx));
    const ny = Math.max(4, Math.min(maxY, dragRef.current.origY + dy));
    setPos({ x: nx, y: ny });
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current) {
      try { localStorage.setItem(POS_KEY, JSON.stringify(pos)); } catch {}
    }
    dragRef.current = null;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
  };

  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      className="fixed z-[180] w-[280px] sm:w-[320px] animate-scale-in select-none"
      style={{ left: pos.x, top: pos.y }}
    >
      <div
        className="relative overflow-hidden rounded-2xl border border-border/50 bg-card/95 backdrop-blur-xl shadow-2xl"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{ touchAction: "none" }}
      >
        {/* Drag handle hint */}
        <div className="absolute left-1/2 top-1 z-10 -translate-x-1/2 h-1 w-8 rounded-full bg-foreground/20" />
        {/* Album art header with play overlay */}
        <div className="relative h-24 w-full overflow-hidden cursor-grab active:cursor-grabbing">
          <img
            src={track.artwork}
            alt=""
            className={`absolute inset-0 h-full w-full object-cover blur-md scale-110 ${
              isPlaying ? "opacity-60" : "opacity-40"
            }`}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-card via-card/40 to-transparent" />
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="absolute right-1.5 top-1.5 z-20 rounded-full bg-background/80 p-1.5 text-foreground/80 hover:text-foreground hover:bg-background transition-colors shadow-md"
            aria-label="Close player"
          >
            <X className="h-3.5 w-3.5" />
          </button>
          <div className="absolute inset-0 flex items-center gap-3 px-3">
            <img
              src={track.artwork}
              alt=""
              className={`h-16 w-16 rounded-lg object-cover shadow-lg ring-1 ring-white/15 ${
                isPlaying ? "animate-[spin_8s_linear_infinite]" : ""
              }`}
              style={{ animationPlayState: isPlaying ? "running" : "paused" }}
            />
            <div className="min-w-0 flex-1">
              <p className="text-[11.5px] font-semibold text-foreground/95 truncate">{track.title}</p>
              <p className="text-[10px] text-foreground/65 truncate">{track.artist}</p>
              <p className="mt-0.5 text-[9px] uppercase tracking-[0.18em] text-accent/85 font-semibold">
                {queueIndex === 0 ? "SOTD" : `Track ${queueIndex + 1} / ${queueLength}`}
              </p>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="px-3 pt-2">
          <div className="h-1 w-full overflow-hidden rounded-full bg-foreground/10">
            <div
              className="h-full bg-accent transition-[width] duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="mt-1 flex items-center justify-between text-[9px] text-foreground/50 tabular-nums">
            <span>{fmt(progress)}</span>
            <span>{fmt(duration)}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between px-3 pb-3 pt-1">
          <a
            href={track.spotifyUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-full p-1.5 text-foreground/55 hover:text-foreground hover:bg-foreground/5 transition-colors"
            aria-label="Open in Spotify"
            title="Open in Spotify"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onPrev}
              disabled={queueLength < 2}
              className="rounded-full p-1.5 text-foreground/70 hover:text-foreground hover:bg-foreground/5 transition-colors disabled:opacity-30"
              aria-label="Previous"
            >
              <SkipBack className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onTogglePlay}
              disabled={!track.preview}
              className="rounded-full bg-accent p-2.5 text-background shadow-lg shadow-accent/30 hover:opacity-90 transition disabled:opacity-50"
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
            </button>
            <button
              type="button"
              onClick={onNext}
              disabled={queueLength < 2}
              className="rounded-full p-1.5 text-foreground/70 hover:text-foreground hover:bg-foreground/5 transition-colors disabled:opacity-30"
              aria-label="Next"
            >
              <SkipForward className="h-4 w-4" />
            </button>
          </div>

          <Volume2 className="h-3.5 w-3.5 text-foreground/40" />
        </div>

        {!track.preview && (
          <p className="px-3 pb-2 text-[9px] text-foreground/45 italic">
            Preview not available — open in Spotify.
          </p>
        )}
      </div>
    </div>,
    document.body,
  );
}

// =====================================================
// Inline player card — replaces the old SOTD pill button.
// Shows album / title / artist, a thin scrub bar, prev/play/next,
// and a small icon on the right that opens the search/playlist modal.
// =====================================================
interface InlinePlayerCardProps {
  track: SongOfDay;
  isPlaying: boolean;
  progress: number;
  duration: number;
  playlistCount: number;
  onTogglePlay: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  onOpenLibrary: () => void;
}

function InlinePlayerCard({
  track,
  isPlaying,
  progress,
  duration,
  playlistCount,
  onTogglePlay,
  onNext,
  onPrev,
  onOpenLibrary,
}: InlinePlayerCardProps) {
  const pct = duration > 0 ? Math.min(100, (progress / duration) * 100) : 0;
  return (
    <div className="flex h-7 items-center gap-1.5 rounded-full border border-border/40 bg-background/60 backdrop-blur pl-0.5 pr-1 shrink-0 max-w-[180px] sm:max-w-[220px]">
      {/* Album art */}
      <img
        src={track.artwork}
        alt=""
        className={`h-6 w-6 rounded-full object-cover ring-1 ring-border/40 shrink-0 ${
          isPlaying ? "animate-[spin_8s_linear_infinite]" : ""
        }`}
        style={{ animationPlayState: isPlaying ? "running" : "paused" }}
      />

      {/* Title only — keep it tight to match the other chips */}
      <p className="min-w-0 flex-1 truncate text-[10px] font-medium text-foreground/85 leading-tight">
        {track.title}
      </p>

      {/* Play / pause */}
      <button
        type="button"
        onClick={onTogglePlay}
        disabled={!track.preview}
        className="rounded-full bg-accent p-1 text-background shadow-sm hover:opacity-90 transition disabled:opacity-50 shrink-0"
        aria-label={isPlaying ? "Pause" : "Play"}
        title={!track.preview ? "Preview not available" : isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? <Pause className="h-2.5 w-2.5" /> : <Play className="h-2.5 w-2.5 ml-px" />}
      </button>

      {/* Library icon — opens modal */}
      <button
        type="button"
        onClick={onOpenLibrary}
        className="relative rounded-full p-0.5 text-foreground/55 hover:text-accent transition-colors shrink-0"
        aria-label="Open song library"
        title="Search & playlist"
      >
        <ListMusic className="h-3 w-3" />
        {playlistCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 rounded-full bg-accent px-1 py-px text-[8px] leading-none font-semibold text-background">
            {playlistCount}
          </span>
        )}
      </button>
    </div>
  );
}
