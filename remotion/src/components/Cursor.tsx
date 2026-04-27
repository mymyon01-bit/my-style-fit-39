import React from "react";
import { useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";

interface Point {
  x: number;
  y: number;
  at: number; // frame at which cursor arrives
  click?: boolean;
}

interface Props {
  path: Point[];
  color?: string;
}

// Animated virtual cursor that moves between points and clicks
export const Cursor: React.FC<Props> = ({ path, color = "#FF2D87" }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // find current segment
  let segIdx = 0;
  for (let i = 0; i < path.length - 1; i++) {
    if (frame >= path[i].at && frame < path[i + 1].at) {
      segIdx = i;
      break;
    }
    if (frame >= path[path.length - 1].at) segIdx = path.length - 1;
  }

  const a = path[segIdx];
  const b = path[Math.min(segIdx + 1, path.length - 1)];
  const segDur = Math.max(1, b.at - a.at);
  const t = interpolate(frame, [a.at, b.at], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // ease-in-out
  const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

  const x = a.x + (b.x - a.x) * eased;
  const y = a.y + (b.y - a.y) * eased;

  // appearance
  const enter = spring({ frame: frame - path[0].at + 4, fps, config: { damping: 14 } });

  // click pulse — when current point is a click, pulse around its frame
  const clickPoint = path.find((p) => p.click && Math.abs(frame - p.at) < 25);
  let pulseScale = 0;
  let pulseOpacity = 0;
  if (clickPoint) {
    const cf = frame - clickPoint.at;
    if (cf >= 0 && cf < 25) {
      pulseScale = interpolate(cf, [0, 25], [0.4, 2.4]);
      pulseOpacity = interpolate(cf, [0, 25], [0.7, 0]);
    }
  }

  const pressScale = clickPoint && Math.abs(frame - clickPoint.at) < 6 ? 0.85 : 1;

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: 0,
        height: 0,
        pointerEvents: "none",
        zIndex: 999,
        opacity: enter,
      }}
    >
      {/* click ripple */}
      {clickPoint && (
        <>
          <div
            style={{
              position: "absolute",
              left: -40,
              top: -40,
              width: 80,
              height: 80,
              borderRadius: "50%",
              border: `3px solid ${color}`,
              transform: `scale(${pulseScale})`,
              opacity: pulseOpacity,
            }}
          />
          <div
            style={{
              position: "absolute",
              left: -28,
              top: -28,
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: `${color}33`,
              transform: `scale(${pulseScale * 0.6})`,
              opacity: pulseOpacity * 0.8,
            }}
          />
        </>
      )}
      {/* cursor pointer (arrow style) */}
      <svg
        width="38"
        height="44"
        viewBox="0 0 38 44"
        style={{
          transform: `scale(${pressScale})`,
          transformOrigin: "0 0",
          filter: `drop-shadow(0 6px 18px ${color}88) drop-shadow(0 2px 4px rgba(0,0,0,0.6))`,
        }}
      >
        <path
          d="M2 2 L2 32 L11 24 L16 38 L22 36 L17 22 L30 22 Z"
          fill="#fff"
          stroke={color}
          strokeWidth="2.4"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
};
