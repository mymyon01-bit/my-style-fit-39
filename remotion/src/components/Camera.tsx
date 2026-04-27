import React from "react";

// Camera — applies a zoom + pan transform across all children, with smooth interpolation between keyframes
import { useCurrentFrame, interpolate } from "remotion";

export interface CamKey {
  at: number; // frame
  scale: number;
  x: number; // translate in px (post-scale)
  y: number;
}

export const Camera: React.FC<{ keys: CamKey[]; children: React.ReactNode }> = ({ keys, children }) => {
  const frame = useCurrentFrame();
  // find segment
  let a = keys[0];
  let b = keys[keys.length - 1];
  for (let i = 0; i < keys.length - 1; i++) {
    if (frame >= keys[i].at && frame <= keys[i + 1].at) {
      a = keys[i];
      b = keys[i + 1];
      break;
    }
  }
  if (frame >= keys[keys.length - 1].at) {
    a = keys[keys.length - 1];
    b = keys[keys.length - 1];
  }
  const t = a.at === b.at ? 1 : interpolate(frame, [a.at, b.at], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // ease in-out cubic
  const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const scale = a.scale + (b.scale - a.scale) * eased;
  const x = a.x + (b.x - a.x) * eased;
  const y = a.y + (b.y - a.y) * eased;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        transform: `scale(${scale}) translate(${x}px, ${y}px)`,
        transformOrigin: "center center",
      }}
    >
      {children}
    </div>
  );
};
