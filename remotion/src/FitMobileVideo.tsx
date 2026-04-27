import React from "react";
import { AbsoluteFill, Sequence, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { theme } from "./theme";
import { Grid, Vignette, CornerHUD } from "./components/Grid";
import { TypeReveal, MonoLabel } from "./components/TypeReveal";
import { Phone, ZoomHighlight } from "./components/DeviceFrame";
import { Cursor } from "./components/Cursor";

// MOBILE FIT — 1080x1920, 30s. Phone in center, finger taps, scroll, body data overlay
export const FitMobileVideo: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: theme.bg, color: theme.ink, fontFamily: "'Inter', sans-serif" }}>
      <Grid />
      <Vignette />
      <CornerHUD label="MYMYON · FIT · MOBILE" />

      <Sequence from={0} durationInFrames={75}><SceneIntro /></Sequence>
      <Sequence from={70} durationInFrames={260}><SceneTapScan /></Sequence>
      <Sequence from={325} durationInFrames={290}><SceneBody /></Sequence>
      <Sequence from={610} durationInFrames={290}><SceneSize /></Sequence>
    </AbsoluteFill>
  );
};

const SceneIntro: React.FC = () => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [50, 75], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ padding: 100, justifyContent: "center", opacity: o }}>
      <MonoLabel text="01 · MYMYON FIT" />
      <div style={{ marginTop: 24 }}>
        <TypeReveal text="Your size." size={180} weight={700} />
      </div>
      <div style={{ marginTop: 8 }}>
        <TypeReveal text="In 2 photos." size={180} italic color={theme.accent} delay={10} />
      </div>
      <div style={{ marginTop: 40 }}>
        <TypeReveal text="No tape. No guess." size={48} weight={400} color={theme.inkDim} delay={26} />
      </div>
    </AbsoluteFill>
  );
};

const SceneTapScan: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 18 } });
  const phoneY = interpolate(enter, [0, 1], [120, 0]);

  // tap on FRONT card — phone is centered, ~width 700, height 1517 in scaled space; we use scale 1 inside Phone
  // cursor coords are inside the phone's content area
  const cursorPath = [
    { x: 60, y: 1100, at: 0 },
    { x: 200, y: 1230, at: 60 }, // FRONT card
    { x: 200, y: 1230, at: 75, click: true },
    { x: 480, y: 1230, at: 150 }, // SIDE card
    { x: 480, y: 1230, at: 165, click: true },
  ];

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{ transform: `translateY(${phoneY}px)`, opacity: enter, position: "relative" }}>
        <Phone src="images/fit-mobile.png" width={700} glow={theme.accent}>
          <Cursor path={cursorPath} color={theme.accent} />
          {frame > 100 && frame < 200 && (
            <ZoomHighlight
              x={50}
              y={1140}
              w={620}
              h={250}
              color={theme.accent2}
              opacity={interpolate(frame, [100, 120, 190, 200], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
            />
          )}
        </Phone>
      </div>
      <div style={{ position: "absolute", top: 80, left: 80, right: 80 }}>
        <MonoLabel text="STEP 01 · UPLOAD FRONT + SIDE" delay={20} />
        <div style={{ marginTop: 16, fontSize: 56, fontWeight: 600 }}>
          Snap two. <span style={{ color: theme.accent, fontStyle: "italic" }}>Done.</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const SceneBody: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 18 } });
  const measurements = [
    { label: "HEIGHT", val: 174.0, unit: "cm" },
    { label: "SHOULDER", val: 44.2, unit: "cm" },
    { label: "CHEST", val: 96.8, unit: "cm" },
    { label: "WAIST", val: 78.4, unit: "cm" },
  ];
  return (
    <AbsoluteFill style={{ padding: 80, alignItems: "center" }}>
      <div style={{ marginTop: 60, opacity: enter }}>
        <MonoLabel text="STEP 02 · BODY MAPPED" />
        <div style={{ marginTop: 20 }}>
          <TypeReveal text="Your body," size={120} delay={6} />
        </div>
        <div style={{ marginTop: 4 }}>
          <TypeReveal text="in numbers." size={120} italic color={theme.accent} delay={16} />
        </div>
      </div>
      <div style={{ marginTop: 80, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, width: "100%", maxWidth: 900 }}>
        {measurements.map((m, i) => {
          const f = frame - 60 - i * 14;
          const o = interpolate(f, [0, 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const y = interpolate(f, [0, 18], [40, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const k = interpolate(f, [12, 60], [0, m.val], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return (
            <div
              key={i}
              style={{
                opacity: o,
                transform: `translateY(${y}px)`,
                padding: 36,
                border: `1px solid ${theme.grid}`,
                borderRadius: 22,
                background: "rgba(255,255,255,0.03)",
              }}
            >
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 16, letterSpacing: 4, color: theme.inkDim }}>
                {m.label}
              </div>
              <div style={{ marginTop: 14, fontSize: 76, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", letterSpacing: -2 }}>
                {k.toFixed(1)}
                <span style={{ fontSize: 28, color: theme.inkDim, marginLeft: 8 }}>{m.unit}</span>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 60, opacity: interpolate(frame, [180, 230], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }), fontFamily: "'JetBrains Mono', monospace", fontSize: 22, letterSpacing: 6, color: theme.accent2 }}>
        BODY TYPE · RECTANGLE
      </div>
    </AbsoluteFill>
  );
};

const SceneSize: React.FC = () => {
  const frame = useCurrentFrame();
  const sizes = ["XS", "S", "M", "L", "XL"];
  const winner = 2;
  return (
    <AbsoluteFill style={{ padding: 80, justifyContent: "center", alignItems: "center" }}>
      <MonoLabel text="STEP 03 · MATCHED" />
      <div style={{ marginTop: 24, textAlign: "center" }}>
        <TypeReveal text="One size" size={150} delay={6} />
      </div>
      <div style={{ marginTop: 4 }}>
        <TypeReveal text="fits you." size={150} italic color={theme.accent} delay={16} />
      </div>
      <div style={{ display: "flex", gap: 18, marginTop: 100, flexWrap: "wrap", justifyContent: "center" }}>
        {sizes.map((s, i) => {
          const f = frame - 50 - i * 8;
          const o = interpolate(f, [0, 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const isWin = i === winner;
          const winFrame = frame - 130;
          const winScale = interpolate(winFrame, [0, 22], [1, isWin ? 1.4 : 0.85], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const winOp = isWin ? 1 : interpolate(winFrame, [0, 22], [1, 0.2], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return (
            <div
              key={s}
              style={{
                opacity: o * winOp,
                transform: `scale(${winScale})`,
                width: 140,
                height: 170,
                borderRadius: 18,
                border: `3px solid ${isWin && winFrame > 5 ? theme.accent : theme.grid}`,
                background: isWin && winFrame > 5 ? `${theme.accent}33` : "rgba(255,255,255,0.02)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 64,
                fontWeight: 700,
                fontFamily: "'Space Grotesk', sans-serif",
                color: isWin && winFrame > 5 ? theme.accent : theme.ink,
                boxShadow: isWin && winFrame > 5 ? `0 0 100px ${theme.accent}99` : "none",
              }}
            >
              {s}
            </div>
          );
        })}
      </div>
      <div
        style={{
          marginTop: 80,
          opacity: interpolate(frame, [180, 220], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          fontSize: 26,
          fontFamily: "'JetBrains Mono', monospace",
          letterSpacing: 6,
          color: theme.accent2,
        }}
      >
        CONFIDENCE · 94%
      </div>
      <div style={{ marginTop: 60, opacity: interpolate(frame, [240, 280], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }), fontSize: 22, fontFamily: "'JetBrains Mono', monospace", letterSpacing: 10, color: theme.inkDim }}>
        MYMYON · FIT
      </div>
    </AbsoluteFill>
  );
};
