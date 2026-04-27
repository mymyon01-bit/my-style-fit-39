import React from "react";
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import { theme } from "../theme";
import { Grid, Vignette, CornerHUD, Scanline } from "../components/Grid";
import { PhoneFrame } from "../components/PhoneFrame";
import { TypeReveal, MonoLabel } from "../components/TypeReveal";

// Discover — AI mood + style → curated products. 30s
export const DiscoverVideo: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: theme.bg, color: theme.ink, fontFamily: "'Inter', sans-serif" }}>
      <Grid />
      <Vignette />
      <CornerHUD label="MYMYON · DISCOVER · AI" />

      <Sequence from={0} durationInFrames={130}>
        <SceneOpen />
      </Sequence>
      <Sequence from={120} durationInFrames={180}>
        <SceneMood />
      </Sequence>
      <Sequence from={290} durationInFrames={170}>
        <SceneCombine />
      </Sequence>
      <Sequence from={450} durationInFrames={200}>
        <SceneCurated />
      </Sequence>
      <Sequence from={640} durationInFrames={260}>
        <SceneFinale />
      </Sequence>
    </AbsoluteFill>
  );
};

const SceneOpen: React.FC = () => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [100, 130], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ padding: 120, justifyContent: "center", opacity: o }}>
      <MonoLabel text="03 · DISCOVER" color={theme.accent2} />
      <div style={{ marginTop: 32 }}>
        <TypeReveal text="Skip the scroll." size={140} weight={700} />
      </div>
      <div style={{ marginTop: 16 }}>
        <TypeReveal text="See yourself." size={140} italic color={theme.accent} delay={12} />
      </div>
    </AbsoluteFill>
  );
};

// Mood inputs — chips floating in
const SceneMood: React.FC = () => {
  const frame = useCurrentFrame();
  const inputs = [
    { txt: "soft autumn", x: 0.2, y: 0.3, c: theme.accent, at: 0 },
    { txt: "dinner with him", x: 0.65, y: 0.25, c: theme.accent2, at: 12 },
    { txt: "feeling editorial", x: 0.15, y: 0.55, c: theme.gold, at: 22 },
    { txt: "no heels", x: 0.7, y: 0.6, c: "#A78BFA", at: 34 },
    { txt: "Seoul · 14°C", x: 0.4, y: 0.78, c: theme.inkDim, at: 46 },
  ];
  return (
    <AbsoluteFill style={{ padding: 100 }}>
      <div style={{ position: "absolute", top: 80, left: 120 }}>
        <MonoLabel text="01 · YOUR INPUTS" />
        <div style={{ marginTop: 20 }}>
          <TypeReveal text="Mood. Plan. Weather." size={64} delay={6} />
        </div>
      </div>

      {inputs.map((inp, i) => {
        const f = frame - 50 - inp.at;
        const o = interpolate(f, [0, 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        const s = spring({ frame: f, fps: 30, config: { damping: 14 } });
        const float = Math.sin((frame + i * 30) * 0.04) * 6;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${inp.x * 100}%`,
              top: `${inp.y * 100}%`,
              opacity: o,
              transform: `scale(${s}) translateY(${float}px)`,
              padding: "18px 30px",
              borderRadius: 999,
              background: "rgba(255,255,255,0.06)",
              border: `1.5px solid ${inp.c}`,
              color: inp.c,
              fontSize: 28,
              fontWeight: 500,
              fontFamily: "'Space Grotesk', sans-serif",
              boxShadow: `0 0 40px ${inp.c}44`,
              backdropFilter: "blur(0px)",
            }}
          >
            {inp.txt}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// Combine: streams converging into a single LLM core
const SceneCombine: React.FC = () => {
  const frame = useCurrentFrame();
  const pulse = 1 + Math.sin(frame * 0.18) * 0.08;
  const cx = 960;
  const cy = 540;
  const streams = 8;
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", top: 80, left: 120 }}>
        <MonoLabel text="02 · SYNTHESIS" color={theme.accent} />
        <div style={{ marginTop: 20 }}>
          <TypeReveal text="AI fuses every signal." size={64} delay={6} />
        </div>
      </div>

      <svg width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
        {Array.from({ length: streams }).map((_, i) => {
          const angle = (i / streams) * Math.PI * 2;
          const r = 480;
          const sx = cx + Math.cos(angle) * r;
          const sy = cy + Math.sin(angle) * r;
          const f = frame - 30 - i * 4;
          const t = interpolate(f, [0, 60], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const ex = sx + (cx - sx) * t;
          const ey = sy + (cy - sy) * t;
          return (
            <line
              key={i}
              x1={sx}
              y1={sy}
              x2={ex}
              y2={ey}
              stroke={i % 2 === 0 ? theme.accent : theme.accent2}
              strokeWidth={2}
              opacity={0.7}
              strokeDasharray="4 6"
            />
          );
        })}
      </svg>

      {/* Core */}
      <div
        style={{
          position: "absolute",
          left: cx - 100,
          top: cy - 100,
          width: 200,
          height: 200,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${theme.accent} 0%, ${theme.accent2} 70%, transparent 100%)`,
          transform: `scale(${pulse})`,
          opacity: interpolate(frame, [20, 80], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          boxShadow: `0 0 120px ${theme.accent}, 0 0 240px ${theme.accent2}88`,
          filter: "blur(2px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: cx - 60,
          top: cy - 18,
          width: 120,
          textAlign: "center",
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 14,
          letterSpacing: 4,
          color: "#fff",
          opacity: interpolate(frame, [80, 120], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          textShadow: "0 0 20px rgba(0,0,0,0.8)",
        }}
      >
        LLM
      </div>
    </AbsoluteFill>
  );
};

const SceneCurated: React.FC = () => {
  const frame = useCurrentFrame();
  const products = [
    { c1: "#D4A574", c2: "#8B5E3C", name: "Camel Trench", brand: "ARKET" },
    { c1: "#1A1A2E", c2: "#0F0F1F", name: "Wide Wool Pant", brand: "COS" },
    { c1: "#E8C7B0", c2: "#C49A78", name: "Cashmere Knit", brand: "UNIQLO" },
    { c1: "#3D2817", c2: "#1F140A", name: "Leather Loafer", brand: "CELINE" },
  ];
  return (
    <AbsoluteFill style={{ padding: 100, justifyContent: "center" }}>
      <div style={{ marginBottom: 40 }}>
        <MonoLabel text="03 · CURATED FOR YOU" color={theme.gold} />
        <div style={{ marginTop: 20 }}>
          <TypeReveal text="Only what fits you." size={72} delay={6} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 24 }}>
        {products.map((p, i) => {
          const f = frame - 40 - i * 14;
          const s = spring({ frame: f, fps: 30, config: { damping: 16 } });
          const o = interpolate(f, [0, 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return (
            <div
              key={i}
              style={{
                opacity: o,
                transform: `translateY(${interpolate(s, [0, 1], [60, 0])}px) scale(${interpolate(s, [0, 1], [0.9, 1])})`,
              }}
            >
              <div
                style={{
                  width: "100%",
                  aspectRatio: "3/4",
                  borderRadius: 14,
                  background: `linear-gradient(135deg, ${p.c1}, ${p.c2})`,
                  boxShadow: `0 20px 60px ${p.c2}88`,
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: 16,
                    right: 16,
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    background: `${theme.accent}cc`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 18,
                  }}
                >
                  ✦
                </div>
              </div>
              <div
                style={{
                  marginTop: 14,
                  fontSize: 11,
                  letterSpacing: 3,
                  color: theme.inkDim,
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                {p.brand}
              </div>
              <div style={{ marginTop: 4, fontSize: 18, fontWeight: 600 }}>{p.name}</div>
              <div style={{ marginTop: 4, fontSize: 12, color: theme.accent2 }}>96% match</div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

const SceneFinale: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ padding: 120, justifyContent: "center", alignItems: "center" }}>
      <Scanline />
      <MonoLabel text="STYLED BY YOU · BUILT BY AI" />
      <div style={{ marginTop: 32, textAlign: "center" }}>
        <TypeReveal text="Your taste." size={170} delay={6} />
      </div>
      <div style={{ marginTop: 12, textAlign: "center" }}>
        <TypeReveal text="Visualized." size={170} italic color={theme.accent2} delay={22} />
      </div>
      <div
        style={{
          marginTop: 80,
          opacity: interpolate(frame, [140, 180], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          fontSize: 20,
          fontFamily: "'JetBrains Mono', monospace",
          letterSpacing: 8,
          color: theme.inkDim,
        }}
      >
        MYMYON · DISCOVER
      </div>
    </AbsoluteFill>
  );
};
