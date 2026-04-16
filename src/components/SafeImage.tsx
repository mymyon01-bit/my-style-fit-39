import { useState, ImgHTMLAttributes } from "react";
import { ImageOff } from "lucide-react";

interface SafeImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  fallbackClassName?: string;
}

const SafeImage = ({ src, alt, className, fallbackClassName, ...props }: SafeImageProps) => {
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);

  if (!src || error) {
    return (
      <div className={`flex items-center justify-center bg-foreground/[0.04] ${fallbackClassName || className || ""}`}>
        <ImageOff className="h-5 w-5 text-foreground/20" />
      </div>
    );
  }

  return (
    <>
      {!loaded && (
        <div className={`animate-pulse bg-foreground/[0.04] ${className || ""}`} />
      )}
      <img
        src={src}
        alt={alt || ""}
        className={`${className || ""} ${loaded ? "" : "hidden"}`}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
        {...props}
      />
    </>
  );
};

export default SafeImage;
