// ─── BODY PHOTO PICKER ──────────────────────────────────────────────────────
// One clean surface for the FIT > SCAN tab. Replaces the awkward grid that
// could sit in endless loading.
//
// Strict state machine:
//   IDLE → LOADING → (SUCCESS | EMPTY | ERROR)
//
// Loading bug fix: previously the parent component awaited Promise.all of
// signed-URL requests before flipping `loading=false`. A single hung
// `createSignedUrl` call kept every tile spinning forever. Here we:
//   1) fetch the list with a 6s hard timeout
//   2) render tiles immediately (without URLs)
//   3) resolve URLs in the background (per-tile spinner only)
//   4) any failure surfaces a retryable error card — never indefinite spinner
//
// All reads/writes go through RLS so the picker only ever shows the signed-in
// user's own photos.

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2, Upload, Check, Trash2, ImagePlus, AlertTriangle,
  RefreshCw, FolderOpen, X,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { pickPhotoFile } from "@/lib/native/pickPhotoFile";
import {
  listUserBodyImages,
  resolveBodyImageUrl,
  uploadOrReuseBodyImage,
  removeBodyImage,
  type UserBodyImage,
} from "@/lib/fit/userBodyImages";

interface Props {
  selectedImageId?: string | null;
  selectedImageUrl?: string | null;
  onSelect: (image: UserBodyImage, url: string) => void;
  onClear?: () => void;
  className?: string;
}

interface Tile {
  image: UserBodyImage;
  url: string | null;
  resolving: boolean;
}

type Status = "idle" | "loading" | "success" | "empty" | "error";

const FETCH_TIMEOUT_MS = 6000;

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label}_timeout`)), ms);
    p.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); }
    );
  });
}

export default function BodyPhotoPicker({
  selectedImageId,
  selectedImageUrl,
  onSelect,
  onClear,
  className,
}: Props) {
  const { user } = useAuth();
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const savedSectionRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setTiles([]);
      setStatus("idle");
      return;
    }
    setStatus("loading");
    setErrorMessage(null);
    try {
      const rows = await withTimeout(listUserBodyImages(user.id), FETCH_TIMEOUT_MS, "list");
      if (rows.length === 0) {
        setTiles([]);
        setStatus("empty");
        return;
      }
      // Render tiles immediately. URLs resolve in the background per-tile so
      // a single slow signed-URL call cannot freeze the whole picker.
      const initial: Tile[] = rows.map((image) => ({ image, url: null, resolving: true }));
      setTiles(initial);
      setStatus("success");

      rows.forEach(async (image, idx) => {
        try {
          const url = await withTimeout(resolveBodyImageUrl(image), FETCH_TIMEOUT_MS, "url");
          setTiles((prev) => {
            const next = [...prev];
            if (next[idx]?.image.id === image.id) {
              next[idx] = { image, url, resolving: false };
            }
            return next;
          });
        } catch {
          setTiles((prev) => {
            const next = [...prev];
            if (next[idx]?.image.id === image.id) {
              next[idx] = { image, url: null, resolving: false };
            }
            return next;
          });
        }
      });
    } catch (err) {
      console.error("[BodyPhotoPicker] list failed", err);
      setErrorMessage((err as Error).message || "Failed to load photos");
      setStatus("error");
      setTiles([]);
    }
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  // ── Upload ───────────────────────────────────────────────────────────────
  const handlePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please pick an image");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      toast.error("Image too large (max 15MB)");
      return;
    }
    setUploading(true);
    uploadOrReuseBodyImage(user.id, file)
      .then(async (res) => {
        if (res.reused) toast.success("Using your existing photo");
        else toast.success("Photo added to your library");
        await refresh();
        if (res.url) onSelect(res.image, res.url);
      })
      .catch((err) => {
        console.error("[BodyPhotoPicker] upload failed", err);
        toast.error("Upload failed");
      })
      .finally(() => setUploading(false));
  };

  // ── Delete ───────────────────────────────────────────────────────────────
  const handleDelete = async (image: UserBodyImage) => {
    if (!user) return;
    if (!confirm("Remove this photo from your library?")) return;
    try {
      await removeBodyImage(user.id, image);
      if (selectedImageId === image.id) onClear?.();
      // Optimistic remove without full refetch — keeps UI snappy.
      setTiles((prev) => {
        const next = prev.filter((t) => t.image.id !== image.id);
        if (next.length === 0) setStatus("empty");
        return next;
      });
      toast.success("Photo removed");
    } catch (err) {
      console.error("[BodyPhotoPicker] delete failed", err);
      toast.error("Could not remove photo");
    }
  };

  // ── Select ───────────────────────────────────────────────────────────────
  const handleSelect = (tile: Tile) => {
    if (!tile.url) return;
    onSelect(tile.image, tile.url);
  };

  const scrollToSaved = () => {
    savedSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (!user) {
    return (
      <section className={className}>
        <div className="rounded-2xl border border-foreground/[0.08] bg-card/40 p-6 text-center">
          <p className="text-xs text-foreground/60">Sign in to save and reuse your body photos.</p>
        </div>
      </section>
    );
  }

  const selectedTile = tiles.find((t) => t.image.id === selectedImageId);
  const previewUrl = selectedTile?.url ?? selectedImageUrl ?? null;

  return (
    <section className={className}>
      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <header className="mb-4 flex items-end justify-between">
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-foreground">
            Your body photos
          </h3>
          <p className="mt-0.5 text-[11px] text-foreground/55">
            Reuse the same photo across try-ons. Identical files are auto-deduped.
          </p>
        </div>
        {status === "success" && tiles.length > 0 && (
          <span className="text-[10px] font-medium tracking-[0.18em] text-foreground/45">
            {tiles.length} SAVED
          </span>
        )}
      </header>

      {/* ── PRIMARY ACTIONS ─────────────────────────────────────────────── */}
      <div className="mb-5 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex items-center justify-center gap-2 rounded-xl border border-foreground/10 bg-foreground py-3 text-xs font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {uploading ? (
            <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading…</>
          ) : (
            <><Upload className="h-3.5 w-3.5" /> Upload new</>
          )}
        </button>
        <button
          type="button"
          onClick={scrollToSaved}
          disabled={status !== "success" || tiles.length === 0}
          className="flex items-center justify-center gap-2 rounded-xl border border-foreground/15 bg-card/40 py-3 text-xs font-semibold text-foreground/85 transition-colors hover:border-foreground/30 disabled:opacity-40"
        >
          <FolderOpen className="h-3.5 w-3.5" /> Choose from saved
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handlePick}
        />
      </div>

      {/* ── SELECTED PREVIEW ────────────────────────────────────────────── */}
      <AnimatePresence>
        {previewUrl && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="mb-5 flex items-center gap-3 rounded-2xl border border-accent/30 bg-accent/[0.05] p-3"
          >
            <div className="relative h-20 w-16 shrink-0 overflow-hidden rounded-lg bg-card/40">
              <img
                src={previewUrl}
                alt="Selected body photo"
                className="h-full w-full object-cover"
              />
              <div className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-background">
                <Check className="h-3 w-3" />
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold tracking-[0.18em] text-accent/80">
                SELECTED FOR FIT
              </p>
              <p className="mt-1 truncate text-xs text-foreground/85">
                {selectedTile?.image.label || "Body photo"}
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="text-[11px] font-medium text-foreground/70 underline-offset-2 hover:text-foreground hover:underline"
                >
                  Replace
                </button>
                {onClear && (
                  <button
                    type="button"
                    onClick={onClear}
                    className="flex items-center gap-1 text-[11px] font-medium text-foreground/55 hover:text-foreground/85"
                  >
                    <X className="h-3 w-3" /> Clear
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── CONTENT STATES ──────────────────────────────────────────────── */}
      <div ref={savedSectionRef}>
        {/* LOADING — at most 4 elegant skeleton cards */}
        {status === "loading" && (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="aspect-[3/4] animate-pulse rounded-2xl bg-foreground/[0.04]"
                style={{ animationDelay: `${i * 80}ms` }}
              />
            ))}
          </div>
        )}

        {/* EMPTY */}
        {status === "empty" && (
          <div className="rounded-2xl border border-dashed border-foreground/15 bg-card/30 px-6 py-10 text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-foreground/[0.04]">
              <ImagePlus className="h-4 w-4 text-foreground/60" />
            </div>
            <p className="text-sm font-medium text-foreground/85">No body photos yet</p>
            <p className="mt-1 text-[11px] text-foreground/55">
              Upload one photo and reuse it on every try-on.
            </p>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-foreground px-4 py-2 text-xs font-semibold text-background disabled:opacity-50"
            >
              {uploading ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading…</>
              ) : (
                <><Upload className="h-3.5 w-3.5" /> Upload your first photo</>
              )}
            </button>
          </div>
        )}

        {/* ERROR */}
        {status === "error" && (
          <div className="rounded-2xl border border-orange-500/25 bg-orange-500/[0.05] px-5 py-6 text-center">
            <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-orange-500/10">
              <AlertTriangle className="h-4 w-4 text-orange-500/85" />
            </div>
            <p className="text-sm font-medium text-foreground/85">
              Couldn’t load your photos
            </p>
            {errorMessage && (
              <p className="mt-1 text-[10px] text-foreground/55">{errorMessage}</p>
            )}
            <button
              type="button"
              onClick={refresh}
              className="mt-4 inline-flex items-center gap-2 rounded-xl border border-foreground/15 px-4 py-2 text-xs font-semibold text-foreground/85 hover:border-foreground/30"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </button>
          </div>
        )}

        {/* SUCCESS — saved photo grid */}
        {status === "success" && tiles.length > 0 && (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            <AnimatePresence initial={false}>
              {tiles.map((tile) => {
                const { image, url, resolving } = tile;
                const selected = selectedImageId === image.id;
                return (
                  <motion.div
                    key={image.id}
                    layout
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    className="group relative aspect-[3/4]"
                  >
                    <button
                      type="button"
                      onClick={() => handleSelect(tile)}
                      disabled={!url}
                      className={`relative h-full w-full overflow-hidden rounded-2xl border transition-all ${
                        selected
                          ? "border-accent ring-2 ring-accent/40"
                          : "border-foreground/10 hover:border-foreground/30"
                      } ${!url ? "cursor-default" : ""}`}
                      aria-label={selected ? "Selected body photo" : "Use this body photo"}
                    >
                      {url ? (
                        <img
                          src={url}
                          alt={image.label || "Body photo"}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-foreground/[0.03]">
                          {resolving ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-foreground/40" />
                          ) : (
                            <span className="text-[10px] text-foreground/40">unavailable</span>
                          )}
                        </div>
                      )}
                      {selected && (
                        <div className="absolute inset-0 bg-background/25 backdrop-blur-[1px]">
                          <div className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-accent text-background shadow">
                            <Check className="h-3.5 w-3.5" />
                          </div>
                        </div>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleDelete(image); }}
                      className="absolute right-1.5 top-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-foreground/10 bg-background/95 text-foreground/65 opacity-0 shadow-sm transition-all hover:text-destructive group-hover:opacity-100 focus-visible:opacity-100"
                      aria-label="Remove photo"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </section>
  );
}
