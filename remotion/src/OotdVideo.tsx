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
import { Grid, Vignette, CornerHUD } from "./components/Grid";
import { PhoneFrame } from "./components/PhoneFrame";
import { TypeReveal, MonoLabel } from "./components/TypeReveal";

// OOTD — share, music, friends, showroom — 30s
export const OotdVideo: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: theme.bg, color: theme.ink, fontFamily: "'Inter', sans-serif" }}>
      <Grid />
      <Vignette />
      <CornerHUD label="MYMYON · #OOTD" />

      <Sequence from={0} durationInFrames={130}>
        <SceneHook />
      </Sequence>
      <Sequence from={120} durationInFrames={170}>
        <SceneCapture />
      </Sequence>
      <Sequence from={280} durationInFrames={180}>
        <SceneMusic />
      </Sequence>
      <Sequence from={450} durationInFrames={200}>
        <SceneShare />
      </Sequence>
      <Sequence from={640} durationInFrames={260}>
        <SceneShowroom />
      </Sequence>
    </AbsoluteFill>
  );
};

const SceneHook: React.FC = () => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [100, 130], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ padding: 120, justifyContent: "center", opacity: o }}>
      <MonoLabel text="02 · YOUR DAILY DROP" color={theme.accent} />
      <div style={{ marginTop: 32 }}>
        <TypeReveal text="Today's fit." size={150} weight={700} />
      </div>
      <div style={{ marginTop: 16 }}>
        <TypeReveal text="Your stage." size={150} italic color={theme.accent2} delay={12} />
      </div>
    </AbsoluteFill>
  );
};

const SceneCapture: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 16 } });
  return (
    <AbsoluteFill style={{ flexDirection: "row", alignItems: "center", padding: 100, gap: 80 }}>
      <div style={{ flex: 1 }}>
        <MonoLabel text="01 · CAPTURE" />
        <div style={{ marginTop: 28 }}>
          <TypeReveal text="Snap. Style. Post." size={84} delay={6} />
        </div>
        <p
          style={{
            marginTop: 28,
            fontSize: 22,
            color: theme.inkDim,
            lineHeight: 1.5,
            maxWidth: 540,
            opacity: interpolate(frame, [40, 70], [0, 1], { extrapolateRight: "clamp" }),
          }}
        >
          매일의 옷차림이 곧 당신의 시그니처. One tap to share with your circle.
        </p>
      </div>
      <div style={{ transform: `translateX(${interpolate(s, [0, 1], [200, 0])}px) rotateY(-6deg)`, opacity: s }}>
        <PhoneFrame src="images/ootd.png" width={400} glow={theme.accent} />
      </div>
    </AbsoluteFill>
  );
};

const SceneMusic: React.FC = () => {
  const frame = useCurrentFrame();
  const bars = 24;
  return (
    <AbsoluteFill style={{ padding: 120, justifyContent: "center" }}>
      <MonoLabel text="02 · SOUNDTRACK" color={theme.accent2} />
      <div style={{ marginTop: 28 }}>
        <TypeReveal text="Pick the vibe." size={92} delay={6} />
      </div>
      <div style={{ marginTop: 20 }}>
        <TypeReveal text="Your fit, your beat." size={64} weight={400} italic color={theme.inkDim} delay={20} />
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 8, marginTop: 80, height: 180 }}>
        {Array.from({ length: bars }).map((_, i) => {
          const phase = (frame + i * 6) * 0.18;
          const h = 30 + Math.abs(Math.sin(phase)) * 150 + Math.abs(Math.cos(phase * 1.3)) * 40;
          const o = interpolate(frame, [40 + i * 2, 70 + i * 2], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          return (
            <div
              key={i}
              style={{
                width: 14,
                height: h,
                opacity: o,
                background: `linear-gradient(180deg, ${theme.accent}, ${theme.accent2})`,
                borderRadius: 8,
                boxShadow: `0 0 20px ${theme.accent}55`,
              }}
            />
          );
        })}
      </div>
      <div
        style={{
          marginTop: 36,
          opacity: interpolate(frame, [80, 110], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 14,
          letterSpacing: 4,
          color: theme.inkDim,
        }}
      >
        ♫ NOW PLAYING — MIDNIGHT FIT (REMIX)
      </div>
    </AbsoluteFill>
  );
};

const SceneShare: React.FC = () => {
  const frame = useCurrentFrame();
  const messages = [
    { who: "Yuna", txt: "이 핏 너무 좋다 🔥", side: "left", at: 20 },
    { who: "You", txt: "got the M, perfect", side: "right", at: 50 },
    { who: "Min", txt: "drop the link!!", side: "left", at: 80 },
    { who: "You", txt: "sent ✨", side: "right", at: 110 },
  ];
  return (
    <AbsoluteFill style={{ padding: 120, justifyContent: "center" }}>
      <MonoLabel text="03 · SHARE WITH YOUR CIRCLE" />
      <div style={{ marginTop: 28 }}>
        <TypeReveal text="Friends. Reactions." size={78} delay={6} />
      </div>
      <div style={{ marginTop: 12 }}>
        <TypeReveal text="Real time." size={78} italic color={theme.accent} delay={18} />
      </div>
      <div style={{ marginTop: 60, display: "flex", flexDirection: "column", gap: 18, maxWidth: 720 }}>
        {messages.map((m, i) => {
          const f = frame - m.at;
          const o = interpolate(f, [0, 16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const x = interpolate(f, [0, 16], [m.side === "left" ? -40 : 40, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const isMe = m.side === "right";
          return (
            <div
              key={i}
              style={{
                alignSelf: isMe ? "flex-end" : "flex-start",
                opacity: o,
                transform: `translateX(${x}px)`,
                padding: "16px 24px",
                borderRadius: 22,
                background: isMe ? theme.accent : "rgba(255,255,255,0.08)",
                color: isMe ? "#fff" : theme.ink,
                fontSize: 22,
                fontWeight: 500,
                maxWidth: 420,
                boxShadow: isMe ? `0 8px 30px ${theme.accent}55` : "none",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  letterSpacing: 3,
                  opacity: 0.7,
                  marginBottom: 4,
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                {m.who.toUpperCase()}
              </div>
              {m.txt}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

const SceneShowroom: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ padding: 120, justifyContent: "center", alignItems: "center" }}>
      <MonoLabel text="04 · YOUR SHOWROOM" color={theme.gold} />
      <div style={{ marginTop: 32, textAlign: "center" }}>
        <TypeReveal text="Build your" size={150} delay={6} />
      </div>
      <div style={{ marginTop: 12 }}>
        <TypeReveal text="universe." size={170} italic color={theme.accent} delay={20} />
      </div>
      {/* showroom thumbnails */}
      <div style={{ display: "flex", gap: 18, marginTop: 60 }}>
        {[0, 1, 2, 3, 4].map((i) => {
          const f = frame - 60 - i * 8;
          const s = spring({ frame: f, fps: 30, config: { damping: 14 } });
          const colors = [theme.accent, theme.accent2, theme.gold, "#A78BFA", "#F87171"];
          return (
            <div
              key={i}
              style={{
                width: 120,
                height: 160,
                borderRadius: 16,
                background: `linear-gradient(135deg, ${colors[i]}, ${colors[(i + 1) % 5]})`,
                opacity: s,
                transform: `translateY(${interpolate(s, [0, 1], [40, 0])}px)`,
                boxShadow: `0 20px 50px ${colors[i]}55`,
              }}
            />
          );
        })}
      </div>
      <div
        style={{
          marginTop: 60,
          opacity: interpolate(frame, [160, 200], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          fontSize: 18,
          fontFamily: "'JetBrains Mono', monospace",
          letterSpacing: 8,
          color: theme.inkDim,
        }}
      >
        MYMYON · OOTD
      </div>
    </AbsoluteFill>
  );
};
