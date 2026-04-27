import React from "react";
import { AbsoluteFill, Sequence, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { theme } from "./theme";
import { Grid, Vignette, CornerHUD, Scanline } from "./components/Grid";
import { TypeReveal, MonoLabel } from "./components/TypeReveal";
import { Phone, ZoomHighlight } from "./components/DeviceFrame";
import { Cursor } from "./components/Cursor";

// MOBILE DISCOVER — 1080x1920, 30s
export const DiscoverMobileVideo: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: theme.bg, color: theme.ink, fontFamily: "'Inter', sans-serif" }}>
      <Grid />
      <Vignette />
      <CornerHUD label="MYMYON · DISCOVER · MOBILE" />

      <Sequence from={0} durationInFrames={75}><SceneIntro /></Sequence>
      <Sequence from={70} durationInFrames={290}><SceneSwipe /></Sequence>
      <Sequence from={355} durationInFrames={220}><SceneMood /></Sequence>
      <Sequence from={570} durationInFrames={170}><SceneCombine /></Sequence>
      <Sequence from={730} durationInFrames={170}><SceneFinale /></Sequence>
    </AbsoluteFill>
  );
};

const SceneIntro: React.FC = () => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [50, 75], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ padding: 100, justifyContent: "center", opacity: o }}>
      <MonoLabel text="03 · DISCOVER" color={theme.accent2} />
      <div style={{ marginTop: 24 }}>
        <TypeReveal text="Skip the" size={180} weight={700} />
      </div>
      <div style={{ marginTop: 4 }}>
        <TypeReveal text="scroll." size={180} italic color={theme.accent} delay={10} />
      </div>
      <div style={{ marginTop: 40 }}>
        <TypeReveal text="AI sees what fits you." size={48} weight={400} color={theme.inkDim} delay={26} />
      </div>
    </AbsoluteFill>
  );
};

const SceneSwipe: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 18 } });
  const phoneY = interpolate(enter, [0, 1], [120, 0]);

  // cursor taps on a product card and zooms
  const cursorPath = [
    { x: 60, y: 1700, at: 0 },
    { x: 200, y: 850, at: 70 },
    { x: 200, y: 850, at: 85, click: true },
    { x: 520, y: 850, at: 170 },
    { x: 520, y: 850, at: 185, click: true },
    { x: 520, y: 1380, at: 250 },
    { x: 520, y: 1380, at: 265, click: true },
  ];

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{ transform: `translateY(${phoneY}px)`, opacity: enter, position: "relative" }}>
        <Phone src="images/discover-mobile.png" width={700} glow={theme.accent2}>
          <Cursor path={cursorPath} color={theme.accent2} />
          {frame > 110 && frame < 230 && (
            <ZoomHighlight
              x={350}
              y={680}
              w={300}
              h={420}
              color={theme.accent2}
              opacity={interpolate(frame, [110, 130, 220, 230], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
            />
          )}
        </Phone>
      </div>
      <div style={{ position: "absolute", top: 80, left: 80, right: 80 }}>
        <MonoLabel text="STEP 01 · CURATED FEED" delay={20} color={theme.accent2} />
        <div style={{ marginTop: 16, fontSize: 56, fontWeight: 600 }}>
          Only what <span style={{ color: theme.accent2, fontStyle: "italic" }}>fits you.</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const SceneMood: React.FC = () => {
  const frame = useCurrentFrame();
  const inputs = [
    { txt: "soft autumn", x: 0.1, y: 0.4, c: theme.accent, at: 0 },
    { txt: "dinner mood", x: 0.55, y: 0.32, c: theme.accent2, at: 14 },
    { txt: "editorial", x: 0.18, y: 0.55, c: theme.gold, at: 28 },
    { txt: "no heels", x: 0.55, y: 0.62, c: "#A78BFA", at: 42 },
    { txt: "Seoul · 14°C", x: 0.3, y: 0.78, c: theme.inkDim, at: 56 },
  ];
  return (
    <AbsoluteFill style={{ padding: 80 }}>
      <div style={{ marginTop: 60 }}>
        <MonoLabel text="STEP 02 · YOUR INPUTS" color={theme.accent} />
        <div style={{ marginTop: 22 }}>
          <TypeReveal text="Mood. Plan." size={110} delay={6} />
        </div>
        <div style={{ marginTop: 4 }}>
          <TypeReveal text="Weather." size={110} italic color={theme.accent} delay={16} />
        </div>
      </div>
      {inputs.map((inp, i) => {
        const f = frame - 60 - inp.at;
        const o = interpolate(f, [0, 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        const s = spring({ frame: f, fps: 30, config: { damping: 14 } });
        const float = Math.sin((frame + i * 30) * 0.04) * 8;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${inp.x * 100}%`,
              top: `${inp.y * 100}%`,
              opacity: o,
              transform: `scale(${s}) translateY(${float}px)`,
              padding: "26px 44px",
              borderRadius: 999,
              background: "rgba(255,255,255,0.06)",
              border: `2px solid ${inp.c}`,
              color: inp.c,
              fontSize: 44,
              fontWeight: 500,
              fontFamily: "'Space Grotesk', sans-serif",
              boxShadow: `0 0 60px ${inp.c}55`,
              whiteSpace: "nowrap",
            }}
          >
            {inp.txt}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

const SceneCombine: React.FC = () => {
  const frame = useCurrentFrame();
  const pulse = 1 + Math.sin(frame * 0.18) * 0.08;
  const cx = 540;
  const cy = 960;
  const streams = 8;
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", top: 100, left: 80, right: 80 }}>
        <MonoLabel text="STEP 03 · SYNTHESIS" color={theme.accent} />
        <div style={{ marginTop: 22 }}>
          <TypeReveal text="AI fuses" size={110} delay={6} />
        </div>
        <div style={{ marginTop: 4 }}>
          <TypeReveal text="every signal." size={110} italic color={theme.accent2} delay={16} />
        </div>
      </div>
      <svg width="1080" height="1920" style={{ position: "absolute", inset: 0 }}>
        {Array.from({ length: streams }).map((_, i) => {
          const angle = (i / streams) * Math.PI * 2;
          const r = 360;
          const sx = cx + Math.cos(angle) * r;
          const sy = cy + Math.sin(angle) * r;
          const f = frame - 30 - i * 4;
          const t = interpolate(f, [0, 60], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const ex = sx + (cx - sx) * t;
          const ey = sy + (cy - sy) * t;
          return (
            <line key={i} x1={sx} y1={sy} x2={ex} y2={ey} stroke={i % 2 === 0 ? theme.accent : theme.accent2} strokeWidth={3} opacity={0.7} strokeDasharray="6 8" />
          );
        })}
      </svg>
      <div
        style={{
          position: "absolute",
          left: cx - 130,
          top: cy - 130,
          width: 260,
          height: 260,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${theme.accent} 0%, ${theme.accent2} 70%, transparent 100%)`,
          transform: `scale(${pulse})`,
          opacity: interpolate(frame, [20, 80], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          boxShadow: `0 0 160px ${theme.accent}, 0 0 300px ${theme.accent2}88`,
          filter: "blur(2px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: cx - 80,
          top: cy - 22,
          width: 160,
          textAlign: "center",
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 28,
          letterSpacing: 8,
          color: "#fff",
          opacity: interpolate(frame, [80, 120], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          textShadow: "0 0 24px rgba(0,0,0,0.8)",
        }}
      >
        LLM
      </div>
    </AbsoluteFill>
  );
};

const SceneFinale: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ padding: 100, justifyContent: "center", alignItems: "center" }}>
      <Scanline />
      <MonoLabel text="STYLED BY YOU · BUILT BY AI" />
      <div style={{ marginTop: 32, textAlign: "center" }}>
        <TypeReveal text="Your taste." size={170} delay={6} />
      </div>
      <div style={{ marginTop: 8, textAlign: "center" }}>
        <TypeReveal text="Visualized." size={170} italic color={theme.accent2} delay={20} />
      </div>
      <div style={{ marginTop: 80, opacity: interpolate(frame, [120, 160], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }), fontSize: 24, fontFamily: "'JetBrains Mono', monospace", letterSpacing: 10, color: theme.inkDim }}>
        MYMYON · DISCOVER
      </div>
    </AbsoluteFill>
  );
};
