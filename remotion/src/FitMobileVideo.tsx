import React from "react";
import { AbsoluteFill, Sequence, Img, staticFile, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { theme } from "./theme";
import { Grid, Vignette, CornerHUD } from "./components/Grid";
import { TypeReveal, MonoLabel } from "./components/TypeReveal";
import { Phone } from "./components/DeviceFrame";

// MYMYON FIT — 15s mobile ad. 1080x1920 @ 30fps = 450 frames.
// Beat map:
//  00-60   Logo reveal (drip / glow)
//  60-150  Hook: "Will it fit?" — body + product
//  150-240 AI scan + body data
//  240-375 Try-on result reveal on phone
//  375-450 Lockup / outro
export const FitMobileVideo: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: theme.bg, color: theme.ink, fontFamily: "'Inter', sans-serif", overflow: "hidden" }}>
      <BgGradient />
      <Grid />
      <Vignette />
      <CornerHUD label="MYMYON · FIT" />

      <Sequence from={0} durationInFrames={75}><SceneLogo /></Sequence>
      <Sequence from={60} durationInFrames={100}><SceneHook /></Sequence>
      <Sequence from={150} durationInFrames={100}><SceneScan /></Sequence>
      <Sequence from={240} durationInFrames={140}><SceneResult /></Sequence>
      <Sequence from={375} durationInFrames={75}><SceneOutro /></Sequence>
    </AbsoluteFill>
  );
};

const BgGradient: React.FC = () => {
  const frame = useCurrentFrame();
  const a = interpolate(frame, [0, 450], [0, 1]);
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(120% 80% at ${30 + a * 40}% ${20 + a * 60}%, ${theme.accent}22, transparent 60%), radial-gradient(100% 70% at ${70 - a * 30}% 80%, ${theme.accent2}1f, transparent 65%)`,
      }}
    />
  );
};

// ---------- Scene 1: Logo ----------
const SceneLogo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 14, stiffness: 120 } });
  const logoScale = interpolate(s, [0, 1], [0.6, 1]);
  const logoY = interpolate(s, [0, 1], [80, 0]);
  const out = interpolate(frame, [55, 75], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const drip = interpolate(frame, [10, 50], [0, 220], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const glow = interpolate(frame, [0, 30, 55, 75], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: out }}>
      <div style={{ position: "absolute", top: "38%", transform: `translateY(${logoY}px) scale(${logoScale})`, filter: `drop-shadow(0 0 ${60 * glow}px ${theme.accent})` }}>
        <Img src={staticFile("images/mymyon-logo.png")} style={{ width: 520, height: "auto" }} />
      </div>
      {/* drip */}
      <div
        style={{
          position: "absolute",
          top: "calc(38% + 220px)",
          width: 8,
          height: drip,
          background: `linear-gradient(180deg, ${theme.accent}, ${theme.accent2})`,
          borderRadius: 8,
          opacity: 0.9,
          boxShadow: `0 0 24px ${theme.accent2}`,
        }}
      />
      <div style={{ position: "absolute", bottom: 220 }}>
        <MonoLabel text="A.I. FIT ENGINE" delay={20} />
      </div>
    </AbsoluteFill>
  );
};

// ---------- Scene 2: Hook ----------
const SceneHook: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 20 } });
  const out = interpolate(frame, [80, 100], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ padding: 90, justifyContent: "center", opacity: enter * out }}>
      <div style={{ marginTop: -120 }}>
        <MonoLabel text="STILL GUESSING SIZES?" />
      </div>
      <div style={{ marginTop: 24 }}>
        <TypeReveal text="Will it" size={200} weight={700} delay={4} />
      </div>
      <div style={{ marginTop: 4 }}>
        <TypeReveal text="actually fit?" size={200} italic color={theme.accent} delay={14} />
      </div>
      <div style={{ marginTop: 50, fontSize: 42, color: theme.inkDim, fontWeight: 400, opacity: interpolate(frame, [40, 70], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>
        On <span style={{ color: theme.accent2, fontStyle: "italic" }}>your</span> body. Before you buy.
      </div>
    </AbsoluteFill>
  );
};

// ---------- Scene 3: Scan ----------
const SceneScan: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 18 } });
  const out = interpolate(frame, [80, 100], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const scanY = interpolate(frame % 60, [0, 60], [0, 1100]);
  const measurements = [
    { label: "SHOULDER", val: 44.2 },
    { label: "CHEST", val: 96.8 },
    { label: "WAIST", val: 78.4 },
    { label: "HIP", val: 95.1 },
  ];
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "flex-start", paddingTop: 120, opacity: enter * out }}>
      <MonoLabel text="STEP 01 · BODY MAPPED" />
      <div style={{ marginTop: 30, fontFamily: "'Space Grotesk', sans-serif", fontSize: 96, fontWeight: 700, letterSpacing: -2, textAlign: "center", lineHeight: 1 }}>
        2 photos.<br />
        <span style={{ color: theme.accent, fontStyle: "italic" }}>You're mapped.</span>
      </div>
      {/* scan rectangle */}
      <div style={{ position: "relative", marginTop: 50, width: 600, height: 700, borderRadius: 24, border: `2px dashed ${theme.accent2}55`, overflow: "hidden", background: "rgba(255,255,255,0.02)" }}>
        {/* silhouette */}
        <svg viewBox="0 0 200 240" style={{ width: "100%", height: "100%", position: "absolute", inset: 0, padding: 30 }}>
          <path d="M100 30 a22 22 0 1 1 0 .1z M70 60 L130 60 L150 130 L140 200 L120 220 L80 220 L60 200 L50 130 Z" fill={`${theme.accent}55`} stroke={theme.accent} strokeWidth="1" />
        </svg>
        {/* scan line */}
        <div style={{ position: "absolute", left: 0, right: 0, top: scanY * 0.6, height: 4, background: `linear-gradient(90deg, transparent, ${theme.accent2}, transparent)`, boxShadow: `0 0 30px ${theme.accent2}` }} />
      </div>
      {/* measurements */}
      <div style={{ marginTop: 40, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, width: "85%" }}>
        {measurements.map((m, i) => {
          const f = frame - 30 - i * 8;
          const o = interpolate(f, [0, 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const k = interpolate(f, [10, 40], [0, m.val], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return (
            <div key={i} style={{ opacity: o, padding: "18px 24px", border: `1px solid ${theme.grid}`, borderRadius: 16, background: "rgba(255,255,255,0.03)" }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, letterSpacing: 4, color: theme.inkDim }}>{m.label}</div>
              <div style={{ fontSize: 48, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif" }}>
                {k.toFixed(1)}<span style={{ fontSize: 22, color: theme.inkDim, marginLeft: 6 }}>cm</span>
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// ---------- Scene 4: Try-on Result ----------
const SceneResult: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 18 } });
  const out = interpolate(frame, [120, 140], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const phoneY = interpolate(enter, [0, 1], [120, 0]);
  const sizes = ["XS", "S", "M", "L", "XL"];
  const winner = 2;
  const lockFrame = frame - 50;

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: out }}>
      <div style={{ position: "absolute", top: 100, left: 0, right: 0, padding: "0 80px" }}>
        <MonoLabel text="STEP 02 · ON YOUR BODY" />
        <div style={{ marginTop: 14, fontSize: 64, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", letterSpacing: -2 }}>
          See it. <span style={{ color: theme.accent, fontStyle: "italic" }}>On you.</span>
        </div>
      </div>

      <div style={{ transform: `translateY(${phoneY + 60}px)`, opacity: enter, position: "relative" }}>
        <Phone src="images/fit-mobile.png" width={620} glow={theme.accent}>
          {/* fit overlay panels */}
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              padding: "20px 22px 28px",
              background: "linear-gradient(180deg, transparent, rgba(0,0,0,0.7) 30%, rgba(0,0,0,0.92))",
              opacity: interpolate(frame, [40, 70], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
            }}
          >
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, letterSpacing: 4, color: theme.accent2 }}>
              FIT ANALYSIS
            </div>
            <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[
                { k: "SHOULDER", v: "TRUE", c: theme.accent2 },
                { k: "CHEST", v: "RELAXED", c: theme.gold },
                { k: "WAIST", v: "TRUE", c: theme.accent2 },
                { k: "LENGTH", v: "OVERSIZED", c: theme.accent },
              ].map((p, i) => {
                const f = frame - 50 - i * 6;
                const o = interpolate(f, [0, 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
                return (
                  <div key={i} style={{ opacity: o, padding: "8px 12px", borderRadius: 10, background: "rgba(255,255,255,0.06)", border: `1px solid ${p.c}55`, color: "#fff", fontSize: 14 }}>
                    <span style={{ color: theme.inkDim, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: 2, marginRight: 6 }}>{p.k}</span>
                    <span style={{ color: p.c, fontWeight: 700 }}>{p.v}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </Phone>
      </div>

      {/* size strip */}
      <div style={{ position: "absolute", bottom: 180, left: 0, right: 0, display: "flex", gap: 14, justifyContent: "center" }}>
        {sizes.map((s, i) => {
          const f = frame - 70 - i * 6;
          const o = interpolate(f, [0, 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const isWin = i === winner;
          const winScale = interpolate(lockFrame, [40, 60], [1, isWin ? 1.3 : 0.85], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const winOp = isWin ? 1 : interpolate(lockFrame, [40, 60], [1, 0.25], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const showWin = isWin && lockFrame > 45;
          return (
            <div
              key={s}
              style={{
                opacity: o * winOp,
                transform: `scale(${winScale})`,
                width: 96,
                height: 110,
                borderRadius: 16,
                border: `3px solid ${showWin ? theme.accent : theme.grid}`,
                background: showWin ? `${theme.accent}33` : "rgba(255,255,255,0.03)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 48,
                fontWeight: 700,
                fontFamily: "'Space Grotesk', sans-serif",
                color: showWin ? theme.accent : theme.ink,
                boxShadow: showWin ? `0 0 80px ${theme.accent}aa` : "none",
              }}
            >
              {s}
            </div>
          );
        })}
      </div>

      <div style={{ position: "absolute", bottom: 90, opacity: interpolate(frame, [100, 130], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }), fontFamily: "'JetBrains Mono', monospace", fontSize: 20, letterSpacing: 6, color: theme.accent2 }}>
        CONFIDENCE · 94%
      </div>
    </AbsoluteFill>
  );
};

// ---------- Scene 5: Outro ----------
const SceneOutro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 16 } });
  const scale = interpolate(s, [0, 1], [0.7, 1]);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{ transform: `scale(${scale})`, filter: `drop-shadow(0 0 80px ${theme.accent}aa)` }}>
        <Img src={staticFile("images/mymyon-logo.png")} style={{ width: 460, height: "auto" }} />
      </div>
      <div style={{ marginTop: 36, fontFamily: "'Space Grotesk', sans-serif", fontSize: 96, fontWeight: 700, letterSpacing: -3, textAlign: "center" }}>
        Fit. <span style={{ color: theme.accent, fontStyle: "italic" }}>Solved.</span>
      </div>
      <div style={{ marginTop: 30, opacity: interpolate(frame, [25, 50], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }), fontFamily: "'JetBrains Mono', monospace", letterSpacing: 8, color: theme.inkDim, fontSize: 20 }}>
        MYMYON.COM
      </div>
    </AbsoluteFill>
  );
};
