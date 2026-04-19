// ─── VISUAL FIT CARD ────────────────────────────────────────────────────────
// Minimal neutral mannequin SVG + product image overlay, with smooth CSS
// transforms driven by the visual fit engine. No uncanny humans, no static
// diagrams. Updates fluidly when the user switches sizes.

import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import SafeImage from "@/components/SafeImage";
import type { VisualTransform } from "@/lib/fit/visualFitEngine";
import { buildStyleContext } from "@/lib/fit/visualFitEngine";

interface Props {
  productImage: string;
  productName: string;
  category: string;
  activeSize: string;
  transform: VisualTransform;
}

export default function VisualFitCard({
  productImage,
  productName,
  category,
  activeSize,
  transform,
}: Props) {
  const isTop = category === "tops" || category === "outerwear";
  const styleCtx = buildStyleContext(transform.feel, category);

  // Mannequin proportions tuned for body frame
  const shoulderW = 96 * transform.bodyShoulderScale;
  const torsoH = 110 * transform.bodyTorsoScale;
  const waistW = shoulderW * 0.78;
  const hipW = shoulderW * 0.82;

  // Garment overlay positioning
  const garmentTop = isTop ? "18%" : "42%";
  const garmentHeight = isTop ? "44%" : "50%";

  return (
    <div className="rounded-3xl border border-foreground/[0.08] bg-gradient-to-b from-card/60 to-card/20 p-5 space-y-4 overflow-hidden">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold tracking-[0.25em] text-foreground/55">
          VISUAL FIT
        </p>
        <span className="text-[9px] font-semibold tracking-[0.18em] text-accent/80 flex items-center gap-1">
          <Sparkles className="h-2.5 w-2.5" /> SIZE {activeSize}
        </span>
      </div>

      {/* Stage */}
      <div className="relative mx-auto h-[340px] w-full max-w-[260px] rounded-2xl bg-gradient-to-b from-foreground/[0.03] to-foreground/[0.01] border border-foreground/[0.04] overflow-hidden">
        {/* Soft floor shadow */}
        <div
          className="absolute left-1/2 -translate-x-1/2 bottom-6 h-3 w-32 rounded-[50%] bg-foreground/15 blur-md"
          aria-hidden
        />

        {/* Mannequin SVG — neutral, minimal, never cartoonish */}
        <motion.svg
          viewBox="0 0 200 360"
          className="absolute inset-0 m-auto h-full w-full text-foreground/25"
          initial={false}
          animate={{
            scale: 1,
          }}
        >
          {/* Head */}
          <circle cx="100" cy="40" r="20" fill="currentColor" opacity="0.35" />
          {/* Neck */}
          <rect x="92" y="58" width="16" height="14" rx="3" fill="currentColor" opacity="0.30" />
          {/* Torso (animated by frame) */}
          <motion.path
            initial={false}
            animate={{
              d: `M ${100 - shoulderW / 2} 72
                  Q ${100 - shoulderW / 2 - 4} ${72 + torsoH * 0.5} ${100 - waistW / 2} ${72 + torsoH}
                  L ${100 + waistW / 2} ${72 + torsoH}
                  Q ${100 + shoulderW / 2 + 4} ${72 + torsoH * 0.5} ${100 + shoulderW / 2} 72 Z`,
            }}
            transition={{ type: "spring", stiffness: 180, damping: 22 }}
            fill="currentColor"
            opacity="0.28"
          />
          {/* Hips + legs */}
          <motion.path
            initial={false}
            animate={{
              d: `M ${100 - waistW / 2} ${72 + torsoH}
                  L ${100 - hipW / 2} ${72 + torsoH + 8}
                  L ${100 - hipW / 2 + 6} 320
                  L ${100 - 6} 320
                  L ${100 - 4} ${72 + torsoH + 12}
                  L ${100 + 4} ${72 + torsoH + 12}
                  L ${100 + 6} 320
                  L ${100 + hipW / 2 - 6} 320
                  L ${100 + hipW / 2} ${72 + torsoH + 8}
                  L ${100 + waistW / 2} ${72 + torsoH} Z`,
            }}
            transition={{ type: "spring", stiffness: 180, damping: 22 }}
            fill="currentColor"
            opacity="0.22"
          />
          {/* Arms (only visible behind garment edges) */}
          <rect x={100 - shoulderW / 2 - 6} y="74" width="6" height={torsoH * 0.85} rx="3" fill="currentColor" opacity="0.18" />
          <rect x={100 + shoulderW / 2} y="74" width="6" height={torsoH * 0.85} rx="3" fill="currentColor" opacity="0.18" />
        </motion.svg>

        {/* Garment overlay — transformed by visual fit engine */}
        {productImage ? (
          <motion.div
            className="absolute left-1/2 will-change-transform pointer-events-none"
            style={{
              top: garmentTop,
              height: garmentHeight,
              width: "70%",
              transformOrigin: "top center",
            }}
            initial={false}
            animate={{
              x: "-50%",
              y: transform.translateY,
              scaleX: transform.scaleX,
              scaleY: transform.scaleY,
              rotate: transform.waistTaper * 0.0, // taper kept subtle, reserved for future
            }}
            transition={{ type: "spring", stiffness: 220, damping: 24, mass: 0.6 }}
          >
            <SafeImage
              src={productImage}
              alt={productName}
              className="h-full w-full object-contain drop-shadow-[0_12px_24px_rgba(0,0,0,0.35)]"
              fallbackClassName="h-full w-full bg-foreground/[0.05] rounded-xl"
            />
          </motion.div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-[11px] text-foreground/40">
            No product image
          </div>
        )}
      </div>

      {/* Style Context — WARDROBE differentiator */}
      <div
        className={`rounded-xl border p-3 ${
          styleCtx.tone === "good"
            ? "border-green-500/20 bg-green-500/[0.04]"
            : styleCtx.tone === "warn"
            ? "border-orange-500/20 bg-orange-500/[0.04]"
            : "border-foreground/[0.08] bg-card/30"
        }`}
      >
        <p className="text-[9px] font-bold tracking-[0.22em] text-foreground/50 mb-1">
          STYLE CONTEXT
        </p>
        <p
          className={`text-[12px] leading-relaxed ${
            styleCtx.tone === "good"
              ? "text-green-400/90"
              : styleCtx.tone === "warn"
              ? "text-orange-400/90"
              : "text-foreground/75"
          }`}
        >
          {styleCtx.line}
        </p>
      </div>
    </div>
  );
}
