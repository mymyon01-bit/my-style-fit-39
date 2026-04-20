import { motion } from "framer-motion";
import { Sparkles, AlertTriangle, RefreshCw, Share2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import SafeImage from "@/components/SafeImage";
import type { CanvasTryOnState } from "@/hooks/useCanvasTryOn";

interface Props {
  productName: string;
  activeSize: string;
  state: CanvasTryOnState;
  onRescanBody?: () => void;
  onReload?: () => void;
}

const TONE_STYLE: Record<string, { dot: string; label: string }> = {
  tight: { dot: "bg-orange-500", label: "TIGHT" },
  regular: { dot: "bg-emerald-500", label: "REGULAR" },
  loose: { dot: "bg-sky-500", label: "LOOSE" },
};

export default function FitVisual({
  productName,
  activeSize,
  state,
  onRescanBody,
  onReload,
}: Props) {
  const isLoading = !state.imageUrl;
  const isRefining = state.stage === "refining";
  const hasImage = !!state.imageUrl;

  const sourceLabel =
    state.source === "ai" ? "AI TRY-ON" : "STYLE PREVIEW";

  const handleShare = async () => {
    if (!state.imageUrl) return;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${productName} — try-on size ${activeSize}`,
          url: state.imageUrl,
        });
      } else {
        await navigator.clipboard.writeText(state.imageUrl);
        toast.success("Try-on image link copied");
      }
    } catch {
      try {
        await navigator.clipboard.writeText(state.imageUrl);
        toast.success("Try-on image link copied");
      } catch {
        toast.error("Couldn't share image");
      }
    }
  };

  return (
    <div className="space-y-3 overflow-hidden rounded-3xl border border-foreground/[0.08] bg-gradient-to-b from-card/60 to-card/20 p-3 sm:p-4">
      <div className="flex items-center justify-between px-1">
        <p className="text-[10px] font-bold tracking-[0.25em] text-foreground/55">VISUAL FIT</p>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-[9px] font-semibold tracking-[0.18em] text-accent">
            <Sparkles className="h-2.5 w-2.5" /> SIZE {activeSize}
            {isRefining && <span className="text-foreground/35"> · REFINING</span>}
          </span>
          {onReload && (
            <button
              onClick={onReload}
              disabled={isLoading}
              aria-label="Reload try-on"
              className="flex h-6 w-6 items-center justify-center rounded-full border border-foreground/10 text-foreground/60 transition-colors hover:bg-foreground/5 hover:text-foreground disabled:opacity-40"
            >
              <RefreshCw className={`h-3 w-3 ${isLoading ? "animate-spin" : ""}`} />
            </button>
          )}
          {hasImage && (
            <button
              onClick={handleShare}
              aria-label="Share try-on image"
              className="flex h-6 w-6 items-center justify-center rounded-full border border-foreground/10 text-foreground/60 transition-colors hover:bg-foreground/5 hover:text-foreground"
            >
              <Share2 className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      <div
        className="relative w-full overflow-hidden rounded-2xl border border-foreground/[0.06] bg-muted/20"
        style={{ aspectRatio: "3 / 4", maxHeight: 560 }}
      >
        {hasImage ? (
          <>
            <SafeImage
              src={state.imageUrl!}
              alt={`${productName} try-on, size ${activeSize}`}
              className="h-full w-full object-cover"
              fallbackClassName="h-full w-full"
              loading="lazy"
            />
            <div className="absolute bottom-3 left-3 rounded-full bg-background/70 px-2.5 py-1 backdrop-blur-md">
              <span className="text-[9px] font-semibold tracking-[0.18em] text-foreground/80">
                {sourceLabel}
              </span>
            </div>
            {isRefining && (
              <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-background/70 px-2.5 py-1 backdrop-blur-md">
                <Loader2 className="h-3 w-3 animate-spin text-accent" />
                <span className="text-[9px] font-semibold tracking-[0.18em] text-foreground/80">
                  ENHANCING
                </span>
              </div>
            )}
          </>
        ) : (
          <div className="relative h-full w-full">
            <div className="absolute inset-0 animate-pulse bg-gradient-to-b from-foreground/[0.04] to-foreground/[0.02]" />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6">
              <div className="h-1 w-40 overflow-hidden rounded-full bg-foreground/10">
                <motion.div
                  className="h-full w-1/3 rounded-full bg-accent"
                  animate={{ x: ["-100%", "300%"] }}
                  transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
                />
              </div>
              <p className="text-[11px] font-semibold tracking-[0.22em] text-foreground/70">
                {state.stage === "pose"
                  ? "READING BODY"
                  : state.stage === "cutout"
                  ? "PREPARING GARMENT"
                  : "PREPARING PREVIEW"}
              </p>
            </div>
          </div>
        )}
      </div>

      {state.poseDegraded && hasImage && (
        <div className="flex items-start gap-2 rounded-xl border border-orange-500/20 bg-orange-500/[0.06] px-3 py-2">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-orange-500" />
          <div className="flex-1 space-y-1">
            <p className="text-[11px] font-semibold leading-tight text-foreground/85">
              Approximate fit preview
            </p>
            <p className="text-[10px] leading-relaxed text-foreground/55">
              Upload a clearer full-body front photo for a more personal try-on.
            </p>
          </div>
          {onRescanBody && (
            <button
              onClick={onRescanBody}
              className="shrink-0 rounded-full bg-foreground/10 px-3 py-1 text-[9px] font-bold tracking-[0.18em] text-foreground/85 transition-colors hover:bg-foreground/15"
            >
              UPLOAD
            </button>
          )}
        </div>
      )}

      {state.fitChips.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-1">
          {state.fitChips.map((chip) => {
            const tone = TONE_STYLE[chip.tone] ?? TONE_STYLE.regular;
            return (
              <div
                key={chip.region}
                className="flex items-center gap-1.5 rounded-full border border-foreground/10 bg-background/50 px-2.5 py-1"
              >
                <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
                <span className="text-[9px] font-semibold tracking-[0.14em] text-foreground/70">
                  {chip.region.toUpperCase()}
                </span>
                <span className="text-[9px] font-bold tracking-[0.14em] text-foreground/90">
                  {tone.label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-center text-[10px] tracking-[0.18em] text-foreground/45">
        {state.source === "ai"
          ? "AI-refined preview"
          : state.poseDegraded
          ? "Style preview based on your measurements"
          : "Style preview built from your body photo"}
      </p>
    </div>
  );
}
