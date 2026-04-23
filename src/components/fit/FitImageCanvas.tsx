// ─── FIT IMAGE CANVAS ───────────────────────────────────────────────────────
// Wraps the AI-generated try-on image in a canvas and applies a deterministic
// per-size silhouette warp so S / M / L / XL are ALWAYS visibly different —
// even when the underlying AI output is nearly identical between sizes
// (which Nano Banana / IDM-VTON often is).
//
// Strategy: keep the head/face region (top ~22% of the image) intact, then
// apply scaleX / scaleY to the body band underneath plus optional shoulder
// drop and hem extension. Tension / drape overlays are decorative.
//
// This is render-only — it does NOT replace the AI image, it transforms it.
// If the canvas fails to draw, we fall back to the raw AI image silently.

import { forwardRef, useEffect, useRef, useState } from "react";
import type { SizeWarpProfile } from "@/lib/fit/sizeWarpProfile";

interface Props {
  src: string;
  alt: string;
  profile: SizeWarpProfile;
  className?: string;
  onLoaded?: () => void;
  onError?: () => void;
}

const HEAD_BAND = 0.22; // top 22% kept un-warped (head + neck)

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("img_load_failed"));
    img.src = url;
  });
}

function drawDrapeLines(
  ctx: CanvasRenderingContext2D,
  cx: number,
  topY: number,
  width: number,
  height: number,
  intensity: number,
) {
  if (intensity <= 0) return;
  const count = Math.round(2 + intensity * 6);
  const usableW = width * 0.70;
  const left = cx - usableW / 2;
  const step = usableW / (count + 1);
  ctx.save();
  ctx.globalAlpha = Math.min(0.28, 0.10 + intensity);
  ctx.strokeStyle = "rgba(0,0,0,0.55)";
  ctx.lineWidth = 1;
  for (let i = 1; i <= count; i++) {
    const x = left + step * i;
    const sway = (i % 2 === 0 ? 1 : -1) * (1.5 + intensity * 4);
    ctx.beginPath();
    ctx.moveTo(x, topY);
    ctx.quadraticCurveTo(x + sway, topY + height / 2, x, topY + height);
    ctx.stroke();
  }
  ctx.restore();
}

function drawTensionLines(
  ctx: CanvasRenderingContext2D,
  cx: number,
  topY: number,
  width: number,
  height: number,
  intensity: number,
) {
  if (intensity <= 0) return;
  const count = Math.round(3 + intensity * 5);
  const usableH = height * 0.55;
  const top = topY + height * 0.15;
  const step = usableH / (count + 1);
  ctx.save();
  ctx.globalAlpha = Math.min(0.30, 0.10 + intensity);
  ctx.strokeStyle = "rgba(0,0,0,0.55)";
  ctx.lineWidth = 1;
  const halfW = width * 0.32;
  for (let i = 1; i <= count; i++) {
    const y = top + step * i;
    const dy = (i % 2 === 0 ? -1 : 1) * intensity * 4;
    ctx.beginPath();
    ctx.moveTo(cx - halfW, y);
    ctx.quadraticCurveTo(cx, y + dy, cx + halfW, y);
    ctx.stroke();
  }
  ctx.restore();
}

const FitImageCanvas = forwardRef<HTMLCanvasElement, Props>(function FitImageCanvas(
  { src, alt, profile, className, onLoaded, onError },
  _externalRef,
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    setReady(false);

    (async () => {
      try {
        const img = await loadImage(src);
        if (cancelled) return;
        const canvas = canvasRef.current;
        if (!canvas) return;

        // Render at native image size for crispness — CSS handles fit.
        const W = img.naturalWidth || img.width;
        const H = img.naturalHeight || img.height;
        canvas.width = W;
        canvas.height = H;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("ctx_unavailable");

        // 1. Background (slight studio fill so warp gaps blend).
        ctx.fillStyle = "rgba(238,236,232,1)";
        ctx.fillRect(0, 0, W, H);

        // 2. Head band — drawn unwarped on top later (we draw body first).
        const headH = H * HEAD_BAND;
        const bodyTopY = headH;
        const bodyH = H - headH;

        // 3. Body band — warped by profile.
        const targetW = W * profile.scaleX;
        const offsetX = (W - targetW) / 2;
        const extraBottom = profile.hemDropPx;
        const targetH = bodyH * profile.scaleY + extraBottom;
        const shoulderShift = Math.max(-6, profile.shoulderDropPx * 0.5);
        const drawTopY = bodyTopY + shoulderShift;

        ctx.drawImage(
          img,
          0, bodyTopY, W, bodyH,
          offsetX, drawTopY, targetW, targetH,
        );

        // 4. Head band — re-drawn on top so face proportions stay correct.
        ctx.drawImage(
          img,
          0, 0, W, headH,
          0, 0, W, headH,
        );

        // 5. Optional tension / drape overlays.
        const cx = W / 2;
        const torsoTop = bodyTopY + bodyH * 0.05;
        const torsoH = bodyH * 0.55;
        if (profile.tensionOpacity > 0) {
          drawTensionLines(ctx, cx, torsoTop, targetW, torsoH, profile.tensionOpacity);
        }
        if (profile.drapeOpacity > 0) {
          drawDrapeLines(ctx, cx, torsoTop, targetW, bodyH * 0.70, profile.drapeOpacity);
        }

        if (!cancelled) {
          setReady(true);
          onLoaded?.();
        }
      } catch (e) {
        if (!cancelled) {
          setFailed(true);
          onError?.();
        }
      }
    })();

    return () => { cancelled = true; };
  }, [src, profile.scaleX, profile.scaleY, profile.shoulderDropPx, profile.hemDropPx, profile.tensionOpacity, profile.drapeOpacity, onLoaded, onError]);

  if (failed) {
    return (
      <img
        src={src}
        alt={alt}
        className={className}
        loading="eager"
        decoding="async"
      />
    );
  }

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={alt}
      className={className}
      style={ready ? undefined : { opacity: 0 }}
    />
  );
});

export default FitImageCanvas;

