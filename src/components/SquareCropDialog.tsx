import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Cropper, { Area } from "react-easy-crop";
import { X, Check, RotateCw } from "lucide-react";
import { Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  /** Source file the user just picked. Will be displayed in the cropper. */
  file: File | null;
  onClose: () => void;
  onCropped: (croppedFile: File) => void;
  title?: string;
}

const OUTPUT_SIZE = 1440; // 1:1 px — high enough for retina, small enough to upload quickly

/**
 * Reusable 1:1 crop modal used by every photo-upload entry point in the app
 * (OOTD posts, Stories, etc). Renders a fullscreen cropper that locks the
 * aspect ratio to a square so the OOTD grid + story thumbnails stay aligned.
 */
const SquareCropDialog = ({ open, file, onClose, onCropped, title = "Adjust photo" }: Props) => {
  const [src, setSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [pixels, setPixels] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!file) { setSrc(null); return; }
    const url = URL.createObjectURL(file);
    setSrc(url);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
    setPixels(null);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const onCropComplete = useCallback((_: Area, areaPx: Area) => setPixels(areaPx), []);

  const handleConfirm = async () => {
    if (!file || !src || !pixels) return;
    setBusy(true);
    try {
      const blob = await renderCroppedSquare(src, pixels, rotation);
      const newName = file.name.replace(/\.(heic|heif|png|webp|jpe?g)$/i, "") + ".jpg";
      const out = new File([blob], newName || `photo-${Date.now()}.jpg`, {
        type: "image/jpeg",
        lastModified: Date.now(),
      });
      onCropped(out);
    } catch (e) {
      console.error("[crop] failed", e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatePresence>
      {open && file && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] bg-black/95 flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 text-white">
            <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/10">
              <X className="h-5 w-5" />
            </button>
            <p className="text-[12px] font-semibold tracking-[0.18em] uppercase">{title}</p>
            <button
              onClick={handleConfirm}
              disabled={busy || !pixels}
              className="p-1.5 rounded-full text-accent hover:bg-white/10 disabled:opacity-40"
              aria-label="Use cropped photo"
            >
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" strokeWidth={3} />}
            </button>
          </div>

          {/* Cropper canvas */}
          <div className="relative flex-1">
            {src && (
              <Cropper
                image={src}
                crop={crop}
                zoom={zoom}
                rotation={rotation}
                aspect={1}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onRotationChange={setRotation}
                onCropComplete={onCropComplete}
                showGrid
                cropShape="rect"
                objectFit="contain"
                style={{
                  containerStyle: { background: "#000" },
                  cropAreaStyle: { border: "1px solid rgba(255,255,255,0.6)" },
                }}
              />
            )}
          </div>

          {/* Controls */}
          <div className="px-6 py-5 space-y-3 bg-black text-white">
            <div className="flex items-center gap-3">
              <span className="text-[10px] tracking-[0.2em] text-white/50 w-10">ZOOM</span>
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="flex-1 accent-white"
              />
              <button
                onClick={() => setRotation((r) => (r + 90) % 360)}
                className="p-2 rounded-full bg-white/10 hover:bg-white/20"
                aria-label="Rotate 90 degrees"
              >
                <RotateCw className="h-4 w-4" />
              </button>
            </div>
            <p className="text-[10px] text-white/40 text-center">
              Drag to reposition · pinch / slider to zoom · 1:1 square output
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

async function renderCroppedSquare(src: string, area: Area, rotation: number): Promise<Blob> {
  const img = new Image();
  img.crossOrigin = "anonymous";
  await new Promise<void>((res, rej) => {
    img.onload = () => res();
    img.onerror = () => rej(new Error("image load failed"));
    img.src = src;
  });

  const canvas = document.createElement("canvas");
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unavailable");

  if (rotation) {
    // When rotated, draw onto an intermediate rotated canvas first
    const rad = (rotation * Math.PI) / 180;
    const sin = Math.abs(Math.sin(rad));
    const cos = Math.abs(Math.cos(rad));
    const w = img.width;
    const h = img.height;
    const rotW = w * cos + h * sin;
    const rotH = w * sin + h * cos;
    const rot = document.createElement("canvas");
    rot.width = rotW;
    rot.height = rotH;
    const rctx = rot.getContext("2d")!;
    rctx.translate(rotW / 2, rotH / 2);
    rctx.rotate(rad);
    rctx.drawImage(img, -w / 2, -h / 2);
    ctx.drawImage(rot, area.x, area.y, area.width, area.height, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
  } else {
    ctx.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
  }

  return new Promise<Blob>((res, rej) => {
    canvas.toBlob((b) => (b ? res(b) : rej(new Error("toBlob failed"))), "image/jpeg", 0.9);
  });
}

export default SquareCropDialog;
