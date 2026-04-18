import { memo, useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Crop as CropIcon, Wand2, Loader2, Check } from "lucide-react";
import Cropper, { Area } from "react-easy-crop";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

/**
 * Hardcoded Story editor — 9:16 canvas, crop + filter + publish.
 * Layout NEVER changes. Only the image data and selected filter change.
 *
 *   [ × close ]              [ ✓ publish ]
 *   [           9:16 canvas             ]
 *   [ Crop | Filter ] (fixed tabs)
 *   [ tab content row ]
 */

interface Props {
  open: boolean;
  imageFile: File | null;
  onClose: () => void;
  onPublished: () => void;
}

type Tab = "crop" | "filter";

const FILTERS = [
  { id: "original", label: "Original", css: "none" },
  { id: "soft",     label: "Soft",     css: "brightness(1.05) contrast(0.95) saturate(0.9)" },
  { id: "warm",     label: "Warm",     css: "sepia(0.2) saturate(1.2) hue-rotate(-10deg)" },
  { id: "cool",     label: "Cool",     css: "saturate(1.1) hue-rotate(10deg) brightness(1.02)" },
  { id: "contrast", label: "Contrast", css: "contrast(1.25) saturate(1.1)" },
  { id: "mono",     label: "Mono",     css: "grayscale(1) contrast(1.1)" },
  { id: "vintage",  label: "Vintage",  css: "sepia(0.4) contrast(0.95) brightness(1.05)" },
  { id: "street",   label: "Street",   css: "contrast(1.15) saturate(0.85) brightness(0.98)" },
  { id: "clean",    label: "Clean",    css: "brightness(1.08) contrast(1.05) saturate(1.05)" },
];

async function renderToBlob(
  imageUrl: string,
  cropPixels: Area,
  filterCss: string
): Promise<Blob> {
  const img = new Image();
  img.crossOrigin = "anonymous";
  await new Promise<void>((res, rej) => {
    img.onload = () => res();
    img.onerror = () => rej(new Error("image load failed"));
    img.src = imageUrl;
  });

  // Force a 9:16 output of fixed dimensions for consistent story rendering
  const OUT_W = 1080;
  const OUT_H = 1920;
  const canvas = document.createElement("canvas");
  canvas.width = OUT_W;
  canvas.height = OUT_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas context unavailable");

  ctx.filter = filterCss;
  ctx.drawImage(
    img,
    cropPixels.x,
    cropPixels.y,
    cropPixels.width,
    cropPixels.height,
    0,
    0,
    OUT_W,
    OUT_H
  );

  return new Promise<Blob>((res, rej) => {
    canvas.toBlob(
      (b) => (b ? res(b) : rej(new Error("toBlob failed"))),
      "image/jpeg",
      0.9
    );
  });
}

function StoryEditorImpl({ open, imageFile, onClose, onPublished }: Props) {
  const { user } = useAuth();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("crop");
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [filterId, setFilterId] = useState("original");
  const [publishing, setPublishing] = useState(false);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (imageFile && open) {
      const url = URL.createObjectURL(imageFile);
      objectUrlRef.current = url;
      setImageUrl(url);
      setTab("crop");
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setFilterId("original");
    }
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [imageFile, open]);

  const onCropComplete = useCallback((_: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  const filterCss = FILTERS.find((f) => f.id === filterId)?.css ?? "none";

  const handlePublish = async () => {
    if (!user || !imageUrl || !croppedAreaPixels) {
      toast.error("Please sign in and adjust your photo first");
      return;
    }
    setPublishing(true);
    try {
      const blob = await renderToBlob(imageUrl, croppedAreaPixels, filterCss);
      const path = `${user.id}/${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage
        .from("stories")
        .upload(path, blob, { contentType: "image/jpeg", upsert: false });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from("stories").getPublicUrl(path);

      const { error: insErr } = await supabase.from("stories").insert({
        user_id: user.id,
        media_url: publicUrl,
        media_type: "image",
        audience: "all",
      });
      if (insErr) throw insErr;

      toast.success("Story published");
      onPublished();
      onClose();
    } catch (e: any) {
      console.error("[story-editor] publish failed", e);
      toast.error(e?.message || "Publish failed");
    } finally {
      setPublishing(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[120] flex flex-col bg-background"
        >
          {/* TOP BAR — fixed */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-foreground/[0.06]">
            <button
              onClick={onClose}
              disabled={publishing}
              className="text-foreground/70 hover:text-foreground transition-colors disabled:opacity-40"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
            <span className="text-[10px] font-bold tracking-[0.25em] text-foreground/60">
              EDIT STORY
            </span>
            <button
              onClick={handlePublish}
              disabled={publishing || !imageUrl}
              className="flex items-center gap-1.5 rounded-full bg-foreground px-4 py-1.5 text-[11px] font-semibold text-background hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              {publishing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              {publishing ? "PUBLISHING" : "PUBLISH"}
            </button>
          </div>

          {/* CANVAS — fixed 9:16 */}
          <div className="flex-1 flex items-center justify-center bg-black overflow-hidden">
            <div
              className="relative bg-black"
              style={{
                width: "min(100vw, calc((100vh - 220px) * 9 / 16))",
                height: "min(calc(100vw * 16 / 9), calc(100vh - 220px))",
              }}
            >
              {imageUrl && tab === "crop" && (
                <Cropper
                  image={imageUrl}
                  crop={crop}
                  zoom={zoom}
                  aspect={9 / 16}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={onCropComplete}
                  objectFit="contain"
                  style={{
                    mediaStyle: { filter: filterCss },
                    containerStyle: { background: "#000" },
                  }}
                />
              )}
              {imageUrl && tab === "filter" && croppedAreaPixels && (
                // Filter preview: render the cropped region with the active filter
                <FilteredPreview
                  imageUrl={imageUrl}
                  cropPixels={croppedAreaPixels}
                  filterCss={filterCss}
                />
              )}
            </div>
          </div>

          {/* TABS — fixed */}
          <div className="border-t border-foreground/[0.06] bg-card">
            <div className="flex">
              {[
                { id: "crop" as Tab, label: "CROP", icon: CropIcon },
                { id: "filter" as Tab, label: "FILTER", icon: Wand2 },
              ].map((t) => {
                const Icon = t.icon;
                const active = tab === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={`flex-1 flex flex-col items-center gap-1 py-3 text-[10px] font-bold tracking-[0.2em] transition-colors ${
                      active ? "text-accent" : "text-foreground/50 hover:text-foreground/70"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {t.label}
                  </button>
                );
              })}
            </div>

            {/* TAB CONTENT — hardcoded panels */}
            <div className="px-4 pb-5 pt-2 min-h-[110px]">
              {tab === "crop" && (
                <div className="space-y-2">
                  <p className="text-[9px] tracking-[0.2em] text-foreground/40">ZOOM</p>
                  <input
                    type="range"
                    min={1}
                    max={3}
                    step={0.01}
                    value={zoom}
                    onChange={(e) => setZoom(Number(e.target.value))}
                    className="w-full accent-[hsl(var(--accent))]"
                  />
                  <p className="text-[10px] text-foreground/40">
                    Drag to reposition · pinch or slide to zoom
                  </p>
                </div>
              )}
              {tab === "filter" && (
                <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
                  {FILTERS.map((f) => {
                    const active = f.id === filterId;
                    return (
                      <button
                        key={f.id}
                        onClick={() => setFilterId(f.id)}
                        className={`shrink-0 flex flex-col items-center gap-1.5 px-1 py-1 ${
                          active ? "" : "opacity-70"
                        }`}
                      >
                        <div
                          className={`h-14 w-14 rounded-lg overflow-hidden border-2 transition-colors ${
                            active ? "border-accent" : "border-transparent"
                          }`}
                        >
                          {imageUrl && (
                            <img
                              src={imageUrl}
                              alt={f.label}
                              className="w-full h-full object-cover"
                              style={{ filter: f.css }}
                            />
                          )}
                        </div>
                        <span
                          className={`text-[9px] font-semibold tracking-[0.1em] ${
                            active ? "text-accent" : "text-foreground/50"
                          }`}
                        >
                          {f.label.toUpperCase()}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Renders the cropped region with the active filter for the Filter tab preview. */
function FilteredPreview({
  imageUrl,
  cropPixels,
  filterCss,
}: {
  imageUrl: string;
  cropPixels: Area;
  filterCss: string;
}) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = cropPixels.width;
      canvas.height = cropPixels.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(
        img,
        cropPixels.x,
        cropPixels.y,
        cropPixels.width,
        cropPixels.height,
        0,
        0,
        cropPixels.width,
        cropPixels.height
      );
      if (!cancelled) setSrc(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.src = imageUrl;
    return () => {
      cancelled = true;
    };
  }, [imageUrl, cropPixels]);

  if (!src) return null;
  return (
    <img
      src={src}
      alt="preview"
      className="w-full h-full object-contain"
      style={{ filter: filterCss }}
    />
  );
}

const StoryEditor = memo(StoryEditorImpl);
export default StoryEditor;
