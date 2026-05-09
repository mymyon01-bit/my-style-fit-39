import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  images: string[];
  startIndex?: number;
  open: boolean;
  onClose: () => void;
}

export default function ImageLightbox({ images, startIndex = 0, open, onClose }: Props) {
  const [idx, setIdx] = useState(startIndex);

  useEffect(() => { if (open) setIdx(startIndex); }, [open, startIndex]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setIdx(i => Math.min(i + 1, images.length - 1));
      if (e.key === "ArrowLeft") setIdx(i => Math.max(i - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open, images.length, onClose]);

  if (!open || images.length === 0) return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-[400] flex items-center justify-center bg-black/95 backdrop-blur-sm"
      >
        <button onClick={onClose}
          className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20">
          <X className="h-5 w-5" />
        </button>

        {images.length > 1 && idx > 0 && (
          <button onClick={(e) => { e.stopPropagation(); setIdx(i => i - 1); }}
            className="absolute left-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20">
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}
        {images.length > 1 && idx < images.length - 1 && (
          <button onClick={(e) => { e.stopPropagation(); setIdx(i => i + 1); }}
            className="absolute right-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20">
            <ChevronRight className="h-6 w-6" />
          </button>
        )}

        <motion.img
          key={idx}
          initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
          src={images[idx]} alt=""
          onClick={(e) => e.stopPropagation()}
          className="max-h-[92vh] max-w-[94vw] object-contain rounded-lg select-none"
        />

        {images.length > 1 && (
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-white tabular-nums">
            {idx + 1} / {images.length}
          </div>
        )}
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
