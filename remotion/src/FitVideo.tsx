import React from "react";
import { AbsoluteFill, Sequence, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { theme } from "./theme";
import { Grid, Vignette, CornerHUD } from "./components/Grid";
import { TypeReveal, MonoLabel } from "./components/TypeReveal";
import { BrowserFrame, ZoomHighlight } from "./components/DeviceFrame";
import { Cursor } from "./components/Cursor";
import { Camera } from "./components/Camera";

// Desktop FIT — 30s. Live demo: open site → click SCAN → upload → see body data → match size → result.
export const FitVideo: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: theme.bg, color: theme.ink, fontFamily: "'Inter', sans-serif" }}>
      <Grid />
      <Vignette />
      <CornerHUD label="MYMYON · FIT · LIVE DEMO" />

      <Sequence from={0} durationInFrames={90}><SceneIntro /></Sequence>
      <Sequence from={80} durationInFrames={260}><SceneOpenScan /></Sequence>
      <Sequence from={330} durationInFrames={250}><SceneBodyData /></Sequence>
      <Sequence from={570} durationInFrames={330}><SceneSizeMatch /></Sequence>
    </AbsoluteFill>
  );
};

const SceneIntro: React.FC = () => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [60, 90], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ padding: 120, justifyContent: "center", opacity: o }}>
      <MonoLabel text="01 · MYMYON FIT" />
      <div style={{ marginTop: 28 }}>
        <TypeReveal text="See your size." size={150} weight={700} />
      </div>
      <div style={{ marginTop: 12 }}>
        <TypeReveal text="Live, in app." size={150} italic color={theme.accent} delay={10} />
      </div>
    </AbsoluteFill>
  );
};

// Browser opens, cursor clicks SCAN tab, zoom into guidelines
const SceneOpenScan: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 18 } });
  const browserY = interpolate(enter, [0, 1], [80, 0]);

  // camera: wide → zoom into guidelines region around frame 130
  const camKeys = [
    { at: 0, scale: 1, x: 0, y: 0 },
    { at: 110, scale: 1, x: 0, y: 0 },
    { at: 170, scale: 1.55, x: 0, y: -120 },
    { at: 220, scale: 1.55, x: 0, y: -120 },
    { at: 250, scale: 1, x: 0, y: 0 },
  ];

  // cursor moves: from left, to SCAN tab (~x540, y288), clicks at frame 60, then to FRONT card (y620), clicks at 200
  const cursorPath = [
    { x: 200, y: 700, at: 0 },
    { x: 668, y: 388, at: 50 },
    { x: 668, y: 388, at: 60, click: true },
    { x: 538, y: 740, at: 130 },
    { x: 538, y: 740, at: 145, click: true },
  ];

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <Camera keys={camKeys}>
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
          <div style={{ transform: `translateY(${browserY}px)`, opacity: enter, position: "relative" }}>
            <BrowserFrame
              src="images/fit-desktop.png"
              width={1366}
              height={768}
              url="mymyon.com/fit"
              scale={0.85}
              glow={theme.accent}
            />
            <div style={{ position: "absolute", inset: 0, transform: "scale(0.85)", transformOrigin: "center center" }}>
              <div style={{ position: "absolute", top: 44, left: 0, width: 1366, height: 768, pointerEvents: "none" }}>
                <Cursor path={cursorPath} color={theme.accent} />
                {/* zoom highlight on guidelines (roughly) */}
                {frame > 150 && frame < 230 && (
                  <ZoomHighlight x={300} y={320} w={750} h={210} color={theme.accent2} opacity={interpolate(frame, [150, 170, 220, 230], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} />
                )}
              </div>
            </div>
          </div>
        </AbsoluteFill>
      </Camera>

      {/* caption overlay */}
      <div style={{ position: "absolute", bottom: 60, left: 120, right: 120, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <MonoLabel text="STEP 01 · OPEN /FIT" delay={10} />
          <div style={{ marginTop: 14, fontSize: 38, fontWeight: 600, color: theme.ink }}>
            Two photos. <span style={{ color: theme.accent2, fontStyle: "italic" }}>Front + side.</span>
          </div>
        </div>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, letterSpacing: 4, color: theme.inkDim }}>
          NO TAPE · NO MEASUREMENTS
        </div>
      </div>
    </AbsoluteFill>
  );
};

// Body data populating
const SceneBodyData: React.FC = () => {
  const frame = useCurrentFrame();
  const measurements = [
    { label: "HEIGHT", val: 174.0, unit: "cm" },
    { label: "SHOULDER", val: 44.2, unit: "cm" },
    { label: "CHEST", val: 96.8, unit: "cm" },
    { label: "WAIST", val: 78.4, unit: "cm" },
    { label: "INSEAM", val: 81.5, unit: "cm" },
    { label: "BODY TYPE", val: 0, unit: "RECTANGLE" },
  ];

  return (
    <AbsoluteFill style={{ padding: 100, flexDirection: "row", gap: 80, alignItems: "center" }}>
      {/* left: small browser preview */}
      <div style={{ flex: "0 0 auto", opacity: interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" }) }}>
        <BrowserFrame
          src="images/fit-desktop.png"
          width={1366}
          height={768}
          url="mymyon.com/fit/body"
          scale={0.42}
          glow={theme.accent2}
        />
      </div>
      {/* right: data panel */}
      <div style={{ flex: 1 }}>
        <MonoLabel text="STEP 02 · BODY PROFILE BUILT" />
        <div style={{ marginTop: 22 }}>
          <TypeReveal text="Your body," size={72} delay={6} />
        </div>
        <div style={{ marginTop: 4 }}>
          <TypeReveal text="mapped." size={72} italic color={theme.accent} delay={14} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 18, marginTop: 50 }}>
          {measurements.map((m, i) => {
            const f = frame - 40 - i * 10;
            const o = interpolate(f, [0, 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
            const y = interpolate(f, [0, 18], [30, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
            const k = m.val ? interpolate(f, [10, 50], [0, m.val], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 0;
            return (
              <div
                key={i}
                style={{
                  opacity: o,
                  transform: `translateY(${y}px)`,
                  padding: "20px 26px",
                  border: `1px solid ${theme.grid}`,
                  borderRadius: 14,
                  background: "rgba(255,255,255,0.02)",
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: 3, color: theme.inkDim }}>
                  {m.label}
                </div>
                <div style={{ fontSize: 36, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", letterSpacing: -1, color: theme.ink }}>
                  {m.val ? k.toFixed(1) : ""}
                  <span style={{ fontSize: 16, color: theme.inkDim, marginLeft: 6 }}>{m.unit}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const SceneSizeMatch: React.FC = () => {
  const frame = useCurrentFrame();
  const sizes = ["XS", "S", "M", "L", "XL"];
  const winner = 2;
  return (
    <AbsoluteFill style={{ padding: 120, justifyContent: "center", alignItems: "center" }}>
      <MonoLabel text="STEP 03 · SIZE MATCH" />
      <div style={{ marginTop: 24, textAlign: "center" }}>
        <TypeReveal text="One size fits you." size={88} delay={6} />
      </div>
      <div style={{ display: "flex", gap: 24, marginTop: 70 }}>
        {sizes.map((s, i) => {
          const f = frame - 40 - i * 8;
          const o = interpolate(f, [0, 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const isWin = i === winner;
          const winFrame = frame - 130;
          const winScale = interpolate(winFrame, [0, 22], [1, isWin ? 1.3 : 0.85], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const winOp = isWin ? 1 : interpolate(winFrame, [0, 22], [1, 0.22], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return (
            <div
              key={s}
              style={{
                opacity: o * winOp,
                transform: `scale(${winScale})`,
                width: 130,
                height: 150,
                borderRadius: 16,
                border: `2px solid ${isWin && winFrame > 5 ? theme.accent : theme.grid}`,
                background: isWin && winFrame > 5 ? `${theme.accent}22` : "rgba(255,255,255,0.02)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 50,
                fontWeight: 700,
                fontFamily: "'Space Grotesk', sans-serif",
                color: isWin && winFrame > 5 ? theme.accent : theme.ink,
                boxShadow: isWin && winFrame > 5 ? `0 0 80px ${theme.accent}88` : "none",
              }}
            >
              {s}
            </div>
          );
        })}
      </div>
      <div
        style={{
          marginTop: 50,
          opacity: interpolate(frame, [150, 175], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          fontSize: 18,
          fontFamily: "'JetBrains Mono', monospace",
          letterSpacing: 4,
          color: theme.accent2,
        }}
      >
        CONFIDENCE · 94% · BASED ON 47K BODIES
      </div>
      <div style={{ marginTop: 80, opacity: interpolate(frame, [200, 240], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }), textAlign: "center" }}>
        <TypeReveal text="Wear it like it's yours." size={88} italic color={theme.ink} delay={210} />
      </div>
      <div style={{ marginTop: 40, opacity: interpolate(frame, [260, 300], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }), fontSize: 16, fontFamily: "'JetBrains Mono', monospace", letterSpacing: 8, color: theme.inkDim }}>
        MYMYON · FIT
      </div>
    </AbsoluteFill>
  );
};
