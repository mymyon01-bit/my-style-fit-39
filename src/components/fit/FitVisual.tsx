import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, AlertTriangle, RefreshCw, Share2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { CanvasTryOnState } from "@/hooks/useCanvasTryOn";
import { getBestTryOnImageSource, describeKind } from "@/lib/fit/getBestTryOnImageSource";

interface Props {
  productName: string;
  activeSize: string;
  state: CanvasTryOnState;
  /** Raw product image — final fallback so the preview is NEVER blank. */
  productImageUrl?: string | null;
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
  productImageUrl,
  onRescanBody,
  onReload,
}: Props) {
  // ── IMAGE PRIORITY (production-grade, never blank) ────────────────────
  // Priority order:
  //   1. AI-generated studio image (final, persisted to our storage)
  //   2. Canvas composite (deterministic, safe — NOT the user's raw photo)
  //   3. Fallback canvas (low-priority composite)
  //
  // The raw user photo is NEVER used as the final preview to honor the
  // "no original-scene contamination" rule. Broken URLs are demoted via
  // onError; the AI URL is sticky (CORS first-paint can fire spurious errors).
  const [failedSrcs, setFailedSrcs] = useState<string[]>([]);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  // Hard-fail timer: if nothing renders within 60s of a new request, surface
  // an honest "Preview unavailable" state with a retry CTA (no broken icon).
  const [hardFailed, setHardFailed] = useState(false);

  useEffect(() => {
    setFailedSrcs([]);
    setLoadedSrc(null);
    setHardFailed(false);
  }, [state.requestId]);

  useEffect(() => {
    if (state.aiImageUrl) {
      setHardFailed(false);
      return;
    }
    if (state.stage === "error") {
      setHardFailed(true);
      return;
    }
    // Give the AI generator more time — it's the only image we display.
    const t = window.setTimeout(() => setHardFailed(true), 90_000);
    return () => window.clearTimeout(t);
  }, [state.requestId, state.stage, state.aiImageUrl]);

  /** Validates the URL is something the browser can actually render. */
  const isRenderable = (url: string | null | undefined): url is string => {
    if (!url || typeof url !== "string") return false;
    const trimmed = url.trim();
    if (!trimmed || trimmed === "null" || trimmed === "undefined") return false;
    return /^(https?:\/\/|data:image\/|blob:)/i.test(trimmed);
  };

  // STRICT preview source selection — ONLY the AI studio image is shown.
  // Composite/fallback are intentionally hidden so the user never sees a
  // half-baked styled preview; instead they see the loading animation until
  // the real AI render is ready. This prevents the perceived "size changing"
  // between the styled preview and the final AI image.
  const best = useMemo(() => {
    if (isRenderable(state.aiImageUrl) && !failedSrcs.includes(state.aiImageUrl)) {
      return { src: state.aiImageUrl, kind: "ai" as const, isFinal: true };
    }
    return { src: null as string | null, kind: null as null | "ai", isFinal: false };
  }, [state.aiImageUrl, failedSrcs]);
  const previewSrc = best.src;

  const shouldRenderPreview = Boolean(previewSrc);
  const isLoading = !shouldRenderPreview && !hardFailed;
  const isRefining = false;
  const hasImage = shouldRenderPreview;

  useEffect(() => {
    setLoadedSrc(null);
  }, [previewSrc]);

  useEffect(() => {
    if (typeof window !== "undefined" && (window as unknown as { __FIT_DEBUG__?: boolean }).__FIT_DEBUG__) {
      console.log("[FIT_PREVIEW]", {
        event: "preview_render",
        requestId: state.requestId,
        stage: state.stage,
        kind: best.kind,
        isFinal: best.isFinal,
        previewSrc: previewSrc ? `${previewSrc.slice(0, 60)}…` : null,
        hardFailed,
      });
    }
  }, [state.requestId, state.stage, previewSrc, best.kind, best.isFinal, hardFailed]);

  const sourceLabel = "AI STUDIO PREVIEW";

  const handleShare = async () => {
    if (!previewSrc) return;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${productName} — try-on size ${activeSize}`,
          url: previewSrc,
        });
      } else {
        await navigator.clipboard.writeText(previewSrc);
        toast.success("Try-on image link copied");
      }
    } catch {
      try {
        await navigator.clipboard.writeText(previewSrc);
        toast.success("Try-on image link copied");
      } catch {
        toast.error("Couldn't share image");
      }
    }
  };

  const handleImageLoad = () => {
    if (!previewSrc) return;
    setLoadedSrc(previewSrc);
  };

  const handleImageError = () => {
    if (!previewSrc) return;
    // The AI URL is sticky — CORS first-paint can fire spurious errors.
    if (previewSrc === state.aiImageUrl) {
      console.warn("[FIT_PREVIEW]", { event: "ai_image_load_error_keeping", previewSrc: previewSrc.slice(0, 60) });
      return;
    }
    setFailedSrcs((prev) => (prev.includes(previewSrc) ? prev : [...prev, previewSrc]));
  };

  // Stage messaging
  const stageMessage = hardFailed
    ? "Image unavailable"
    : state.stage === "polling_ai" ? "Generating your try-on…"
    : state.stage === "compositing" ? "Preparing your try-on…"
    : "Generating your try-on…";

  const stageHint = hardFailed
    ? "We couldn't render this preview. Tap retry to try again — we never show broken images."
    : "AI is rendering you in this garment";

  return (
    <div className="group/visual space-y-3 overflow-hidden rounded-3xl border border-foreground/[0.08] bg-gradient-to-br from-card/80 via-card/50 to-card/20 p-3 shadow-[0_8px_40px_-16px_hsl(var(--accent)/0.18)] backdrop-blur-sm transition-shadow duration-300 hover:shadow-[0_8px_40px_-12px_hsl(var(--accent)/0.28)] sm:p-4">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="relative flex h-1.5 w-1.5">
            <span className={`absolute inline-flex h-full w-full rounded-full ${isLoading || isRefining ? "animate-ping bg-accent/60" : "bg-emerald-500/60"}`} />
            <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${isLoading || isRefining ? "bg-accent" : "bg-emerald-500"}`} />
          </span>
          <p className="text-[10px] font-bold tracking-[0.25em] text-foreground/55">VISUAL FIT</p>
        </div>
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
        {shouldRenderPreview ? (
          <>
            <div className="relative h-full w-full">
              {/* Skeleton sits BEHIND the image — never blocks/replaces it.
                  Image is always opacity-100 so cached images & SVG data URIs
                  show even if onLoad never fires (StrictMode, prefetched). */}
              {loadedSrc !== previewSrc && (
                <div className="absolute inset-0 animate-pulse bg-gradient-to-b from-foreground/[0.04] to-foreground/[0.02]" aria-hidden />
              )}
              <img
                key={previewSrc}
                src={previewSrc!}
                alt={`${productName} try-on, size ${activeSize}`}
                className="relative h-full w-full object-cover"
                loading="eager"
                decoding="async"
                onLoad={handleImageLoad}
                onError={handleImageError}
              />
            </div>
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
          // STATE 1 — LOADING (no image, no fallback): rich skeleton with
          // animated silhouette so the area never feels dead.
          <div className="relative h-full w-full overflow-hidden">
            {/* Soft animated gradient backdrop */}
            <div className="absolute inset-0 bg-gradient-to-br from-foreground/[0.05] via-accent/[0.04] to-foreground/[0.02]" />
            <motion.div
              aria-hidden
              className="absolute inset-0 bg-gradient-to-r from-transparent via-accent/[0.08] to-transparent"
              animate={{ x: ["-100%", "100%"] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
            />
            {/* Blurred silhouette placeholder */}
            <div className="absolute inset-0 flex items-end justify-center">
              <svg
                viewBox="0 0 200 280"
                className="h-[78%] w-auto opacity-[0.18]"
                fill="currentColor"
                aria-hidden
              >
                <ellipse cx="100" cy="44" rx="22" ry="26" />
                <path d="M52 110 Q100 80 148 110 L160 220 Q100 240 40 220 Z" />
                <rect x="60" y="200" width="32" height="78" rx="8" />
                <rect x="108" y="200" width="32" height="78" rx="8" />
              </svg>
            </div>
            {/* Status overlay */}
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-background/60 backdrop-blur-md ring-1 ring-foreground/10">
                {hardFailed ? (
                  <AlertTriangle className="h-4 w-4 text-foreground/60" />
                ) : (
                  <Loader2 className="h-4 w-4 animate-spin text-accent" />
                )}
              </div>
              <div className="space-y-2 text-center">
                <p className="text-[12px] font-semibold text-foreground/80">{stageMessage}</p>
                {!hardFailed && (
                  <div className="mx-auto h-1 w-32 overflow-hidden rounded-full bg-foreground/10">
                    <motion.div
                      className="h-full w-1/3 rounded-full bg-accent"
                      animate={{ x: ["-100%", "300%"] }}
                      transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
                    />
                  </div>
                )}
                <p className="text-[10px] tracking-[0.18em] text-foreground/45">
                  {stageHint}
                </p>
                {hardFailed && onReload && (
                  <button
                    onClick={onReload}
                    className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-foreground/15 bg-background/60 px-3 py-1.5 text-[10px] font-bold tracking-[0.18em] text-foreground/85 transition-colors hover:bg-foreground/10"
                  >
                    <RefreshCw className="h-3 w-3" /> RETRY
                  </button>
                )}
              </div>
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
        {best.isFinal
          ? "AI-refined preview"
          : state.poseDegraded
          ? "Style preview based on your measurements"
          : "Style preview built from your body photo"}
      </p>
    </div>
  );
}
