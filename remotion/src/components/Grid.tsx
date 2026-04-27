import React from "react";
import { useCurrentFrame, interpolate } from "remotion";
import { theme } from "../theme";

export const Grid: React.FC<{ opacity?: number }> = ({ opacity = 1 }) => {
  const frame = useCurrentFrame();
  const drift = interpolate(frame, [0, 900], [0, 60]);
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        backgroundImage: `linear-gradient(${theme.grid} 1px, transparent 1px), linear-gradient(90deg, ${theme.grid} 1px, transparent 1px)`,
        backgroundSize: "80px 80px",
        backgroundPosition: `${drift}px ${drift}px`,
        opacity,
        pointerEvents: "none",
      }}
    />
  );
};

export const Scanline: React.FC = () => {
  const frame = useCurrentFrame();
  const y = interpolate(frame % 90, [0, 90], [0, 100]);
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: `linear-gradient(180deg, transparent ${y - 4}%, rgba(61,216,232,0.12) ${y}%, transparent ${y + 4}%)`,
        pointerEvents: "none",
        mixBlendMode: "screen",
      }}
    />
  );
};

export const Vignette: React.FC = () => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      background:
        "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.55) 100%)",
      pointerEvents: "none",
    }}
  />
);

export const CornerHUD: React.FC<{ label: string }> = ({ label }) => {
  const c = "rgba(245,245,247,0.45)";
  const sz = 22;
  const sw = 2;
  return (
    <>
      {[
        { top: 40, left: 40, b: `${sw}px solid ${c}`, l: `${sw}px solid ${c}` },
        { top: 40, right: 40, b: `${sw}px solid ${c}`, r: `${sw}px solid ${c}` },
        { bottom: 40, left: 40, t: `${sw}px solid ${c}`, l: `${sw}px solid ${c}` },
        { bottom: 40, right: 40, t: `${sw}px solid ${c}`, r: `${sw}px solid ${c}` },
      ].map((s, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            width: sz,
            height: sz,
            top: s.top,
            left: s.left,
            right: s.right,
            bottom: s.bottom,
            borderTop: s.t,
            borderBottom: s.b,
            borderLeft: s.l,
            borderRight: s.r,
          }}
        />
      ))}
      <div
        style={{
          position: "absolute",
          top: 48,
          left: 80,
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 12,
          letterSpacing: 4,
          color: c,
        }}
      >
        {label}
      </div>
    </>
  );
};
