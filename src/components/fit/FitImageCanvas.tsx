// ─── FIT IMAGE CANVAS ───────────────────────────────────────────────────────
// Renders the AI-generated try-on image as-is — NO warping, NO overlays.
// The previous canvas warp pipeline created visible distortions (squashed
// shoulders, stretched torsos, misaligned heads) which broke the clean
// mannequin look. We now trust the AI render and let per-size differentiation
// come from the prompt itself.
//
// The `profile` prop is kept for API compatibility but intentionally unused.
import { forwardRef } from "react";
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
  { src, alt, className, onLoaded, onError },
  _externalRef,
) {
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading="eager"
      decoding="async"
      onLoad={() => onLoaded?.()}
      onError={() => onError?.()}
    />
  );
});

export default FitImageCanvas;
