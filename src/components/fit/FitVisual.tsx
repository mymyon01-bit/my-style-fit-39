// ─── FIT VISUAL ─────────────────────────────────────────────────────────────
// HERO: procedural 3D avatar wearing a 3D garment shell that visibly
// responds to size + body. The Replicate AI Photo Try-On is now a
// secondary, collapsible panel below the 3D viewer.

import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, ChevronDown, Camera } from "lucide-react";
import { useState } from "react";
import SafeImage from "@/components/SafeImage";
import Fit3DViewer from "@/components/fit/Fit3DViewer";
import type { UserBody } from "@/lib/fit/bodyToAvatar";

interface Props {
  productImage: string;
  productName: string;
  category: string;
  activeSize: string;

  /** real user body if available — used by 3D avatar */
  userChestCm?: number;
  userShoulderCm?: number;
  userHeightCm?: number;
  userWeightKg?: number | null;
  userWaistCm?: number;
  userInseamCm?: number;

  /** AI try-on (secondary) */
  tryOnImageUrl?: string | null;
  tryOnStatus?:
    | "idle"
    | "generating"
    | "resolving_image"
    | "missing_image"
    | "ready"
    | "fallback"
    | "error"
    | "invalid_body";
  tryOnProvider?: "replicate" | "perplexity" | null;
  onRescanBody?: () => void;
}

export default function FitVisual({
  productImage,
  productName,
  category,
  activeSize,
  userChestCm,
  userShoulderCm,
  userHeightCm,
  userWeightKg,
  userWaistCm,
  userInseamCm,
  tryOnImageUrl,
  tryOnStatus = "idle",
  tryOnProvider,
  onRescanBody,
}: Props) {
  const [aiOpen, setAiOpen] = useState(false);

  const userBody: UserBody = {
    heightCm: userHeightCm ?? null,
    weightKg: userWeightKg ?? null,
    shoulderWidthCm: userShoulderCm ?? null,
    chestCm: userChestCm ?? null,
    waistCm: userWaistCm ?? null,
    inseamCm: userInseamCm ?? null,
  };

  const hasReal =
    !!tryOnImageUrl && (tryOnStatus === "ready" || tryOnStatus === "fallback");
  const isGenerating = tryOnStatus === "generating";
  const isResolvingImage = tryOnStatus === "resolving_image";
  const isMissingImage = tryOnStatus === "missing_image";

  const aiStatusLabel =
    hasReal && tryOnProvider === "replicate"
      ? "AI TRY-ON · READY"
      : hasReal && tryOnProvider === "perplexity"
      ? "AI TRY-ON · FALLBACK"
      : isGenerating
      ? "GENERATING…"
      : isResolvingImage
      ? "FETCHING IMAGE…"
      : isMissingImage
      ? "IMAGE REQUIRED"
      : tryOnStatus === "invalid_body"
      ? "BODY IMAGE NEEDED"
      : tryOnStatus === "error"
      ? "UNAVAILABLE"
      : "OPTIONAL";

  const aiStatusTone =
    hasReal && tryOnProvider === "replicate"
      ? "text-accent"
      : hasReal && tryOnProvider === "perplexity"
      ? "text-amber-400/90"
      : isMissingImage || tryOnStatus === "invalid_body"
      ? "text-amber-400/85"
      : tryOnStatus === "error"
      ? "text-orange-400/80"
      : "text-foreground/55";

  return (
    <div className="rounded-3xl border border-foreground/[0.08] bg-gradient-to-b from-card/60 to-card/20 p-5 space-y-4 overflow-hidden">
      {/* header */}
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold tracking-[0.25em] text-foreground/55">
          VISUAL FIT
        </p>
        <span className="flex items-center gap-1 text-[9px] font-semibold tracking-[0.18em] text-accent">
          <Sparkles className="h-2.5 w-2.5" /> 3D · SIZE {activeSize}
        </span>
      </div>

      {/* HERO — 3D viewer */}
      <Fit3DViewer
        productImage={productImage}
        productName={productName}
        category={category}
        size={activeSize}
        body={userBody}
        height={460}
      />

      <p className="text-center text-[10px] tracking-[0.18em] text-foreground/45">
        Drag to rotate · Size changes the garment live
      </p>

      {/* SECONDARY — AI Photo Try-On (collapsible) */}
      <div className="rounded-2xl border border-foreground/[0.06] bg-background/30 overflow-hidden">
        <button
          onClick={() => setAiOpen((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-foreground/[0.02]"
        >
          <div className="flex items-center gap-2.5">
            <Camera className="h-3.5 w-3.5 text-foreground/55" />
            <span className="text-[11px] font-bold tracking-[0.2em] text-foreground/75">
              AI PHOTO TRY-ON
            </span>
            <span className={`text-[9px] font-semibold tracking-[0.18em] ${aiStatusTone}`}>
              · {aiStatusLabel}
            </span>
          </div>
          <ChevronDown
            className={`h-4 w-4 text-foreground/45 transition-transform ${
              aiOpen ? "rotate-180" : ""
            }`}
          />
        </button>

        <AnimatePresence initial={false}>
          {aiOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 pt-1">
                <div className="relative mx-auto h-[360px] w-full max-w-[280px] overflow-hidden rounded-xl border border-foreground/[0.05] bg-foreground/[0.03]">
                  {hasReal ? (
                    <SafeImage
                      src={tryOnImageUrl!}
                      alt={`${productName} virtual try-on`}
                      className="h-full w-full object-cover"
                      fallbackClassName="h-full w-full bg-foreground/[0.05]"
                    />
                  ) : isGenerating || isResolvingImage ? (
                    <div className="flex h-full flex-col items-center justify-center gap-3">
                      <div className="h-1 w-24 overflow-hidden rounded-full bg-foreground/10">
                        <motion.div
                          className="h-full w-1/3 rounded-full bg-accent"
                          animate={{ x: ["-100%", "300%"] }}
                          transition={{ duration: 1.6, repeat: Infinity, ease: "linear" }}
                        />
                      </div>
                      <p className="text-[10px] font-semibold tracking-[0.22em] text-foreground/70">
                        {isResolvingImage ? "FETCHING PRODUCT IMAGE…" : "GENERATING PHOTO TRY-ON…"}
                      </p>
                    </div>
                  ) : tryOnStatus === "invalid_body" ? (
                    <div className="flex h-full flex-col items-center justify-center gap-3 px-5 text-center">
                      <p className="text-[11px] font-semibold leading-snug text-foreground/85">
                        Upload a full-body front photo to enable photo try-on
                      </p>
                      {onRescanBody && (
                        <button
                          onClick={onRescanBody}
                          className="rounded-full bg-accent px-4 py-1.5 text-[10px] font-bold tracking-[0.18em] text-accent-foreground hover:bg-accent/90"
                        >
                          SCAN BODY
                        </button>
                      )}
                    </div>
                  ) : isMissingImage ? (
                    <div className="flex h-full flex-col items-center justify-center gap-2 px-5 text-center">
                      <p className="text-[11px] font-semibold text-foreground/85">
                        Image required for try-on
                      </p>
                      <p className="text-[10px] text-foreground/55">
                        This product has no usable image.
                      </p>
                    </div>
                  ) : tryOnStatus === "error" ? (
                    <div className="flex h-full flex-col items-center justify-center gap-2 px-5 text-center">
                      <p className="text-[11px] font-semibold text-foreground/80">
                        Photo try-on unavailable
                      </p>
                      <p className="text-[10px] text-foreground/55">
                        The 3D fit above is your accurate preview.
                      </p>
                    </div>
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-2 px-5 text-center">
                      <Camera className="h-6 w-6 text-foreground/30" />
                      <p className="text-[10px] tracking-[0.18em] text-foreground/55">
                        OPTIONAL · AI-GENERATED
                      </p>
                      <p className="text-[10px] text-foreground/45 max-w-[210px] leading-relaxed">
                        Generates a photo of you wearing this item. The 3D fit above is the source of truth.
                      </p>
                    </div>
                  )}
                </div>
                {hasReal && tryOnProvider === "perplexity" && (
                  <p className="mt-2 text-center text-[9.5px] text-amber-400/75">
                    Reference look — not your exact try-on
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
