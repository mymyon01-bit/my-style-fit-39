import { forwardRef, useState, useCallback, ImgHTMLAttributes } from "react";
import { ImageOff } from "lucide-react";

interface SafeImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  fallbackClassName?: string;
  fallbackSrcs?: string[];
  eager?: boolean;
}

function isValidImageUrl(url: unknown): url is string {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  if (!trimmed || trimmed === "null" || trimmed === "undefined") return false;
  if (trimmed.startsWith("data:image/")) return true;
  if (trimmed.startsWith("blob:")) return true;
  if (/^(\/|\.\.?\/)/.test(trimmed)) return true;
  try {
    const u = new URL(trimmed);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

export function resolveImageUrl(
  ...candidates: (string | string[] | null | undefined)[]
): string | null {
  for (const c of candidates) {
    if (Array.isArray(c)) {
      for (const item of c) {
        if (isValidImageUrl(item)) return item.trim();
      }
    } else if (isValidImageUrl(c)) {
      return c.trim();
    }
  }
  return null;
}

const SafeImage = forwardRef<HTMLImageElement, SafeImageProps>(function SafeImage(
  { src, alt, className, fallbackClassName, fallbackSrcs, eager, onLoad, onError, ...props },
  ref,
) {
  const allSrcs = [src, ...(fallbackSrcs || [])].filter(isValidImageUrl);
  const [srcIndex, setSrcIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  const currentSrc = allSrcs[srcIndex];

  const handleLoad = useCallback(
    (event: React.SyntheticEvent<HTMLImageElement>) => {
      setLoaded(true);
      onLoad?.(event);
    },
    [onLoad],
  );

  const handleError = useCallback(
    (event: React.SyntheticEvent<HTMLImageElement>) => {
      if (srcIndex < allSrcs.length - 1) {
        setSrcIndex((prev) => prev + 1);
        setLoaded(false);
        return;
      }
      setFailed(true);
      console.warn(`[SafeImage] All sources failed for "${alt}"`, allSrcs);
      onError?.(event);
    },
    [srcIndex, allSrcs, alt, onError],
  );

  if (!currentSrc || failed) {
    return (
      <div className={`flex items-center justify-center bg-foreground/[0.04] ${fallbackClassName || className || ""}`}>
        <ImageOff className="h-5 w-5 text-foreground/70" />
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      {!loaded && (
        <div
          className={`absolute inset-0 animate-pulse bg-foreground/[0.04] ${className || ""}`}
          aria-hidden
        />
      )}
      <img
        ref={ref}
        src={currentSrc}
        alt={alt || ""}
        className={`${className || ""} ${loaded ? "animate-blur-up" : "opacity-0"}`}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        // @ts-expect-error fetchpriority is a valid HTML attr but not yet typed
        fetchpriority={eager ? "high" : "low"}
        onLoad={handleLoad}
        onError={handleError}
        {...props}
      />
    </div>
  );
});

export default SafeImage;
