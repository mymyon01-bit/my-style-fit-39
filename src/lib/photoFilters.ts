// Client-side photo filters for OOTD uploads.
// Each preset maps to a CSS `filter` string for live preview AND is baked
// into the final File via a canvas pass on confirm, so what users see is
// what actually gets uploaded.
//
// "auto" is a light AI-free retouch: histogram-based auto-tone (brightness
// stretch + gentle saturation lift + slight contrast).

export type PhotoFilterId =
  | "original"
  | "auto"
  | "bright"
  | "chic"
  | "mood"
  | "film"
  | "mono";

export const PHOTO_FILTERS: { id: PhotoFilterId; label: string; css: string }[] = [
  { id: "original", label: "Original", css: "none" },
  { id: "auto",     label: "Auto",     css: "brightness(1.06) contrast(1.08) saturate(1.15)" },
  { id: "bright",   label: "Bright",   css: "brightness(1.12) contrast(1.05) saturate(1.1)" },
  { id: "chic",     label: "Chic",     css: "contrast(1.12) saturate(0.9) brightness(1.02)" },
  { id: "mood",     label: "Mood",     css: "contrast(1.15) saturate(1.2) brightness(0.96) sepia(0.08)" },
  { id: "film",     label: "Film",     css: "contrast(0.95) saturate(1.05) sepia(0.15) brightness(1.03)" },
  { id: "mono",     label: "Mono",     css: "grayscale(1) contrast(1.1)" },
];

export const cssForFilter = (id: PhotoFilterId | string | null | undefined): string =>
  PHOTO_FILTERS.find((f) => f.id === id)?.css || "none";

/** Load a File into an HTMLImageElement. */
async function fileToImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  } finally {
    // Revoke on next tick — the image is decoded into a canvas below.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

/**
 * Bake the selected filter's CSS into a JPEG file. Uses the same `filter`
 * string as the live preview so results match.
 */
export async function applyFilterToFile(
  file: File,
  filterId: PhotoFilterId,
): Promise<File> {
  if (filterId === "original") return file;
  const img = await fileToImage(file);
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  const css = cssForFilter(filterId);
  // Chrome / Safari both support ctx.filter with the same syntax as CSS.
  (ctx as any).filter = css;
  ctx.drawImage(img, 0, 0);
  (ctx as any).filter = "none";
  const blob: Blob = await new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b as Blob), "image/jpeg", 0.92),
  );
  const name = file.name.replace(/\.(png|webp|heic|heif|jpe?g)$/i, "") + `-${filterId}.jpg`;
  return new File([blob], name, { type: "image/jpeg" });
}
