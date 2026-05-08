// ─── FIT IMAGE CANVAS ───────────────────────────────────────────────────────
// Renders the AI-generated try-on image with a deterministic garment-zone
// correction. The body/camera remains fixed while the clothing band gets
// size-specific width, hem, tension, and drape cues so S ≠ XL even when the
// upstream image model normalizes the fit.
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import type { SizeWarpProfile } from "@/lib/fit/sizeWarpProfile";

interface Props {
  src: string;
  alt: string;
  profile: SizeWarpProfile;
  className?: string;
  onLoaded?: () => void;
  onError?: () => void;
}

const FitImageCanvas = forwardRef<HTMLCanvasElement, Props>(function FitImageCanvas(
  { src, alt, profile, className, onLoaded, onError },
  externalRef,
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useImperativeHandle(externalRef, () => canvasRef.current as HTMLCanvasElement, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (cancelled) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      const w = Math.max(320, Math.round(rect.width * dpr));
      const h = Math.max(520, Math.round(rect.height * dpr));
      canvas.width = w;
      canvas.height = h;
      ctx.clearRect(0, 0, w, h);

      const srcAspect = img.naturalWidth / img.naturalHeight;
      const dstAspect = w / h;
      let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;
      if (srcAspect > dstAspect) {
        sw = img.naturalHeight * dstAspect;
        sx = (img.naturalWidth - sw) / 2;
      } else {
        sh = img.naturalWidth / dstAspect;
        sy = 0;
      }
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);

      const bandTop = Math.round(h * 0.22);
      const bandBottom = Math.round(h * 0.76 + profile.hemDropPx * dpr);
      const bandH = Math.max(80, Math.min(h - bandTop, bandBottom - bandTop));
      const centerX = w / 2;
      const bandW = w * 0.70;
      const scaleX = profile.scaleX;
      if (Math.abs(scaleX - 1) > 0.01 || Math.abs(profile.scaleY - 1) > 0.01) {
        const temp = document.createElement("canvas");
        temp.width = w;
        temp.height = h;
        const tctx = temp.getContext("2d");
        if (tctx) {
          tctx.drawImage(canvas, 0, 0);
          ctx.save();
          ctx.beginPath();
          ctx.rect(centerX - bandW / 2, bandTop, bandW, bandH);
          ctx.clip();
          ctx.clearRect(centerX - bandW / 2 - 18 * dpr, bandTop, bandW + 36 * dpr, bandH);
          ctx.translate(centerX, bandTop + bandH / 2);
          ctx.scale(scaleX, profile.scaleY);
          ctx.drawImage(temp, centerX - bandW / 2, bandTop, bandW, bandH, -bandW / 2, -bandH / 2, bandW, bandH);
          ctx.restore();
        }
      }

      ctx.save();
      ctx.lineCap = "round";
      ctx.lineWidth = Math.max(1, 1.2 * dpr);
      if (Math.abs(profile.scaleX - 1) > 0.04) {
        const left = centerX - (bandW * profile.scaleX) / 2;
        const right = centerX + (bandW * profile.scaleX) / 2;
        const alpha = Math.min(0.18, Math.abs(profile.scaleX - 1) * 0.32);
        const edgeGradient = ctx.createLinearGradient(left, 0, right, 0);
        edgeGradient.addColorStop(0, `rgba(0,0,0,${alpha})`);
        edgeGradient.addColorStop(0.18, "rgba(0,0,0,0)");
        edgeGradient.addColorStop(0.82, "rgba(0,0,0,0)");
        edgeGradient.addColorStop(1, `rgba(0,0,0,${alpha})`);
        ctx.fillStyle = edgeGradient;
        ctx.fillRect(left, bandTop, right - left, bandH);
      }
      if (profile.tensionOpacity > 0) {
        ctx.strokeStyle = `rgba(255,255,255,${profile.tensionOpacity})`;
        for (let i = 0; i < 9; i++) {
          const y = bandTop + bandH * (0.16 + i * 0.075);
          const half = bandW * (0.23 + i * 0.008) * Math.max(0.86, profile.scaleX);
          ctx.beginPath();
          ctx.moveTo(centerX - half, y);
          ctx.quadraticCurveTo(centerX, y - 4 * dpr, centerX + half, y);
          ctx.stroke();
        }
      }
      if (profile.drapeOpacity > 0) {
        ctx.strokeStyle = `rgba(20,20,20,${profile.drapeOpacity})`;
        for (let i = 0; i < 7; i++) {
          const x = centerX - bandW * 0.25 + i * bandW * 0.085;
          ctx.beginPath();
          ctx.moveTo(x, bandTop + bandH * 0.12 + profile.shoulderDropPx * dpr * 0.15);
          ctx.bezierCurveTo(x - 10 * dpr, bandTop + bandH * 0.34, x + 12 * dpr, bandTop + bandH * 0.58, x - 4 * dpr, bandTop + bandH * 0.9);
          ctx.stroke();
        }
      }
      ctx.restore();
      onLoaded?.();
    };
    img.onerror = () => !cancelled && onError?.();
    img.src = src;
    return () => { cancelled = true; };
  }, [src, profile.scaleX, profile.scaleY, profile.shoulderDropPx, profile.hemDropPx, profile.tensionOpacity, profile.drapeOpacity, onLoaded, onError]);

  return <canvas ref={canvasRef} role="img" aria-label={alt} className={className} />;
});

export default FitImageCanvas;
