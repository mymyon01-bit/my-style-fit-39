// ─── USER BODY IMAGE LIBRARY (FIT) ──────────────────────────────────────────
// Reusable picker. Shows the signed-in user's previously uploaded body
// photos plus an "Upload new" tile. Selecting a tile fires onSelect with a
// resolved URL + the canonical image record. New uploads are dedup'd by
// SHA-256 — re-uploading the same file reuses the existing row instead of
// creating a duplicate.

import { useEffect, useRef, useState, useCallback } from "react";
import { Upload, Loader2, Check, Trash2, ImagePlus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import {
  listUserBodyImages,
  resolveBodyImageUrl,
  uploadOrReuseBodyImage,
  removeBodyImage,
  type UserBodyImage,
} from "@/lib/fit/userBodyImages";

interface Props {
  selectedImageId?: string | null;
  onSelect: (image: UserBodyImage, url: string) => void;
  onClear?: () => void;
  className?: string;
}

interface Tile {
  image: UserBodyImage;
  url: string | null;
}

export default function UserBodyImageLibrary({ selectedImageId, onSelect, onClear, className }: Props) {
  const { user } = useAuth();
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setTiles([]);
      return;
    }
    setLoading(true);
    try {
      const rows = await listUserBodyImages(user.id);
      const resolved = await Promise.all(
        rows.map(async (image) => ({ image, url: await resolveBodyImageUrl(image) }))
      );
      setTiles(resolved);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

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
        console.error("[UserBodyImageLibrary] upload failed", err);
        toast.error("Upload failed");
      })
      .finally(() => setUploading(false));
  };

  const handleDelete = async (image: UserBodyImage) => {
    if (!user) return;
    if (!confirm("Remove this photo from your library?")) return;
    await removeBodyImage(user.id, image);
    if (selectedImageId === image.id) onClear?.();
    await refresh();
  };

  const handleSelect = (tile: Tile) => {
    if (!tile.url) return;
    onSelect(tile.image, tile.url);
  };

  if (!user) return null;

  return (
    <div className={className}>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[10px] font-semibold tracking-[0.2em] text-foreground/80">YOUR BODY PHOTOS</p>
        {tiles.length > 0 && (
          <span className="text-[10px] text-foreground/50">{tiles.length} saved</span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {/* Upload tile */}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="relative flex aspect-[3/4] flex-col items-center justify-center rounded-2xl border border-dashed border-foreground/15 bg-card/30 transition-colors hover:border-accent/40 disabled:opacity-50"
        >
          {uploading ? (
            <Loader2 className="h-5 w-5 animate-spin text-accent" />
          ) : (
            <>
              <ImagePlus className="h-5 w-5 text-foreground/70" />
              <span className="mt-1.5 text-[10px] font-semibold tracking-[0.1em] text-foreground/75">UPLOAD</span>
            </>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePick} />
        </button>

        {/* Existing tiles */}
        <AnimatePresence initial={false}>
          {tiles.map(({ image, url }) => {
            const selected = selectedImageId === image.id;
            return (
              <motion.div
                key={image.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative aspect-[3/4]"
              >
                <button
                  type="button"
                  onClick={() => handleSelect({ image, url })}
                  className={`group relative h-full w-full overflow-hidden rounded-2xl border transition-all ${
                    selected
                      ? "border-accent ring-2 ring-accent/40"
                      : "border-foreground/10 hover:border-foreground/30"
                  }`}
                >
                  {url ? (
                    <img src={url} alt={image.label || "Body photo"} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-card/30">
                      <Loader2 className="h-4 w-4 animate-spin text-foreground/40" />
                    </div>
                  )}
                  {selected && (
                    <div className="absolute inset-0 bg-background/30 backdrop-blur-[1px]">
                      <div className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-accent text-background">
                        <Check className="h-3.5 w-3.5" />
                      </div>
                    </div>
                  )}
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(image);
                  }}
                  className="absolute -right-1 -top-1 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-foreground/10 bg-background/90 opacity-0 shadow-md transition-opacity group-hover:opacity-100 hover:text-destructive"
                  aria-label="Remove photo"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {loading && tiles.length === 0 && (
        <div className="mt-3 flex items-center gap-2 text-[11px] text-foreground/60">
          <Loader2 className="h-3 w-3 animate-spin" />
          Loading your photos…
        </div>
      )}

      {!loading && tiles.length === 0 && (
        <p className="mt-3 text-[11px] text-foreground/60">
          Upload a body photo once and reuse it across try-ons. We'll dedupe identical files automatically.
        </p>
      )}
    </div>
  );
}
