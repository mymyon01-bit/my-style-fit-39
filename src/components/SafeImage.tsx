import { useState, useCallback, ImgHTMLAttributes } from "react";
import { ImageOff } from "lucide-react";

interface SafeImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  fallbackClassName?: string;
  fallbackSrcs?: string[];
}

/** Validates a URL is a proper https image link */
function isValidImageUrl(url: unknown): url is string {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  if (!trimmed || trimmed === "null" || trimmed === "undefined") return false;
  try {
    const u = new URL(trimmed);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

/** Resolves the best available image from multiple possible fields */
export function resolveImageUrl(
  ...candidates: (string | string[] | null | undefined)[]
): string | null {
  for (const c of candidates) {
    if (Array.isArray(c)) {
      for (const item of c) {
        if (isValidImageUrl(item)) return item.trim();
      }
    } else if (isValidImageUrl(c)) {
      return (c as string).trim();
    }
  }
  return null;
}

const SafeImage = ({ src, alt, className, fallbackClassName, fallbackSrcs, ...props }: SafeImageProps) => {
  const allSrcs = [src, ...(fallbackSrcs || [])].filter(isValidImageUrl);
  const [srcIndex, setSrcIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  const currentSrc = allSrcs[srcIndex];

  const handleError = useCallback(() => {
    if (srcIndex < allSrcs.length - 1) {
      setSrcIndex(prev => prev + 1);
      setLoaded(false);
    } else {
      setFailed(true);
      console.warn(`[SafeImage] All sources failed for "${alt}"`, allSrcs);
    }
  }, [srcIndex, allSrcs.length, alt]);

  if (!currentSrc || failed) {
    return (
      <div className={`flex items-center justify-center bg-foreground/[0.04] ${fallbackClassName || className || ""}`}>
        <ImageOff className="h-5 w-5 text-foreground/70" />
      </div>
    );
  }

  return (
    <>
      {!loaded && (
        <div className={`animate-pulse bg-foreground/[0.04] ${className || ""}`} />
      )}
      <img
        src={currentSrc}
        alt={alt || ""}
        className={`${className || ""} ${loaded ? "" : "hidden"}`}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        onError={handleError}
        {...props}
      />
    </>
  );
};

export default SafeImage;
