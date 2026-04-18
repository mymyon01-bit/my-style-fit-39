import { memo, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, RefreshCw, ExternalLink, AlertTriangle, Sparkles, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import SafeImage from "@/components/SafeImage";

/**
 * Hardcoded try-on result modal.
 * Layout never changes — only the image and metadata inside the slots.
 */

export interface TryOnContext {
  userImageUrl: string;
  productImageUrl: string;
  productName: string;
  productBrand: string;
  productUrl: string;
  category: string;
  recommendedSize: string;
  confidence: string; // HIGH | MEDIUM | LOW
  fitDescriptor?: string; // e.g. "slim", "oversized", "relaxed"
}

interface Props {
  open: boolean;
  onClose: () => void;
  context: TryOnContext | null;
}

type Status = "idle" | "generating" | "ready" | "failed";

function TryOnPreviewModalImpl({ open, onClose, context }: Props) {
  const [status, setStatus] = useState<Status>("idle");
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [overrideUserImage, setOverrideUserImage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open && context && status === "idle") {
      void generate();
    }
    if (!open) {
      setStatus("idle");
      setResultUrl(null);
      setError(null);
      setOverrideUserImage(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const generate = async () => {
    if (!context) return;
    setStatus("generating");
    setError(null);
    try {
      const { data, error } = await supabase.functions.invoke("fit-tryon", {
        body: {
          userImageUrl: overrideUserImage || context.userImageUrl,
          productImageUrl: context.productImageUrl,
          category: context.category,
          fitDescriptor: context.fitDescriptor,
          size: context.recommendedSize,
        },
      });
      if (error) throw error;
      if (!data?.resultImageUrl) throw new Error("No image returned");
      setResultUrl(data.resultImageUrl);
      setStatus("ready");
    } catch (e: any) {
      setError(e?.message || "Try-on generation failed");
      setStatus("failed");
    }
  };

  const handleUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setOverrideUserImage(dataUrl);
      setStatus("idle");
      setResultUrl(null);
      setTimeout(() => void generate(), 50);
    };
    reader.readAsDataURL(file);
  };

  return (
    <AnimatePresence>
      {open && context && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-3xl border border-foreground/10 bg-card overflow-hidden flex flex-col max-h-[90vh]"
          >
            {/* TOP BAR — fixed */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-foreground/[0.06]">
              <button
                onClick={onClose}
                className="text-foreground/60 hover:text-foreground transition-colors"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-3 w-3 text-accent" />
                <span className="text-[10px] font-bold tracking-[0.2em] text-foreground/70">
                  TRY-ON PREVIEW
                </span>
              </div>
              <div className="w-5" />
            </div>

            {/* MAIN — fixed 3:4 image slot */}
            <div className="flex-1 overflow-y-auto">
              <div className="relative w-full aspect-[3/4] bg-foreground/[0.03]">
                {status === "generating" && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-accent" />
                    <p className="text-[11px] tracking-[0.2em] text-foreground/60">
                      GENERATING PREVIEW…
                    </p>
                  </div>
                )}
                {status === "ready" && resultUrl && (
                  <SafeImage
                    src={resultUrl}
                    alt="Virtual try-on"
                    className="w-full h-full object-cover"
                    fallbackClassName="w-full h-full bg-foreground/[0.04] flex items-center justify-center"
                  />
                )}
                {status === "failed" && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
                    <AlertTriangle className="h-7 w-7 text-orange-500" />
                    <p className="text-[12px] text-foreground/70">{error}</p>
                    <p className="text-[10px] text-foreground/40">
                      Your fit recommendation is still valid below.
                    </p>
                  </div>
                )}
              </div>

              {/* META — fixed slot */}
              <div className="px-5 py-4 border-t border-foreground/[0.06]">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-[9px] tracking-[0.2em] text-foreground/45 uppercase">
                      {context.productBrand}
                    </p>
                    <p className="text-[12px] font-semibold text-foreground/90 line-clamp-1">
                      {context.productName}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] tracking-[0.2em] text-foreground/45">SIZE</p>
                    <p className="font-display text-2xl font-bold text-foreground">
                      {context.recommendedSize}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 mb-4">
                  <span className="text-[9px] font-bold tracking-[0.15em] px-2 py-0.5 rounded-full bg-accent/10 text-accent">
                    {context.confidence} CONFIDENCE
                  </span>
                </div>

                {/* ACTIONS — fixed row */}
                <div className="flex items-center gap-2">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
                  />
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={status === "generating"}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-foreground/10 bg-foreground/[0.03] px-3 py-2.5 text-[11px] font-semibold text-foreground/70 hover:bg-foreground/[0.06] disabled:opacity-40 transition-colors"
                    title="Upload your own photo"
                  >
                    <Upload className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={generate}
                    disabled={status === "generating"}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-foreground/10 bg-foreground/[0.03] px-3 py-2.5 text-[11px] font-semibold text-foreground/70 hover:bg-foreground/[0.06] disabled:opacity-40 transition-colors"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${status === "generating" ? "animate-spin" : ""}`} />
                    REGENERATE
                  </button>
                  {context.productUrl && context.productUrl !== "#" && (
                    <a
                      href={context.productUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-foreground py-2.5 text-[11px] font-semibold text-background hover:opacity-90 transition-opacity"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      SHOP NOW
                    </a>
                  )}
                </div>
                {overrideUserImage && (
                  <p className="mt-2 text-[9px] tracking-[0.15em] text-accent/70 text-center">
                    USING UPLOADED PHOTO
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const TryOnPreviewModal = memo(TryOnPreviewModalImpl);
export default TryOnPreviewModal;
