import { motion } from "framer-motion";
import { Sparkles, Camera, ImageOff, User, RefreshCw, Share2 } from "lucide-react";
import { toast } from "sonner";
import SafeImage from "@/components/SafeImage";
import type { FitVisualState } from "@/lib/fit/tryOnState";

export type TryOnUiStatus =
  | "idle"
  | "generating"
  | "resolving_image"
  | "missing_image"
  | "ready"
  | "fallback"
  | "error"
  | "invalid_body";

interface Props {
  productImage: string;
  productName: string;
  category: string;
  activeSize: string;
  tryOnImageUrl?: string | null;
  tryOnStatus?: TryOnUiStatus;
  tryOnProvider?: "replicate" | "perplexity" | "replicate-text" | null;
  tryOnMode?: "photo" | "text";
  cacheHit?: boolean;
  visualState?: FitVisualState;
  onRescanBody?: () => void;
  onReload?: () => void;
}

function FallbackSilhouette({ label }: { label: string }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-gradient-to-b from-foreground/[0.04] to-foreground/[0.02]">
      <User className="h-20 w-20 text-foreground/15" strokeWidth={1} />
      <p className="text-[10px] font-semibold tracking-[0.22em] text-foreground/45">{label}</p>
    </div>
  );
}

const mapLegacyState = (
  status: TryOnUiStatus,
  selectedSize: string,
  imageUrl?: string | null,
  provider?: "replicate" | "perplexity" | "replicate-text" | null
): FitVisualState => {
  if ((status === "ready" || status === "fallback") && imageUrl) {
    return { kind: "success", selectedSize, imageUrl, source: provider ?? "replicate-text" };
  }
  if (status === "generating" || status === "resolving_image") {
    return { kind: "loading", selectedSize, startedAt: Date.now() };
  }
  if (status === "missing_image" || status === "invalid_body" || status === "fallback") {
    return { kind: "fallback", selectedSize, reason: status };
  }
  if (status === "error") {
    return { kind: "error", selectedSize, message: "generation_failed" };
  }
  return { kind: "idle" };
};

export default function FitVisual({
  productName,
  activeSize,
  tryOnImageUrl,
  tryOnStatus = "idle",
  tryOnProvider,
  tryOnMode = "text",
  cacheHit = false,
  visualState,
  onRescanBody,
  onReload,
}: Props) {
  const state = visualState ?? mapLegacyState(tryOnStatus, activeSize, tryOnImageUrl, tryOnProvider);
  const hasReal = state.kind === "success" && !!state.imageUrl;
  const isLoading = state.kind === "loading" && Date.now() - state.startedAt < 12_000;
  const isFallback = state.kind === "fallback";
  const isError = state.kind === "error";
  const isInvalidBody = isFallback && state.reason === "invalid_body";
  const isMissing = isFallback && state.reason === "missing_image";

  const providerLabel =
    state.kind === "success"
      ? state.source === "replicate"
        ? "AI TRY-ON"
        : "STYLE PREVIEW"
      : tryOnMode === "photo"
      ? "AI TRY-ON"
      : "STYLE PREVIEW";

  const handleShareImage = async () => {
    if (state.kind !== "success" || !state.imageUrl) return;
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
      // user cancelled or share failed — try clipboard fallback silently
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
            {cacheHit && <span className="text-foreground/35"> · CACHED</span>}
          </span>
          {onReload && (
            <button
              onClick={onReload}
              disabled={state.kind === "loading"}
              aria-label="Reload try-on"
              className="flex h-6 w-6 items-center justify-center rounded-full border border-foreground/10 text-foreground/60 transition-colors hover:bg-foreground/5 hover:text-foreground disabled:opacity-40"
            >
              <RefreshCw className={`h-3 w-3 ${state.kind === "loading" ? "animate-spin" : ""}`} />
            </button>
          )}
          {state.kind === "success" && state.imageUrl && (
            <button
              onClick={handleShareImage}
              aria-label="Share try-on image"
              className="flex h-6 w-6 items-center justify-center rounded-full border border-foreground/10 text-foreground/60 transition-colors hover:bg-foreground/5 hover:text-foreground"
            >
              <Share2 className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      <div className="relative w-full overflow-hidden rounded-2xl border border-foreground/[0.06]" style={{ aspectRatio: "3 / 4", maxHeight: 560 }}>
        {hasReal ? (
          <SafeImage
            src={state.imageUrl}
            alt={`${productName} try-on, size ${activeSize}`}
            className="h-full w-full object-cover"
            fallbackClassName="h-full w-full"
            loading="lazy"
          />
        ) : isLoading ? (
          <div className="relative h-full w-full bg-gradient-to-b from-muted/40 to-muted/20">
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 px-6">
              <div className="h-1 w-40 overflow-hidden rounded-full bg-foreground/10">
                <motion.div
                  className="h-full w-1/3 rounded-full bg-accent"
                  animate={{ x: ["-100%", "300%"] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: "linear" }}
                />
              </div>
              <p className="text-[11px] font-semibold tracking-[0.22em] text-foreground/70">GENERATING TRY-ON</p>
              <p className="max-w-[280px] text-center text-[12px] leading-relaxed text-foreground/55">
                Building a realistic preview at size <strong className="text-foreground/80">{activeSize}</strong>
              </p>
            </div>
          </div>
        ) : isInvalidBody ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-gradient-to-b from-background/80 to-background/40 px-6 text-center">
            <Camera className="h-10 w-10 text-accent/70" strokeWidth={1.4} />
            <p className="max-w-[260px] text-[12px] font-semibold leading-snug text-foreground/85">
              Upload a full-body front photo for a personalized try-on
            </p>
            <p className="max-w-[240px] text-[10px] leading-relaxed text-foreground/45">
              We&apos;ll show a style preview meanwhile.
            </p>
            {onRescanBody && (
              <button
                onClick={onRescanBody}
                className="rounded-full bg-accent px-5 py-2 text-[10px] font-bold tracking-[0.18em] text-accent-foreground transition-colors hover:bg-accent/90"
              >
                SCAN BODY
              </button>
            )}
          </div>
        ) : isMissing ? (
          <div className="relative h-full w-full">
            <FallbackSilhouette label="PREVIEW UNAVAILABLE" />
            <div className="absolute bottom-4 left-0 right-0 px-6 text-center">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-[10px] text-amber-400/90">
                <ImageOff className="h-3 w-3" /> Product image missing
              </div>
            </div>
          </div>
        ) : isFallback ? (
          <div className="relative h-full w-full">
            <FallbackSilhouette label="PREVIEW UNAVAILABLE" />
          </div>
        ) : isError ? (
          <div className="relative h-full w-full">
            <FallbackSilhouette label="PREVIEW UNAVAILABLE" />
          </div>
        ) : (
          <div className="relative h-full w-full">
            <FallbackSilhouette label="PREVIEW UNAVAILABLE" />
          </div>
        )}

        {hasReal && (
          <div className="absolute bottom-3 left-3 rounded-full bg-background/70 px-2.5 py-1 backdrop-blur-md">
            <span className="text-[9px] font-semibold tracking-[0.18em] text-foreground/80">{providerLabel}</span>
          </div>
        )}
      </div>

      <p className="text-center text-[10px] tracking-[0.18em] text-foreground/45">
        {hasReal
          ? tryOnMode === "photo"
            ? "Generated from your body photo"
            : "Style preview · upload a body photo for personal try-on"
          : isLoading
          ? "Usually ready in a few seconds"
          : "Fit breakdown stays available even if preview fails"}
      </p>
    </div>
  );
}
