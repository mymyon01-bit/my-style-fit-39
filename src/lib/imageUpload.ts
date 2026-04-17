// Robust media preparation for OOTD + Stories uploads.
// - Tolerates HEIC/HEIF (re-encodes via canvas when possible)
// - Compresses large images client-side
// - Returns a File ready for Supabase storage upload

const MAX_DIMENSION = 1920;
const TARGET_QUALITY = 0.85;
const MAX_BYTES = 8 * 1024 * 1024; // 8MB cap after compression

export async function prepareImage(file: File): Promise<File> {
  // Videos pass through untouched
  if (file.type.startsWith("video/")) return file;

  const isHeic = /heic|heif/i.test(file.type) || /\.(heic|heif)$/i.test(file.name);

  // Try to load via createImageBitmap (handles most formats incl. modern HEIC on supported browsers)
  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    bitmap = null;
  }

  // Fallback: HTMLImageElement via object URL
  if (!bitmap) {
    try {
      const url = URL.createObjectURL(file);
      const img = await loadImage(url);
      URL.revokeObjectURL(url);
      bitmap = await createImageBitmap(img);
    } catch {
      if (isHeic) {
        throw new Error(
          "HEIC photos from iPhone aren't supported by your browser. Please convert to JPG in your photo settings (Settings → Camera → Formats → Most Compatible) and try again."
        );
      }
      // Couldn't decode — but still let it through if size is OK
      if (file.size <= MAX_BYTES) return file;
      throw new Error("This image format isn't supported. Try a JPG or PNG.");
    }
  }

  const { width, height } = scale(bitmap.width, bitmap.height, MAX_DIMENSION);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", TARGET_QUALITY)
  );
  if (!blob) return file;

  const newName = file.name.replace(/\.(heic|heif|png|webp|jpe?g)$/i, "") + ".jpg";
  return new File([blob], newName || `photo-${Date.now()}.jpg`, {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}

function scale(w: number, h: number, max: number) {
  if (w <= max && h <= max) return { width: w, height: h };
  const ratio = w > h ? max / w : max / h;
  return { width: Math.round(w * ratio), height: Math.round(h * ratio) };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// Quick file-type guard with friendly errors
export function validateMedia(file: File, opts: { allowVideo?: boolean; maxBytes?: number } = {}) {
  const { allowVideo = false, maxBytes = 50 * 1024 * 1024 } = opts;
  const isImage = file.type.startsWith("image/") || /\.(jpe?g|png|webp|heic|heif|gif)$/i.test(file.name);
  const isVideo = file.type.startsWith("video/") || /\.(mp4|mov|webm|m4v)$/i.test(file.name);
  if (!isImage && !isVideo) throw new Error("Please choose a photo or video.");
  if (isVideo && !allowVideo) throw new Error("Videos aren't allowed here. Pick a photo.");
  if (file.size > maxBytes) {
    throw new Error(`File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max ${(maxBytes / 1024 / 1024).toFixed(0)}MB.`);
  }
  return { isImage, isVideo };
}
