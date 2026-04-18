import { memo, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, RefreshCw, ExternalLink, AlertTriangle, Sparkles, Upload, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import SafeImage from "@/components/SafeImage";
import { RegionFit } from "@/lib/fitEngine";
import { fitBucket, bucketColor } from "@/components/fit/BodySilhouette";

/**
 * Async try-on modal — Replicate provider.
 * Layout never changes. Fit card stays mounted; this modal is async-only.
 * Includes toggleable fit annotation overlay on the generated image.
 */

export interface TryOnContext {
  userImageUrl: string;
  productImageUrl: string;
  productName: string;
  productBrand: string;
  productUrl: string;
  category: string;
  recommendedSize: string;
  confidence: string;
  fitDescriptor?: string;
  productKey: string;
  regions: RegionFit[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  context: TryOnContext | null;
}

type Status = "idle" | "generating" | "ready" | "failed";

// Anchor points (% of image) for region pills overlaid on the try-on image
const REGION_ANCHORS: Record<string, { top: number; side: "left" | "right" }> = {
  Shoulder: { top: 18, side: "right" },
  Sleeve:   { top: 30, side: "left"  },
  Chest:    { top: 32, side: "right" },
  Waist:    { top: 48, side: "right" },
  Hip:      { top: 58, side: "left"  },
  Rise:     { top: 60, side: "right" },
  Thigh:    { top: 70, side: "left"  },
  Length:   { top: 82, side: "right" },
  Inseam:   { top: 88, side: "left"  },
};

function FitOverlay({ regions }: { regions: RegionFit[] }) {
  return (
    <div className="absolute inset-0 pointer-events-none">
      {regions.map((r) => {
        const anchor = REGION_ANCHORS[r.region];
        if (!anchor) return null;
        const color = bucketColor(fitBucket(r.fit));
        const isLeft = anchor.side === "left";
        return (
          <div
            key={r.region}
            className={`absolute flex items-center gap-1 ${isLeft ? "left-2" : "right-2"}`}
            style={{ top: `${anchor.top}%` }}
          >
            {!isLeft && (
              <span className="h-px w-3" style={{ backgroundColor: color, opacity: 0.85 }} />
            )}
            <div
              className="flex items-center gap-1 rounded-full px-1.5 py-[3px] backdrop-blur-md"
              style={{
                backgroundColor: "hsla(0,0%,5%,0.55)",
                border: `1px solid ${color}`,
              }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full shrink-0"
                style={{ backgroundColor: color }}
              />
              <span className="text-[8.5px] font-bold uppercase tracking-wider text-white">
                {r.region}: {r.fit.replace(/-/g, " ")}
              </span>
            </div>
            {isLeft && (
              <span className="h-px w-3" style={{ backgroundColor: color, opacity: 0.85 }} />
            )}
          </div>
        );
      })}
    </div>
  );
}


const POLL_INTERVAL_MS = 2500;
const POLL_MAX_ATTEMPTS = 48; // ~2 minutes

function TryOnPreviewModalImpl({ open, onClose, context }: Props) {
  const [status, setStatus] = useState<Status>("idle");
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [overrideUserImage, setOverrideUserImage] = useState<string | null>(null);
  const [predictionId, setPredictionId] = useState<string | null>(null);
  const [showOverlay, setShowOverlay] = useState<boolean>(true);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const pollRef = useRef<number | null>(null);

  const stopPolling = () => {
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  useEffect(() => {
    if (open && context && status === "idle") {
      void generate(false);
    }
    if (!open) {
      stopPolling();
      setStatus("idle");
      setResultUrl(null);
      setError(null);
      setOverrideUserImage(null);
      setPredictionId(null);
    }
    return () => stopPolling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const pollUntilDone = (id: string) => {
    stopPolling();
    let attempts = 0;
    pollRef.current = window.setInterval(async () => {
      attempts++;
      try {
        const { data, error: invokeErr } = await supabase.functions.invoke(
          `fit-tryon-replicate?id=${encodeURIComponent(id)}`,
          { method: "GET" }
        );
        if (invokeErr) throw invokeErr;
        console.log("[TryOn] poll", id, data?.status);
        if (data?.status === "succeeded" && data?.resultImageUrl) {
          stopPolling();
          setResultUrl(data.resultImageUrl);
          setStatus("ready");
          return;
        }
        if (data?.status === "failed" || data?.status === "canceled") {
          stopPolling();
          setError(data?.error || "Preview unavailable right now");
          setStatus("failed");
          return;
        }
        if (attempts >= POLL_MAX_ATTEMPTS) {
          stopPolling();
          setError("Preview is taking too long. Try again.");
          setStatus("failed");
        }
      } catch (e: any) {
        console.error("[TryOn] poll error", e);
        stopPolling();
        setError(e?.message || "Preview unavailable right now");
        setStatus("failed");
      }
    }, POLL_INTERVAL_MS);
  };

  const generate = async (forceRegenerate: boolean) => {
    if (!context) return;
    stopPolling();
    setStatus("generating");
    setError(null);
    setResultUrl(null);
    try {
      console.log("[TryOn] start", { productKey: context.productKey, size: context.recommendedSize, force: forceRegenerate });
      const { data, error } = await supabase.functions.invoke("fit-tryon-replicate", {
        body: {
          userImageUrl: overrideUserImage || context.userImageUrl,
          productImageUrl: context.productImageUrl,
          productKey: context.productKey,
          productCategory: context.category,
          selectedSize: context.recommendedSize,
          fitSummary: { fitType: context.fitDescriptor, confidence: context.confidence },
          forceRegenerate,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      console.log("[TryOn] created", data);
      if (data?.status === "succeeded" && data?.resultImageUrl) {
        setResultUrl(data.resultImageUrl);
        setStatus("ready");
        return;
      }
      if (data?.predictionId) {
        setPredictionId(data.predictionId);
        pollUntilDone(data.predictionId);
        return;
      }
      throw new Error("No prediction returned");
    } catch (e: any) {
      console.error("[TryOn] error", e);
      setError(e?.message || "Preview unavailable right now");
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
      setTimeout(() => void generate(true), 50);
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
            {/* TOP BAR */}
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

            {/* MAIN */}
            <div className="flex-1 overflow-y-auto">
              <div className="relative w-full aspect-[3/4] bg-foreground/[0.03]">
                {status === "generating" && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-accent" />
                    <p className="text-[11px] tracking-[0.2em] text-foreground/60">
                      GENERATING PREVIEW…
                    </p>
                    <p className="text-[10px] text-foreground/40">This usually takes 20–60 seconds.</p>
                  </div>
                )}
                {status === "ready" && resultUrl && (
                  <>
                    <SafeImage
                      src={resultUrl}
                      alt="Virtual try-on"
                      className="w-full h-full object-cover"
                      fallbackClassName="w-full h-full bg-foreground/[0.04] flex items-center justify-center"
                    />
                    {showOverlay && context.regions?.length > 0 && (
                      <FitOverlay regions={context.regions} />
                    )}
                    {/* Toggle overlay */}
                    <button
                      onClick={() => setShowOverlay((v) => !v)}
                      className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-black/55 backdrop-blur-md px-2.5 py-1.5 border border-white/15 text-white text-[9px] font-bold tracking-[0.15em] uppercase pointer-events-auto hover:bg-black/70 transition-colors"
                      title={showOverlay ? "Hide fit annotations" : "Show fit annotations"}
                    >
                      {showOverlay ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                      {showOverlay ? "FIT ON" : "FIT OFF"}
                    </button>
                    {/* Size badge bottom-left */}
                    <div className="absolute bottom-2 left-2 rounded-full bg-black/55 backdrop-blur-md px-2.5 py-1 border border-white/15">
                      <span className="text-white text-[9px] font-bold tracking-[0.2em]">
                        SIZE {context.recommendedSize}
                      </span>
                    </div>
                  </>
                )}
                {status === "failed" && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
                    <AlertTriangle className="h-7 w-7 text-orange-500" />
                    <p className="text-[12px] text-foreground/70">Preview unavailable right now</p>
                    {error && <p className="text-[10px] text-foreground/40">{error}</p>}
                    <p className="text-[10px] text-foreground/40">
                      Your fit recommendation is still valid below.
                    </p>
                  </div>
                )}
              </div>

              {/* META */}
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

                {/* ACTIONS */}
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
                    onClick={() => generate(true)}
                    disabled={status === "generating"}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-foreground/10 bg-foreground/[0.03] px-3 py-2.5 text-[11px] font-semibold text-foreground/70 hover:bg-foreground/[0.06] disabled:opacity-40 transition-colors"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${status === "generating" ? "animate-spin" : ""}`} />
                    {status === "failed" ? "RETRY" : "REGENERATE"}
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
