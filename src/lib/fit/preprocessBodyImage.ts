// ─── BODY IMAGE QUALITY GATE ───────────────────────────────────────────────
// Multi-stage:
//   1. Local heuristic (size, aspect, canvas reachability)
//   2. AI person detection via fit-vision-analyze (bbox + pose)
//   3. Smart crop using bbox + 20% padding into a 768x1024 portrait
// The AI step is best-effort — if it fails or times out, we fall back to a
// centered crop so we never block a try-on on a transient model error.

import { supabase } from "@/integrations/supabase/client";

export interface PreprocessResult {
  valid: boolean;
  reason?:
    | "load_failed"
    | "too_small"
    | "extreme_aspect"
    | "missing_url"
    | "no_person"
    | "low_confidence"
    | "bad_pose"
    | "bbox_too_small";
  croppedImageUrl: string;
  width?: number;
  height?: number;
  zoomRatio?: number;
  cropApplied?: boolean;
  bbox?: { x: number; y: number; w: number; h: number };
  pose?: string;
  framing?: string;
  tiltDegrees?: number;
  confidence?: number;
}

const TARGET_W = 768;
const TARGET_H = 1024; // 3:4 portrait
const MIN_LONG_EDGE = 512;
const MIN_BBOX_AREA = 0.15; // person must take ≥15% of frame area
const MIN_BBOX_HEIGHT = 0.3; // person must be ≥30% of frame height
const MIN_DETECTION_CONFIDENCE = 0.55;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image load failed"));
    img.src = url;
  });
}

interface BodyDetection {
  person_present: boolean;
  confidence: number;
  bbox: { x: number; y: number; w: number; h: number };
  pose: "front" | "three_quarter" | "side" | "back" | "unclear";
  framing: "full_body" | "upper_body" | "head_only" | "torso_crop";
  tilt_degrees: number;
  issues: string[];
}

async function detectPersonBoundingBox(imageUrl: string): Promise<BodyDetection | null> {
  try {
    const { data, error } = await supabase.functions.invoke("fit-vision-analyze", {
      body: { mode: "body", imageUrl },
    });
    if (error) {
      console.warn("[preprocessBodyImage] vision invoke error", error.message);
      return null;
    }
    if (!data?.result) return null;
    return data.result as BodyDetection;
  } catch (e) {
    console.warn("[preprocessBodyImage] vision threw", e);
    return null;
  }
}

/**
 * Crop using a normalized bbox with 20% padding, then place inside the 3:4
 * portrait canvas. Falls back to centered fit if no bbox is provided.
 */
function recropWithBBox(
  img: HTMLImageElement,
  bbox: { x: number; y: number; w: number; h: number } | null
): { dataUrl: string; zoomRatio: number } {
  const canvas = document.createElement("canvas");
  canvas.width = TARGET_W;
  canvas.height = TARGET_H;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#ECECEC";
  ctx.fillRect(0, 0, TARGET_W, TARGET_H);

  let sx: number, sy: number, sw: number, sh: number;

  if (bbox && bbox.w > 0 && bbox.h > 0) {
    // Convert normalized → pixel, then expand by 20% on every side.
    const px = bbox.x * img.width;
    const py = bbox.y * img.height;
    const pw = bbox.w * img.width;
    const ph = bbox.h * img.height;
    const padX = pw * 0.2;
    const padY = ph * 0.2;
    sx = Math.max(0, px - padX);
    sy = Math.max(0, py - padY);
    sw = Math.min(img.width - sx, pw + padX * 2);
    sh = Math.min(img.height - sy, ph + padY * 2);

    // Force 3:4 aspect on the source crop so we don't distort.
    const srcAspect = sw / sh;
    const targetAspect = TARGET_W / TARGET_H;
    if (srcAspect > targetAspect) {
      // too wide → trim sides
      const newW = sh * targetAspect;
      sx = sx + (sw - newW) / 2;
      sw = newW;
    } else {
      // too tall → extend width if possible, else trim top/bottom
      const newH = sw / targetAspect;
      if (newH > sh) {
        const desiredW = sh * targetAspect;
        const widen = (desiredW - sw) / 2;
        sx = Math.max(0, sx - widen);
        sw = Math.min(img.width - sx, sw + widen * 2);
        // recompute height to honour aspect
        sh = sw / targetAspect;
      } else {
        sy = sy + (sh - newH) / 2;
        sh = newH;
      }
    }
  } else {
    // No bbox — center fit (legacy path).
    const srcAspect = img.width / img.height;
    const targetAspect = TARGET_W / TARGET_H;
    if (srcAspect > targetAspect) {
      sh = img.height;
      sw = sh * targetAspect;
      sx = (img.width - sw) / 2;
      sy = 0;
    } else {
      sw = img.width;
      sh = sw / targetAspect;
      sx = 0;
      sy = Math.max(0, (img.height - sh) * 0.15); // bias toward top
    }
  }

  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, TARGET_W, TARGET_H);
  const zoomRatio = TARGET_W / sw;
  return { dataUrl: canvas.toDataURL("image/jpeg", 0.92), zoomRatio };
}

export async function preprocessBodyImage(imageUrl: string | null): Promise<PreprocessResult> {
  if (!imageUrl) return { valid: false, reason: "missing_url", croppedImageUrl: "" };

  let img: HTMLImageElement;
  try {
    img = await loadImage(imageUrl);
  } catch {
    return { valid: false, reason: "load_failed", croppedImageUrl: imageUrl };
  }

  const longEdge = Math.max(img.width, img.height);
  if (longEdge < MIN_LONG_EDGE) {
    return { valid: false, reason: "too_small", croppedImageUrl: imageUrl, width: img.width, height: img.height };
  }
  const aspect = img.width / img.height;
  if (aspect > 2.2 || aspect < 0.35) {
    return { valid: false, reason: "extreme_aspect", croppedImageUrl: imageUrl, width: img.width, height: img.height };
  }

  // ── AI detection (best-effort) ──────────────────────────────────────────
  const detection = await detectPersonBoundingBox(imageUrl);
  let bbox: BodyDetection["bbox"] | null = null;
  let pose: BodyDetection["pose"] | undefined;
  let framing: BodyDetection["framing"] | undefined;
  let tilt: number | undefined;
  let confidence: number | undefined;

  if (detection) {
    confidence = detection.confidence;
    pose = detection.pose;
    framing = detection.framing;
    tilt = detection.tilt_degrees;

    if (!detection.person_present) {
      return { valid: false, reason: "no_person", croppedImageUrl: imageUrl, confidence };
    }
    if (detection.confidence < MIN_DETECTION_CONFIDENCE) {
      return { valid: false, reason: "low_confidence", croppedImageUrl: imageUrl, confidence };
    }
    if (detection.pose === "side" || detection.pose === "back") {
      return { valid: false, reason: "bad_pose", croppedImageUrl: imageUrl, confidence, pose: detection.pose };
    }
    const area = detection.bbox.w * detection.bbox.h;
    if (area < MIN_BBOX_AREA || detection.bbox.h < MIN_BBOX_HEIGHT) {
      return { valid: false, reason: "bbox_too_small", croppedImageUrl: imageUrl, confidence, bbox: detection.bbox };
    }
    bbox = detection.bbox;
  }

  try {
    const { dataUrl, zoomRatio } = recropWithBBox(img, bbox);
    return {
      valid: true,
      croppedImageUrl: dataUrl,
      width: TARGET_W,
      height: TARGET_H,
      zoomRatio,
      cropApplied: true,
      bbox: bbox || undefined,
      pose,
      framing,
      tiltDegrees: tilt,
      confidence,
    };
  } catch (e) {
    console.warn("[preprocessBodyImage] canvas tainted, using original", e);
    return {
      valid: true,
      croppedImageUrl: imageUrl,
      width: img.width,
      height: img.height,
      zoomRatio: 1,
      cropApplied: false,
      bbox: bbox || undefined,
      pose,
      framing,
      tiltDegrees: tilt,
      confidence,
    };
  }
}
