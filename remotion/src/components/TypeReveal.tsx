import React from "react";
import { useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";

interface Props {
  text: string;
  delay?: number;
  size?: number;
  weight?: number;
  color?: string;
  letterSpacing?: number;
  font?: string;
  italic?: boolean;
}

export const TypeReveal: React.FC<Props> = ({
  text,
  delay = 0,
  size = 96,
  weight = 700,
  color = "#F5F5F7",
  letterSpacing = -2,
  font = "'Space Grotesk', sans-serif",
  italic = false,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = text.split(" ");
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: size * 0.25,
        fontFamily: font,
        fontSize: size,
        fontWeight: weight,
        fontStyle: italic ? "italic" : "normal",
        letterSpacing,
        color,
        lineHeight: 1.02,
      }}
    >
      {words.map((w, i) => {
        const f = frame - delay - i * 4;
        const y = interpolate(
          spring({ frame: f, fps, config: { damping: 18, stiffness: 110 } }),
          [0, 1],
          [60, 0],
        );
        const o = interpolate(f, [0, 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        const blur = interpolate(f, [0, 14], [12, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              transform: `translateY(${y}px)`,
              opacity: o,
              filter: `blur(${blur}px)`,
            }}
          >
            {w}
          </span>
        );
      })}
    </div>
  );
};

export const MonoLabel: React.FC<{ text: string; delay?: number; color?: string }> = ({
  text,
  delay = 0,
  color = "#3DD8E8",
}) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame - delay, [0, 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const w = interpolate(frame - delay, [0, 22], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 14, opacity: o }}>
      <div style={{ width: w, height: 1, background: color }} />
      <span
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 14,
          letterSpacing: 5,
          color,
          textTransform: "uppercase",
        }}
      >
        {text}
      </span>
    </div>
  );
};
