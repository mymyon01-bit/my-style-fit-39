import React from "react";
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import { theme } from "./theme";
import { Grid, Scanline, Vignette, CornerHUD } from "./components/Grid";
import { PhoneFrame } from "./components/PhoneFrame";
import { TypeReveal, MonoLabel } from "./components/TypeReveal";

// FIT video — 30s @ 30fps = 900 frames
// Story: scan body → measure → match garment → perfect fit
export const FitVideo: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: theme.bg, color: theme.ink, fontFamily: "'Inter', sans-serif" }}>
      <Grid />
      <Vignette />
      <CornerHUD label="MYMYON · FIT ENGINE" />

      <Sequence from={0} durationInFrames={120}>
        <SceneIntro />
      </Sequence>
      <Sequence from={110} durationInFrames={180}>
        <SceneScan />
      </Sequence>
      <Sequence from={280} durationInFrames={180}>
        <SceneMeasure />
      </Sequence>
      <Sequence from={450} durationInFrames={210}>
        <SceneMatch />
      </Sequence>
      <Sequence from={650} durationInFrames={250}>
        <SceneResult />
      </Sequence>
    </AbsoluteFill>
  );
};

const SceneIntro: React.FC = () => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [90, 120], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ opacity: o, padding: 120, justifyContent: "center" }}>
      <div style={{ marginBottom: 32 }}>
        <MonoLabel text="01 · BODY → GARMENT" />
      </div>
      <TypeReveal text="Stop guessing" size={140} weight={700} />
      <div style={{ marginTop: 18 }}>
        <TypeReveal text="your size." size={140} weight={400} italic color={theme.accent} delay={10} />
      </div>
    </AbsoluteFill>
  );
};

const SceneScan: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 18 } });
  const phoneX = interpolate(enter, [0, 1], [-200, 0]);
  const scan = interpolate(frame, [30, 150], [0, 100]);
  return (
    <AbsoluteFill style={{ flexDirection: "row", alignItems: "center", padding: 100, gap: 80 }}>
      <div style={{ transform: `translateX(${phoneX}px)`, opacity: enter, position: "relative" }}>
        <PhoneFrame src="images/fit.png" width={400} rotateY={6} glow={theme.accent2} />
        {/* scan beam */}
        <div
          style={{
            position: "absolute",
            top: scan * 8,
            left: 12,
            right: 12,
            height: 3,
            background: `linear-gradient(90deg, transparent, ${theme.accent2}, transparent)`,
            boxShadow: `0 0 20px ${theme.accent2}`,
            borderRadius: 2,
          }}
        />
      </div>
      <div style={{ flex: 1 }}>
        <MonoLabel text="STEP 01 / SCAN" />
        <div style={{ marginTop: 24 }}>
          <TypeReveal text="Front. Side. Done." size={86} delay={10} />
        </div>
        <p
          style={{
            marginTop: 28,
            fontSize: 22,
            color: theme.inkDim,
            lineHeight: 1.5,
            maxWidth: 520,
            opacity: interpolate(frame, [40, 70], [0, 1], { extrapolateRight: "clamp" }),
          }}
        >
          Two photos. AI vision builds your full body profile in seconds — height, shoulders, waist, inseam.
        </p>
      </div>
    </AbsoluteFill>
  );
};

const SceneMeasure: React.FC = () => {
  const frame = useCurrentFrame();
  const measurements = [
    { label: "SHOULDER", val: "44.2", unit: "cm" },
    { label: "CHEST", val: "96.8", unit: "cm" },
    { label: "WAIST", val: "78.4", unit: "cm" },
    { label: "INSEAM", val: "81.5", unit: "cm" },
  ];
  return (
    <AbsoluteFill style={{ padding: 120, justifyContent: "center" }}>
      <MonoLabel text="STEP 02 / MEASURE" />
      <div style={{ marginTop: 28 }}>
        <TypeReveal text="Your body, mapped." size={92} delay={6} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 32, marginTop: 80 }}>
        {measurements.map((m, i) => {
          const f = frame - 30 - i * 12;
          const o = interpolate(f, [0, 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const y = interpolate(f, [0, 18], [40, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          // count up effect
          const target = parseFloat(m.val);
          const k = interpolate(f, [10, 50], [0, target], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return (
            <div
              key={i}
              style={{
                opacity: o,
                transform: `translateY(${y}px)`,
                padding: 32,
                border: `1px solid ${theme.grid}`,
                borderRadius: 18,
                background: "rgba(255,255,255,0.02)",
              }}
            >
              <div
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 11,
                  letterSpacing: 4,
                  color: theme.inkDim,
                }}
              >
                {m.label}
              </div>
              <div
                style={{
                  marginTop: 14,
                  fontSize: 56,
                  fontWeight: 700,
                  fontFamily: "'Space Grotesk', sans-serif",
                  letterSpacing: -2,
                  color: theme.ink,
                }}
              >
                {k.toFixed(1)}
                <span style={{ fontSize: 22, color: theme.inkDim, marginLeft: 6 }}>{m.unit}</span>
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

const SceneMatch: React.FC = () => {
  const frame = useCurrentFrame();
  const sizes = ["XS", "S", "M", "L", "XL"];
  const winner = 2; // M
  return (
    <AbsoluteFill style={{ padding: 120, justifyContent: "center", alignItems: "center" }}>
      <MonoLabel text="STEP 03 / MATCH" />
      <div style={{ marginTop: 28, textAlign: "center" }}>
        <TypeReveal text="One size fits you." size={86} delay={6} />
      </div>
      <div style={{ display: "flex", gap: 24, marginTop: 80 }}>
        {sizes.map((s, i) => {
          const f = frame - 40 - i * 8;
          const o = interpolate(f, [0, 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const isWin = i === winner;
          const winFrame = frame - 130;
          const winScale = interpolate(winFrame, [0, 22], [1, isWin ? 1.25 : 0.85], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const winOpacity = isWin
            ? 1
            : interpolate(winFrame, [0, 22], [1, 0.25], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return (
            <div
              key={s}
              style={{
                opacity: o * winOpacity,
                transform: `scale(${winScale})`,
                width: 110,
                height: 130,
                borderRadius: 14,
                border: `2px solid ${isWin && winFrame > 5 ? theme.accent : theme.grid}`,
                background: isWin && winFrame > 5 ? `${theme.accent}22` : "rgba(255,255,255,0.02)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 42,
                fontWeight: 700,
                fontFamily: "'Space Grotesk', sans-serif",
                color: isWin && winFrame > 5 ? theme.accent : theme.ink,
                boxShadow: isWin && winFrame > 5 ? `0 0 60px ${theme.accent}66` : "none",
              }}
            >
              {s}
            </div>
          );
        })}
      </div>
      <div
        style={{
          marginTop: 60,
          opacity: interpolate(frame, [150, 175], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          fontSize: 18,
          fontFamily: "'JetBrains Mono', monospace",
          letterSpacing: 4,
          color: theme.accent2,
        }}
      >
        CONFIDENCE · 94%
      </div>
    </AbsoluteFill>
  );
};

const SceneResult: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ padding: 120, justifyContent: "center", alignItems: "center" }}>
      <Scanline />
      <MonoLabel text="PERFECT FIT" />
      <div style={{ marginTop: 32, textAlign: "center" }}>
        <TypeReveal text="Wear it" size={180} delay={6} />
      </div>
      <div style={{ marginTop: 18 }}>
        <TypeReveal text="like it's yours." size={180} delay={20} italic color={theme.accent} />
      </div>
      <div
        style={{
          marginTop: 80,
          opacity: interpolate(frame, [120, 160], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          fontSize: 20,
          fontFamily: "'JetBrains Mono', monospace",
          letterSpacing: 8,
          color: theme.inkDim,
        }}
      >
        MYMYON · FIT
      </div>
    </AbsoluteFill>
  );
};
