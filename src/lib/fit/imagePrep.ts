// ─── imagePrep — V4.0 image standardization ──────────────────────────────
// Normalize garment + body images to ≤1024×1024 WebP/JPEG and return a
// stable content hash for cache reuse.
//
// Used by the prewarm orchestrator and by future garment-cutout caching
// (so identical garments across products share a single cache slot).
// Pure client-side. Falls back gracefully when canvas/createImageBitmap
// or crypto.subtle are unavailable.

const MAX_DIM = 1024;

export interface PreparedImage {
  /** Stable content hash (sha-256 hex of the encoded blob, or url fallback). */
  hash: string;
  /** Object URL of the normalized blob (caller may revoke when done). */
  objectUrl: string;
  /** Final dimensions after resize. */
  width: number;
  height: number;
  /** Encoded mime type. */
  mime: "image/webp" | "image/jpeg";
  /** Encoded byte size. */
  bytes: number;
}

const cache = new Map<string, Promise<PreparedImage>>();

async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  if (!crypto?.subtle) {
    // Cheap fallback: not cryptographic, but stable per byte stream length.
    return `len_${buf.byteLength}_${Date.now().toString(36)}`;
  }
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function fetchAsBlob(url: string): Promise<Blob> {
  const res = await fetch(url, { mode: "cors", credentials: "omit" });
  if (!res.ok) throw new Error(`fetch ${res.status}`);
  return await res.blob();
}

function fitDim(w: number, h: number): { w: number; h: number } {
  if (w <= MAX_DIM && h <= MAX_DIM) return { w, h };
  const r = w > h ? MAX_DIM / w : MAX_DIM / h;
  return { w: Math.round(w * r), h: Math.round(h * r) };
}

async function encode(canvas: HTMLCanvasElement | OffscreenCanvas): Promise<{ blob: Blob; mime: PreparedImage["mime"] }> {
  // Prefer webp; fall back to jpeg if encoder rejects.
  const tryEncode = async (mime: "image/webp" | "image/jpeg") => {
    if ("convertToBlob" in canvas) {
      try { return await (canvas as OffscreenCanvas).convertToBlob({ type: mime, quality: 0.86 }); }
      catch { return null; }
    }
    return await new Promise<Blob | null>((resolve) =>
      (canvas as HTMLCanvasElement).toBlob((b) => resolve(b), mime, 0.86),
    );
  };
  const webp = await tryEncode("image/webp");
  if (webp && webp.size > 0) return { blob: webp, mime: "image/webp" };
  const jpeg = await tryEncode("image/jpeg");
  if (jpeg && jpeg.size > 0) return { blob: jpeg, mime: "image/jpeg" };
  throw new Error("encode_failed");
}

export async function prepareImage(url: string): Promise<PreparedImage> {
  if (!url) throw new Error("empty_url");
  const cached = cache.get(url);
  if (cached) return cached;

  const p = (async () => {
    const srcBlob = await fetchAsBlob(url);
    let bitmap: ImageBitmap | null = null;
    try {
      bitmap = await createImageBitmap(srcBlob);
    } catch {
      // Some browsers refuse cross-origin bitmaps; fall back to <img>.
      bitmap = null;
    }

    let width = 0, height = 0;
    let canvas: HTMLCanvasElement | OffscreenCanvas;
    if (bitmap) {
      const { w, h } = fitDim(bitmap.width, bitmap.height);
      width = w; height = h;
      canvas = typeof OffscreenCanvas !== "undefined"
        ? new OffscreenCanvas(w, h)
        : Object.assign(document.createElement("canvas"), { width: w, height: h });
      const ctx = (canvas as any).getContext("2d");
      ctx.drawImage(bitmap, 0, 0, w, h);
      bitmap.close?.();
    } else {
      const img = new Image();
      img.crossOrigin = "anonymous";
      const blobUrl = URL.createObjectURL(srcBlob);
      try {
        await new Promise<void>((res, rej) => {
          img.onload = () => res();
          img.onerror = () => rej(new Error("img_load_failed"));
          img.src = blobUrl;
        });
        const { w, h } = fitDim(img.naturalWidth, img.naturalHeight);
        width = w; height = h;
        canvas = Object.assign(document.createElement("canvas"), { width: w, height: h });
        canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      } finally {
        URL.revokeObjectURL(blobUrl);
      }
    }

    const { blob, mime } = await encode(canvas);
    const buf = await blob.arrayBuffer();
    const hash = await sha256Hex(buf);
    return {
      hash,
      objectUrl: URL.createObjectURL(blob),
      width,
      height,
      mime,
      bytes: blob.size,
    } satisfies PreparedImage;
  })();

  cache.set(url, p);
  p.catch(() => cache.delete(url));
  return p;
}

/** Hash-only (no resize/encode) — useful when you just need a cache key. */
export async function hashImageUrl(url: string): Promise<string> {
  try {
    const blob = await fetchAsBlob(url);
    return await sha256Hex(await blob.arrayBuffer());
  } catch {
    // Stable fallback: hash the URL string itself.
    const enc = new TextEncoder().encode(url);
    return await sha256Hex(enc.buffer);
  }
}
