import React from "react";
import { AbsoluteFill, Sequence, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { theme } from "./theme";
import { Grid, Vignette, CornerHUD } from "./components/Grid";
import { TypeReveal, MonoLabel } from "./components/TypeReveal";
import { Phone, ZoomHighlight } from "./components/DeviceFrame";
import { Cursor } from "./components/Cursor";

// MOBILE OOTD — 1080x1920, 30s
export const OotdMobileVideo: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: theme.bg, color: theme.ink, fontFamily: "'Inter', sans-serif" }}>
      <Grid />
      <Vignette />
      <CornerHUD label="MYMYON · #OOTD · MOBILE" />

      <Sequence from={0} durationInFrames={75}><SceneIntro /></Sequence>
      <Sequence from={70} durationInFrames={300}><SceneRanking /></Sequence>
      <Sequence from={365} durationInFrames={250}><SceneMusic /></Sequence>
      <Sequence from={610} durationInFrames={290}><SceneShare /></Sequence>
    </AbsoluteFill>
  );
};

const SceneIntro: React.FC = () => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [50, 75], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ padding: 100, justifyContent: "center", opacity: o }}>
      <MonoLabel text="02 · #OOTD" color={theme.accent} />
      <div style={{ marginTop: 24 }}>
        <TypeReveal text="Today's fit." size={180} weight={700} />
      </div>
      <div style={{ marginTop: 8 }}>
        <TypeReveal text="Your stage." size={180} italic color={theme.accent2} delay={10} />
      </div>
      <div style={{ marginTop: 40 }}>
        <TypeReveal text="Star · share · style." size={48} weight={400} color={theme.inkDim} delay={26} />
      </div>
    </AbsoluteFill>
  );
};

const SceneRanking: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 18 } });
  const phoneY = interpolate(enter, [0, 1], [120, 0]);

  // tap on RANKING (already on it), then on #1 card — coords are within the phone content (375x812)
  // Mobile screenshot is rendered at 700px width, so coords scale ~1.87x. Use raw 375 coordinate space scaled.
  // Phone content uses relative 0..width image. The cursor takes pixel coords inside the inner div — width = 700 - 24 padding = 676
  // Easier: place cursor in the same coord system as the inner image which is rendered at width 676.
  const cursorPath = [
    { x: 80, y: 1700, at: 0 },
    { x: 180, y: 740, at: 70 }, // approximately #1 ranking card in scaled coords
    { x: 180, y: 740, at: 85, click: true },
    { x: 540, y: 1180, at: 180 }, // FOR YOU section
    { x: 540, y: 1180, at: 195, click: true },
  ];

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{ transform: `translateY(${phoneY}px)`, opacity: enter, position: "relative" }}>
        <Phone src="images/ootd-mobile.png" width={700} glow={theme.accent}>
          <Cursor path={cursorPath} color={theme.accent} />
          {frame > 110 && frame < 220 && (
            <ZoomHighlight
              x={50}
              y={530}
              w={290}
              h={420}
              color={theme.accent}
              opacity={interpolate(frame, [110, 130, 210, 220], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
            />
          )}
        </Phone>
      </div>
      <div style={{ position: "absolute", top: 80, left: 80, right: 80 }}>
        <MonoLabel text="WEEKLY · CROWNED BOARD" delay={20} />
        <div style={{ marginTop: 16, fontSize: 56, fontWeight: 600 }}>
          Top fits, <span style={{ color: theme.accent, fontStyle: "italic" }}>star-ranked.</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const SceneMusic: React.FC = () => {
  const frame = useCurrentFrame();
  const bars = 28;
  return (
    <AbsoluteFill style={{ padding: 100, justifyContent: "center" }}>
      <MonoLabel text="03 · SOUNDTRACK" color={theme.accent2} />
      <div style={{ marginTop: 28 }}>
        <TypeReveal text="Pick the vibe." size={130} delay={6} />
      </div>
      <div style={{ marginTop: 6 }}>
        <TypeReveal text="Your beat." size={130} italic color={theme.accent2} delay={18} />
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 14, marginTop: 100, height: 320, justifyContent: "center" }}>
        {Array.from({ length: bars }).map((_, i) => {
          const phase = (frame + i * 6) * 0.18;
          const h = 50 + Math.abs(Math.sin(phase)) * 250 + Math.abs(Math.cos(phase * 1.3)) * 60;
          const o = interpolate(frame, [40 + i * 2, 70 + i * 2], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return (
            <div key={i} style={{ width: 22, height: h, opacity: o, background: `linear-gradient(180deg, ${theme.accent}, ${theme.accent2})`, borderRadius: 11, boxShadow: `0 0 30px ${theme.accent}66` }} />
          );
        })}
      </div>
      <div style={{ marginTop: 60, opacity: interpolate(frame, [80, 120], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }), fontFamily: "'JetBrains Mono', monospace", fontSize: 22, letterSpacing: 4, color: theme.inkDim, textAlign: "center" }}>
        ♫ NOW PLAYING — MIDNIGHT FIT (REMIX)
      </div>
    </AbsoluteFill>
  );
};

const SceneShare: React.FC = () => {
  const frame = useCurrentFrame();
  const messages = [
    { who: "Yuna", txt: "이 핏 너무 좋다 🔥", side: "left", at: 30 },
    { who: "You", txt: "got the M, perfect", side: "right", at: 75 },
    { who: "Min", txt: "drop the link!!", side: "left", at: 120 },
    { who: "You", txt: "sent ✨", side: "right", at: 165 },
  ];
  return (
    <AbsoluteFill style={{ padding: 100, justifyContent: "center" }}>
      <MonoLabel text="04 · SHARE WITH YOUR CIRCLE" />
      <div style={{ marginTop: 24 }}>
        <TypeReveal text="Friends." size={120} delay={6} />
      </div>
      <div style={{ marginTop: 4 }}>
        <TypeReveal text="Real time." size={120} italic color={theme.accent} delay={16} />
      </div>
      <div style={{ marginTop: 80, display: "flex", flexDirection: "column", gap: 28 }}>
        {messages.map((m, i) => {
          const f = frame - m.at;
          const o = interpolate(f, [0, 16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const x = interpolate(f, [0, 16], [m.side === "left" ? -60 : 60, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const isMe = m.side === "right";
          return (
            <div
              key={i}
              style={{
                alignSelf: isMe ? "flex-end" : "flex-start",
                opacity: o,
                transform: `translateX(${x}px)`,
                padding: "26px 38px",
                borderRadius: 36,
                background: isMe ? theme.accent : "rgba(255,255,255,0.1)",
                color: isMe ? "#fff" : theme.ink,
                fontSize: 36,
                fontWeight: 500,
                maxWidth: 700,
                boxShadow: isMe ? `0 12px 40px ${theme.accent}66` : "none",
              }}
            >
              <div style={{ fontSize: 14, letterSpacing: 4, opacity: 0.7, marginBottom: 6, fontFamily: "'JetBrains Mono', monospace" }}>
                {m.who.toUpperCase()}
              </div>
              {m.txt}
            </div>
          );
        })}
      </div>
      <div style={{ position: "absolute", bottom: 100, left: 0, right: 0, textAlign: "center", opacity: interpolate(frame, [220, 260], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }), fontSize: 24, fontFamily: "'JetBrains Mono', monospace", letterSpacing: 10, color: theme.inkDim }}>
        MYMYON · OOTD
      </div>
    </AbsoluteFill>
  );
};
