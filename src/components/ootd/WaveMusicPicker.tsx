/**
 * WaveMusicPicker — pin a song to a Wave (per-wave localStorage).
 * Lightweight iTunes search (no auth) + 30s preview.
 * Owner/admin can set/clear; everyone can preview.
 */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Music, Search, X, Loader2, Play, Pause, Trash2, Check } from "lucide-react";

export interface WaveSong {
  id: string;
  title: string;
  artist: string;
  artwork: string;
  preview: string;
}

const keyFor = (waveId: string) => `wave-music-${waveId}`;

export function loadWaveSong(waveId: string): WaveSong | null {
  try {
    const raw = localStorage.getItem(keyFor(waveId));
    return raw ? (JSON.parse(raw) as WaveSong) : null;
  } catch { return null; }
}
export function saveWaveSong(waveId: string, song: WaveSong | null) {
  try {
    if (song) localStorage.setItem(keyFor(waveId), JSON.stringify(song));
    else localStorage.removeItem(keyFor(waveId));
  } catch {}
}

interface ITunesResult {
  trackId: number; trackName: string; artistName: string;
  artworkUrl100: string; previewUrl?: string;
}
const toSong = (t: ITunesResult): WaveSong => ({
  id: String(t.trackId),
  title: t.trackName,
  artist: t.artistName,
  artwork: (t.artworkUrl100 ?? "").replace("100x100", "300x300"),
  preview: t.previewUrl ?? "",
});

interface Props {
  waveId: string;
  canEdit: boolean;
}

export default function WaveMusicPicker({ waveId, canEdit }: Props) {
  const [song, setSong] = useState<WaveSong | null>(() => loadWaveSong(waveId));
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ITunesResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => { setSong(loadWaveSong(waveId)); }, [waveId]);

  useEffect(() => {
    if (!open) { audioRef.current?.pause(); setPlayingId(null); return; }
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=music&entity=song&limit=20`
        );
        const json = await res.json();
        setResults((json.results || []) as ITunesResult[]);
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [query, open]);

  const togglePreview = (s: WaveSong) => {
    if (!s.preview) return;
    if (playingId === s.id) {
      audioRef.current?.pause(); setPlayingId(null); return;
    }
    audioRef.current?.pause();
    const a = new Audio(s.preview);
    a.volume = 0.7;
    a.play().catch(() => {});
    a.onended = () => setPlayingId(null);
    audioRef.current = a;
    setPlayingId(s.id);
  };

  const pick = (t: ITunesResult) => {
    const s = toSong(t);
    saveWaveSong(waveId, s);
    setSong(s);
    setOpen(false);
  };

  const clear = () => {
    saveWaveSong(waveId, null);
    setSong(null);
  };

  // Compact chip
  const chip = (
    <button
      type="button"
      onClick={() => {
        if (song) togglePreview(song);
        else if (canEdit) setOpen(true);
      }}
      onDoubleClick={() => canEdit && setOpen(true)}
      className="flex items-center gap-1.5 rounded-full border border-foreground/15 bg-foreground/[0.04] px-2.5 py-1 text-[10.5px] text-foreground/75 hover:border-accent/50 hover:text-accent transition-colors max-w-[180px]"
      title={song ? `${song.title} — ${song.artist}` : "Set wave music"}
    >
      {song ? (
        playingId === song.id ? <Pause className="h-3 w-3 shrink-0" /> : <Play className="h-3 w-3 shrink-0" />
      ) : (
        <Music className="h-3 w-3 shrink-0" />
      )}
      <span className="truncate font-medium">
        {song ? song.title : (canEdit ? "Add music" : "No music")}
      </span>
      {song && canEdit && (
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => { e.stopPropagation(); setOpen(true); }}
          className="ml-0.5 text-[9px] uppercase tracking-wider text-foreground/45 hover:text-foreground"
        >
          Edit
        </span>
      )}
    </button>
  );

  const modal = open ? createPortal(
    <div
      className="fixed inset-0 z-[210] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border border-border/40 bg-card p-5 shadow-2xl max-h-[88vh] flex flex-col"
      >
        <div className="flex items-center justify-between mb-2 shrink-0">
          <div className="flex items-center gap-2">
            <Music className="h-3.5 w-3.5 text-accent" />
            <h3 className="text-[12px] font-medium tracking-[0.2em] text-foreground/85">WAVE MUSIC</h3>
          </div>
          <button onClick={() => setOpen(false)} className="rounded-full p-1 text-foreground/50 hover:text-foreground hover:bg-foreground/5">
            <X className="h-4 w-4" />
          </button>
        </div>

        {song && (
          <div className="mb-3 flex items-center gap-3 rounded-xl border border-accent/30 bg-accent/5 p-2.5 shrink-0">
            <img src={song.artwork} alt="" className="h-12 w-12 rounded-md object-cover" />
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-medium truncate">{song.title}</p>
              <p className="text-[10.5px] text-foreground/55 truncate">{song.artist}</p>
            </div>
            <button onClick={() => togglePreview(song)} disabled={!song.preview}
              className="rounded-full p-1.5 text-foreground/65 hover:text-accent hover:bg-accent/10 disabled:opacity-40">
              {playingId === song.id ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            </button>
            <button onClick={clear} className="rounded-full p-1.5 text-foreground/45 hover:text-destructive hover:bg-destructive/10">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <div className="relative mb-3 shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-foreground/40" />
          <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a song or artist…"
            className="w-full rounded-full border border-border/40 bg-background/60 pl-9 pr-3 py-2 text-[12px] outline-none focus:border-accent/60" />
          {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-foreground/40 animate-spin" />}
        </div>

        <div className="flex-1 overflow-y-auto -mx-1 px-1">
          {results.length === 0 && (
            <p className="py-6 text-center text-[11px] text-foreground/45">
              {query.trim().length < 2 ? "Try a song name or artist…" : "No results."}
            </p>
          )}
          <ul className="space-y-1.5">
            {results.map((t) => {
              const id = String(t.trackId);
              const playing = playingId === id;
              const isCurrent = song?.id === id;
              return (
                <li key={id} className="flex items-center gap-3 rounded-xl border border-border/30 bg-background/40 p-2 hover:border-accent/40 hover:bg-accent/5 transition-colors">
                  <button onClick={() => togglePreview(toSong(t))} disabled={!t.previewUrl}
                    className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md disabled:opacity-50 group">
                    <img src={t.artworkUrl100} alt="" className="h-full w-full object-cover" />
                    <span className={`absolute inset-0 flex items-center justify-center bg-black/45 transition-opacity ${playing ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
                      {playing ? <Pause className="h-4 w-4 text-white" /> : <Play className="h-4 w-4 text-white" />}
                    </span>
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11.5px] font-medium truncate">{t.trackName}</p>
                    <p className="text-[10px] text-foreground/55 truncate">{t.artistName}</p>
                  </div>
                  <button onClick={() => pick(t)}
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wider transition-opacity ${
                      isCurrent ? "bg-accent/20 text-accent" : "bg-accent text-background hover:opacity-90"
                    }`}>
                    {isCurrent ? <Check className="h-3 w-3" /> : "Pick"}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>,
    document.body
  ) : null;

  return <>{chip}{modal}</>;
}
