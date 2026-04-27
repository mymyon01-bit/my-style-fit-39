import React from "react";
import { AbsoluteFill, Sequence, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { theme } from "./theme";
import { Grid, Vignette, CornerHUD } from "./components/Grid";
import { TypeReveal, MonoLabel } from "./components/TypeReveal";
import { BrowserFrame, ZoomHighlight } from "./components/DeviceFrame";
import { Cursor } from "./components/Cursor";
import { Camera } from "./components/Camera";

// Desktop OOTD — 30s. Open ranking → zoom into Top 5 → music + chat overlay → showroom thumbs
export const OotdVideo: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: theme.bg, color: theme.ink, fontFamily: "'Inter', sans-serif" }}>
      <Grid />
      <Vignette />
      <CornerHUD label="MYMYON · #OOTD · LIVE" />

      <Sequence from={0} durationInFrames={90}><SceneHook /></Sequence>
      <Sequence from={80} durationInFrames={300}><SceneRankingZoom /></Sequence>
      <Sequence from={370} durationInFrames={240}><SceneMusicShare /></Sequence>
      <Sequence from={600} durationInFrames={300}><SceneShowroom /></Sequence>
    </AbsoluteFill>
  );
};

const SceneHook: React.FC = () => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [60, 90], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ padding: 120, justifyContent: "center", opacity: o }}>
      <MonoLabel text="02 · MYMYON OOTD" color={theme.accent} />
      <div style={{ marginTop: 28 }}>
        <TypeReveal text="Today's fit." size={150} weight={700} />
      </div>
      <div style={{ marginTop: 12 }}>
        <TypeReveal text="Your stage." size={150} italic color={theme.accent2} delay={10} />
      </div>
    </AbsoluteFill>
  );
};

const SceneRankingZoom: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 18 } });
  const browserY = interpolate(enter, [0, 1], [60, 0]);

  // camera: open wide → push into Top 1 chanel image
  const camKeys = [
    { at: 0, scale: 1, x: 0, y: 0 },
    { at: 90, scale: 1, x: 0, y: 0 },
    { at: 160, scale: 1.7, x: 100, y: -60 },
    { at: 230, scale: 1.7, x: 100, y: -60 },
    { at: 280, scale: 1, x: 0, y: 0 },
  ];

  // cursor: from left to RANKING tab, click; then to #1 card, click
  const cursorPath = [
    { x: 100, y: 700, at: 0 },
    { x: 332, y: 268, at: 40 },
    { x: 332, y: 268, at: 50, click: true },
    { x: 460, y: 530, at: 130 },
    { x: 460, y: 530, at: 145, click: true },
  ];

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <Camera keys={camKeys}>
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
          <div style={{ transform: `translateY(${browserY}px)`, opacity: enter, position: "relative" }}>
            <BrowserFrame
              src="images/ootd-desktop.png"
              width={1366}
              height={768}
              url="mymyon.com/ootd"
              scale={0.85}
              glow={theme.accent}
            />
            <div style={{ position: "absolute", inset: 0, transform: "scale(0.85)", transformOrigin: "center center" }}>
              <div style={{ position: "absolute", top: 44, left: 0, width: 1366, height: 768, pointerEvents: "none" }}>
                <Cursor path={cursorPath} color={theme.accent} />
                {frame > 155 && frame < 240 && (
                  <ZoomHighlight
                    x={250}
                    y={300}
                    w={425}
                    h={460}
                    color={theme.accent}
                    opacity={interpolate(frame, [155, 175, 230, 240], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
                  />
                )}
              </div>
            </div>
          </div>
        </AbsoluteFill>
      </Camera>

      <div style={{ position: "absolute", bottom: 60, left: 120, right: 120, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <MonoLabel text="WEEKLY · CROWNED BOARD" delay={10} />
          <div style={{ marginTop: 12, fontSize: 38, fontWeight: 600 }}>
            Top fits, <span style={{ color: theme.accent, fontStyle: "italic" }}>star-ranked.</span>
          </div>
        </div>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, letterSpacing: 4, color: theme.inkDim }}>
          3 STARS · DAILY
        </div>
      </div>
    </AbsoluteFill>
  );
};

const SceneMusicShare: React.FC = () => {
  const frame = useCurrentFrame();
  const bars = 22;
  const messages = [
    { who: "Yuna", txt: "이 핏 너무 좋다 🔥", side: "left", at: 30 },
    { who: "You", txt: "got the M, perfect", side: "right", at: 60 },
    { who: "Min", txt: "drop the link!!", side: "left", at: 95 },
  ];
  return (
    <AbsoluteFill style={{ padding: 100, flexDirection: "row", gap: 70, alignItems: "center" }}>
      {/* left: chat */}
      <div style={{ flex: 1 }}>
        <MonoLabel text="03 · SHARE WITH YOUR CIRCLE" />
        <div style={{ marginTop: 22 }}>
          <TypeReveal text="Friends. Reactions." size={64} delay={6} />
        </div>
        <div style={{ marginTop: 6 }}>
          <TypeReveal text="Real time." size={64} italic color={theme.accent} delay={16} />
        </div>
        <div style={{ marginTop: 50, display: "flex", flexDirection: "column", gap: 14, maxWidth: 540 }}>
          {messages.map((m, i) => {
            const f = frame - m.at;
            const o = interpolate(f, [0, 16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
            const x = interpolate(f, [0, 16], [m.side === "left" ? -40 : 40, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
            const isMe = m.side === "right";
            return (
              <div
                key={i}
                style={{
                  alignSelf: isMe ? "flex-end" : "flex-start",
                  opacity: o,
                  transform: `translateX(${x}px)`,
                  padding: "14px 22px",
                  borderRadius: 22,
                  background: isMe ? theme.accent : "rgba(255,255,255,0.08)",
                  color: isMe ? "#fff" : theme.ink,
                  fontSize: 20,
                  fontWeight: 500,
                  maxWidth: 380,
                  boxShadow: isMe ? `0 8px 30px ${theme.accent}55` : "none",
                }}
              >
                <div style={{ fontSize: 10, letterSpacing: 3, opacity: 0.7, marginBottom: 4, fontFamily: "'JetBrains Mono', monospace" }}>
                  {m.who.toUpperCase()}
                </div>
                {m.txt}
              </div>
            );
          })}
        </div>
      </div>
      {/* right: music */}
      <div style={{ flex: "0 0 540px" }}>
        <MonoLabel text="SOUNDTRACK" color={theme.accent2} />
        <div style={{ marginTop: 22 }}>
          <TypeReveal text="Your fit," size={56} delay={6} />
        </div>
        <div style={{ marginTop: 4 }}>
          <TypeReveal text="your beat." size={56} italic color={theme.accent2} delay={14} />
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 7, marginTop: 50, height: 160 }}>
          {Array.from({ length: bars }).map((_, i) => {
            const phase = (frame + i * 6) * 0.18;
            const h = 25 + Math.abs(Math.sin(phase)) * 130 + Math.abs(Math.cos(phase * 1.3)) * 30;
            const o = interpolate(frame, [30 + i * 2, 60 + i * 2], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
            return (
              <div key={i} style={{ width: 12, height: h, opacity: o, background: `linear-gradient(180deg, ${theme.accent}, ${theme.accent2})`, borderRadius: 6, boxShadow: `0 0 18px ${theme.accent}55` }} />
            );
          })}
        </div>
        <div style={{ marginTop: 24, opacity: interpolate(frame, [70, 100], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }), fontFamily: "'JetBrains Mono', monospace", fontSize: 13, letterSpacing: 3, color: theme.inkDim }}>
          ♫ NOW PLAYING — MIDNIGHT FIT
        </div>
      </div>
    </AbsoluteFill>
  );
};

const SceneShowroom: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ padding: 120, justifyContent: "center", alignItems: "center" }}>
      <MonoLabel text="04 · YOUR SHOWROOM" color={theme.gold} />
      <div style={{ marginTop: 28, textAlign: "center" }}>
        <TypeReveal text="Build your" size={130} delay={6} />
      </div>
      <div style={{ marginTop: 8 }}>
        <TypeReveal text="universe." size={150} italic color={theme.accent} delay={18} />
      </div>
      <div style={{ display: "flex", gap: 18, marginTop: 60 }}>
        {[0, 1, 2, 3, 4].map((i) => {
          const f = frame - 60 - i * 8;
          const s = spring({ frame: f, fps, config: { damping: 14 } });
          const colors = [theme.accent, theme.accent2, theme.gold, "#A78BFA", "#F87171"];
          return (
            <div
              key={i}
              style={{
                width: 130,
                height: 170,
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
      <div style={{ marginTop: 60, opacity: interpolate(frame, [180, 220], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }), fontSize: 18, fontFamily: "'JetBrains Mono', monospace", letterSpacing: 8, color: theme.inkDim }}>
        MYMYON · OOTD
      </div>
    </AbsoluteFill>
  );
};
