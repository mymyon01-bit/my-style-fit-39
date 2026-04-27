import React from "react";
import { Img, staticFile } from "remotion";

// Browser chrome window — wraps a screenshot to feel like real desktop
export const BrowserFrame: React.FC<{
  src: string;
  width: number;
  height: number;
  url?: string;
  scrollY?: number;
  scale?: number;
  glow?: string;
  children?: React.ReactNode;
}> = ({ src, width, height, url = "mymyon.com", scrollY = 0, scale = 1, glow = "#FF2D87", children }) => {
  const chromeH = 44;
  return (
    <div
      style={{
        width,
        height: height + chromeH,
        borderRadius: 18,
        overflow: "hidden",
        background: "#1a1a22",
        boxShadow: `0 0 100px ${glow}33, 0 40px 100px rgba(0,0,0,0.7), inset 0 0 0 1px rgba(255,255,255,0.08)`,
        transform: `scale(${scale})`,
        transformOrigin: "center center",
        position: "relative",
      }}
    >
      {/* chrome */}
      <div
        style={{
          height: chromeH,
          background: "linear-gradient(180deg,#262630,#1a1a22)",
          display: "flex",
          alignItems: "center",
          paddingLeft: 18,
          gap: 8,
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div style={{ width: 12, height: 12, borderRadius: 6, background: "#FF5F57" }} />
        <div style={{ width: 12, height: 12, borderRadius: 6, background: "#FEBC2E" }} />
        <div style={{ width: 12, height: 12, borderRadius: 6, background: "#28C840" }} />
        <div
          style={{
            marginLeft: 28,
            background: "rgba(255,255,255,0.06)",
            color: "#9aa0aa",
            fontSize: 12,
            fontFamily: "'JetBrains Mono', monospace",
            padding: "5px 14px",
            borderRadius: 6,
            letterSpacing: 1,
          }}
        >
          🔒 {url}
        </div>
      </div>
      {/* content */}
      <div style={{ width, height, position: "relative", overflow: "hidden", background: "#fff" }}>
        <Img
          src={staticFile(src)}
          style={{
            width: "100%",
            height: "auto",
            transform: `translateY(${-scrollY}px)`,
            display: "block",
          }}
        />
        {children}
      </div>
    </div>
  );
};

// Phone — for mobile videos. Larger, more realistic than the small one.
export const Phone: React.FC<{
  src: string;
  width: number;
  scrollY?: number;
  scale?: number;
  glow?: string;
  children?: React.ReactNode;
}> = ({ src, width, scrollY = 0, scale = 1, glow = "#FF2D87", children }) => {
  const height = (width * 812) / 375;
  return (
    <div
      style={{
        width,
        height,
        borderRadius: 56,
        background: "#0a0a0f",
        padding: 12,
        boxShadow: `0 0 120px ${glow}55, 0 50px 120px rgba(0,0,0,0.7), inset 0 0 0 2px rgba(255,255,255,0.18)`,
        transform: `scale(${scale})`,
        transformOrigin: "center center",
        position: "relative",
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: 44,
          overflow: "hidden",
          background: "#fff",
          position: "relative",
        }}
      >
        <Img
          src={staticFile(src)}
          style={{
            width: "100%",
            height: "auto",
            display: "block",
            transform: `translateY(${-scrollY}px)`,
          }}
        />
        {children}
        {/* dynamic island */}
        <div
          style={{
            position: "absolute",
            top: 14,
            left: "50%",
            transform: "translateX(-50%)",
            width: 110,
            height: 30,
            background: "#000",
            borderRadius: 18,
            zIndex: 10,
          }}
        />
      </div>
    </div>
  );
};

// Zoom box — highlights a region of a screenshot with an animated rectangle + magnifier ring
export const ZoomHighlight: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  color?: string;
  opacity?: number;
}> = ({ x, y, w, h, color = "#FF2D87", opacity = 1 }) => {
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        height: h,
        borderRadius: 14,
        border: `3px solid ${color}`,
        boxShadow: `0 0 0 4000px rgba(0,0,0,0.5), 0 0 40px ${color}88`,
        opacity,
        pointerEvents: "none",
        zIndex: 50,
      }}
    >
      {/* corner brackets */}
      {[
        { top: -2, left: -2, borderTop: 4, borderLeft: 4 },
        { top: -2, right: -2, borderTop: 4, borderRight: 4 },
        { bottom: -2, left: -2, borderBottom: 4, borderLeft: 4 },
        { bottom: -2, right: -2, borderBottom: 4, borderRight: 4 },
      ].map((s, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            width: 22,
            height: 22,
            borderColor: color,
            borderStyle: "solid",
            borderWidth: 0,
            ...s,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
};
