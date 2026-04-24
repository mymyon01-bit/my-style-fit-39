import { useMemo } from "react";

/**
 * Animated decorative background that lives ONLY behind the OOTD tab content.
 * Themed effects are user-selectable from My Page → "My Background".
 *
 * Each theme is a self-contained "scene" — it owns its colors, gradients,
 * particles, and signature flourishes (e.g. cherry trees, storm clouds).
 * Rendered as a fixed full-viewport layer with `pointer-events-none` so it
 * never interferes with scrolling, taps, or modals.
 */
export type OOTDBgTheme =
  | "none"
  | "stars"
  | "sakura"
  | "leaves"
  | "sunny"
  | "rain"
  | "storm";

export const OOTD_BG_THEMES: { id: OOTDBgTheme; label: string; emoji: string; description: string }[] = [
  { id: "none",   label: "None",                 emoji: "○", description: "Clean — no background effect" },
  { id: "stars",  label: "Cosmic stars",         emoji: "✦", description: "A deep-space night sky" },
  { id: "sakura", label: "Cherry blossoms",      emoji: "🌸", description: "Petals drifting between trees" },
  { id: "leaves", label: "Autumn leaves",        emoji: "🍂", description: "Leaves swirling in the wind" },
  { id: "sunny",  label: "Sunny day",            emoji: "☀️", description: "Warm sun rays and sparkles" },
  { id: "rain",   label: "Soft rain",            emoji: "🌧️", description: "A quiet, steady rain" },
  { id: "storm",  label: "Thunderstorm",         emoji: "⛈️", description: "Storm clouds with lightning" },
];

const STORAGE_KEY = "ootd-bg-theme";

export function loadOOTDBgTheme(): OOTDBgTheme {
  if (typeof window === "undefined") return "none";
  const v = localStorage.getItem(STORAGE_KEY) as OOTDBgTheme | null;
  if (!v) return "none";
  if (OOTD_BG_THEMES.find((t) => t.id === v)) return v;
  return "none";
}

export function saveOOTDBgTheme(theme: OOTDBgTheme) {
  try { localStorage.setItem(STORAGE_KEY, theme); } catch {}
  try { window.dispatchEvent(new CustomEvent("ootd-bg-theme-change", { detail: theme })); } catch {}
}

interface Props {
  theme: OOTDBgTheme;
}

export default function OOTDBackground({ theme }: Props) {
  // Particle counts per theme. Memoized so we don't regenerate on every render.
  const particles = useMemo(() => {
    const count =
      theme === "stars"  ? 140 :
      theme === "sakura" ? 36  :
      theme === "leaves" ? 22  :
      theme === "sunny"  ? 18  :
      theme === "rain"   ? 60  :
      theme === "storm"  ? 110 : 0;
    return Array.from({ length: count }).map((_, i) => ({
      id: i,
      left: Math.random() * 100,
      top: Math.random() * 100,
      delay: Math.random() * 8,
      duration: 4 + Math.random() * 8,
      size: 0.6 + Math.random() * 1.6,
      drift: (Math.random() - 0.5) * 60,
      rot: Math.random() * 360,
    }));
  }, [theme]);

  if (theme === "none") return null;

  // ── Cosmic stars: deep-space sky with twinkling stars + shooting stars ──
  if (theme === "stars") {
    const shooting = [0, 1, 2];
    return (
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        {/* Deep space background — overrides app bg for true cosmic feel */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at 30% 20%, #1a1148 0%, #0a0820 45%, #04030f 100%)",
          }}
        />
        {/* Soft nebula clouds */}
        <div
          className="absolute inset-0 opacity-60"
          style={{
            background:
              "radial-gradient(circle at 75% 60%, rgba(160, 90, 220, 0.25), transparent 45%), radial-gradient(circle at 20% 80%, rgba(80, 140, 220, 0.20), transparent 40%), radial-gradient(circle at 60% 15%, rgba(220, 110, 180, 0.15), transparent 35%)",
          }}
        />
        {/* Twinkling stars */}
        {particles.map((p) => (
          <span
            key={p.id}
            className="absolute block rounded-full bg-white"
            style={{
              left: `${p.left}%`,
              top: `${p.top}%`,
              width: `${p.size * 1.4}px`,
              height: `${p.size * 1.4}px`,
              boxShadow: `0 0 ${p.size * 4}px rgba(255,255,255,0.9)`,
              animation: `ootd-star-twinkle ${2 + p.duration / 2}s ease-in-out ${p.delay}s infinite`,
            }}
          />
        ))}
        {/* Shooting stars */}
        {shooting.map((i) => (
          <span
            key={`shoot-${i}`}
            className="absolute block"
            style={{
              top: `${10 + i * 25}%`,
              left: "-10%",
              width: "120px",
              height: "1.5px",
              background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.95), transparent)",
              filter: "drop-shadow(0 0 4px rgba(180,200,255,0.9))",
              animation: `ootd-shoot ${6 + i * 3}s ease-in ${i * 4}s infinite`,
              transform: "rotate(18deg)",
            }}
          />
        ))}
        <style>{`
          @keyframes ootd-star-twinkle {
            0%, 100% { opacity: 0.3; transform: scale(0.8); }
            50% { opacity: 1; transform: scale(1.2); }
          }
          @keyframes ootd-shoot {
            0%   { transform: translate3d(0, 0, 0) rotate(18deg); opacity: 0; }
            5%   { opacity: 1; }
            40%  { transform: translate3d(120vw, 40vh, 0) rotate(18deg); opacity: 0; }
            100% { transform: translate3d(120vw, 40vh, 0) rotate(18deg); opacity: 0; }
          }
        `}</style>
      </div>
    );
  }

  // ── Sakura: cherry trees on both sides + drifting petals ────────────────
  if (theme === "sakura") {
    return (
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        {/* Soft pink dawn sky */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(255, 226, 234, 0.55) 0%, rgba(255, 240, 245, 0.25) 45%, transparent 100%)",
          }}
        />

        {/* LEFT cherry tree */}
        <CherryTree side="left" />
        {/* RIGHT cherry tree */}
        <CherryTree side="right" />

        {/* Petals drifting across */}
        {particles.map((p) => (
          <span
            key={p.id}
            className="absolute block"
            style={{
              left: `${p.left}%`,
              top: "-10%",
              fontSize: `${p.size * 14}px`,
              color: "rgba(255, 183, 197, 0.95)",
              animation: `ootd-petal-fall ${p.duration + 4}s linear ${p.delay}s infinite`,
              // @ts-ignore
              "--drift": `${p.drift * 1.5}px`,
              "--rot": `${p.rot}deg`,
            } as any}
          >
            🌸
          </span>
        ))}

        <style>{`
          @keyframes ootd-petal-fall {
            0%   { transform: translate3d(0, 0, 0) rotate(var(--rot)); opacity: 0; }
            10%  { opacity: 1; }
            50%  { transform: translate3d(calc(var(--drift) * 0.5), 50vh, 0) rotate(calc(var(--rot) + 220deg)); }
            90%  { opacity: 1; }
            100% { transform: translate3d(var(--drift), 110vh, 0) rotate(calc(var(--rot) + 540deg)); opacity: 0; }
          }
          @keyframes ootd-tree-sway {
            0%, 100% { transform: rotate(-1.2deg); }
            50% { transform: rotate(1.2deg); }
          }
        `}</style>
      </div>
    );
  }

  // ── Storm: dark clouds + heavy rain + lightning flashes ─────────────────
  if (theme === "storm") {
    return (
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        {/* Dark stormy sky */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, #1a1f2e 0%, #2a2f3e 60%, #1f2330 100%)",
          }}
        />

        {/* Storm clouds — drifting blobs in the upper third */}
        <StormCloud top="4%" left="-10%" size={420} delay={0} duration={120} opacity={0.85} />
        <StormCloud top="2%" left="30%" size={520} delay={20} duration={140} opacity={0.92} />
        <StormCloud top="8%" left="60%" size={380} delay={5} duration={110} opacity={0.78} />
        <StormCloud top="14%" left="85%" size={460} delay={35} duration={150} opacity={0.85} />
        <StormCloud top="22%" left="15%" size={340} delay={50} duration={130} opacity={0.65} />

        {/* Lightning flash overlay */}
        <div className="absolute inset-0 animate-[ootd-lightning_6s_linear_infinite]" />

        {/* Lightning bolts — randomly positioned, briefly visible */}
        <Lightning left="22%" delay={2.1} />
        <Lightning left="68%" delay={4.6} />
        <Lightning left="45%" delay={9.2} />

        {/* Heavy rain */}
        {particles.map((p) => (
          <span
            key={p.id}
            className="absolute block"
            style={{
              left: `${p.left}%`,
              top: "-10%",
              width: "1.5px",
              height: `${16 + p.size * 12}px`,
              background: "linear-gradient(to bottom, transparent, rgba(190, 210, 240, 0.85))",
              transform: "rotate(14deg)",
              animation: `ootd-rain-heavy ${0.55 + p.duration / 14}s linear ${p.delay / 2}s infinite`,
            }}
          />
        ))}

        <style>{`
          @keyframes ootd-rain-heavy {
            0%   { transform: translate3d(0, 0, 0) rotate(14deg); opacity: 0; }
            10%  { opacity: 0.9; }
            100% { transform: translate3d(-25vh, 115vh, 0) rotate(14deg); opacity: 0; }
          }
          @keyframes ootd-lightning {
            0%, 88%, 100% { background-color: rgba(255,255,255,0); }
            89% { background-color: rgba(220,230,255,0.28); }
            90% { background-color: rgba(255,255,255,0); }
            91% { background-color: rgba(220,230,255,0.18); }
            92% { background-color: rgba(255,255,255,0); }
            96% { background-color: rgba(220,230,255,0.10); }
            97% { background-color: rgba(255,255,255,0); }
          }
          @keyframes ootd-bolt {
            0%, 96%, 100% { opacity: 0; }
            97% { opacity: 1; }
            98% { opacity: 0.2; }
            99% { opacity: 0.9; }
          }
          @keyframes ootd-cloud-drift {
            from { transform: translateX(0); }
            to   { transform: translateX(calc(110vw + 600px)); }
          }
        `}</style>
      </div>
    );
  }

  // ── Sunny day: blue sky + bright sun with occasional lens flare ────────
  if (theme === "sunny") {
    return (
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        {/* Crisp blue sky */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, #6fb6ec 0%, #a5d2f0 50%, #d8ecf7 100%)",
          }}
        />
        {/* Sun disc — top-right */}
        <div
          className="absolute"
          style={{
            top: "8%",
            right: "10%",
            width: "180px",
            height: "180px",
            borderRadius: "50%",
            background: "radial-gradient(circle, #fff8d8 0%, #ffe890 35%, rgba(255,225,120,0) 70%)",
            filter: "blur(2px)",
            animation: "ootd-sun-pulse 5s ease-in-out infinite",
          }}
        />
        {/* Sun flare — periodic bright burst across the sky */}
        <div
          className="absolute -top-1/3 -right-1/4 h-[160%] w-[140%] opacity-0"
          style={{
            background:
              "conic-gradient(from 200deg at 80% 20%, transparent 0deg, rgba(255, 240, 180, 0.45) 8deg, transparent 18deg, transparent 40deg, rgba(255, 240, 180, 0.30) 50deg, transparent 60deg, transparent 360deg)",
            animation: "ootd-sun-flare 8s ease-in-out infinite",
          }}
        />
        {/* Soft drifting clouds */}
        <SoftCloud top="20%" left="-12%" size={300} delay={0} duration={140} opacity={0.85} />
        <SoftCloud top="38%" left="40%" size={240} delay={20} duration={160} opacity={0.75} />
        <SoftCloud top="55%" left="70%" size={280} delay={40} duration={180} opacity={0.7} />
        {/* Sparkles in the air */}
        {particles.map((p) => (
          <span
            key={p.id}
            className="absolute block"
            style={{
              left: `${p.left}%`,
              top: `${p.top}%`,
              fontSize: `${p.size * 9}px`,
              color: "rgba(255, 250, 200, 0.9)",
              animation: `ootd-twinkle ${3 + p.duration / 3}s ease-in-out ${p.delay}s infinite`,
            }}
          >
            ✦
          </span>
        ))}
        <style>{`
          @keyframes ootd-sun-pulse {
            0%, 100% { transform: scale(1); filter: blur(2px) brightness(1); }
            50% { transform: scale(1.08); filter: blur(2px) brightness(1.15); }
          }
          @keyframes ootd-sun-flare {
            0%, 70%, 100% { opacity: 0; }
            80% { opacity: 0.85; }
            85% { opacity: 0.4; }
            90% { opacity: 0; }
          }
          @keyframes ootd-twinkle {
            0%, 100% { opacity: 0.2; transform: scale(0.8); }
            50% { opacity: 0.95; transform: scale(1.15); }
          }
        `}</style>
      </div>
    );
  }

  // ── Soft rain ──────────────────────────────────────────────────────────
  if (theme === "rain") {
    return (
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(120, 140, 170, 0.18) 0%, transparent 60%, rgba(120, 140, 170, 0.12) 100%)",
          }}
        />
        {particles.map((p) => (
          <span
            key={p.id}
            className="absolute block"
            style={{
              left: `${p.left}%`,
              top: "-10%",
              width: "1px",
              height: `${10 + p.size * 6}px`,
              background: "linear-gradient(to bottom, transparent, rgba(170, 200, 230, 0.6))",
              transform: "rotate(8deg)",
              animation: `ootd-rain-soft ${1 + p.duration / 8}s linear ${p.delay}s infinite`,
            }}
          />
        ))}
        <style>{`
          @keyframes ootd-rain-soft {
            0%   { transform: translate3d(0, 0, 0) rotate(8deg); opacity: 0; }
            15%  { opacity: 0.7; }
            100% { transform: translate3d(-12vh, 110vh, 0) rotate(8deg); opacity: 0; }
          }
        `}</style>
      </div>
    );
  }

  // ── Autumn leaves (default fallthrough) ────────────────────────────────
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(220, 150, 80, 0.18) 0%, transparent 50%, rgba(180, 100, 50, 0.10) 100%)",
        }}
      />
      {particles.map((p) => (
        <span
          key={p.id}
          className="absolute block"
          style={{
            left: `${p.left}%`,
            top: "-10%",
            fontSize: `${p.size * 14}px`,
            color: "rgba(214, 138, 73, 0.9)",
            animation: `ootd-leaf-fall ${p.duration}s linear ${p.delay}s infinite`,
            // @ts-ignore
            "--drift": `${p.drift}px`,
            "--rot": `${p.rot}deg`,
          } as any}
        >
          🍂
        </span>
      ))}
      <style>{`
        @keyframes ootd-leaf-fall {
          0%   { transform: translate3d(0, 0, 0) rotate(var(--rot)); opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { transform: translate3d(var(--drift), 110vh, 0) rotate(calc(var(--rot) + 540deg)); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Sakura tree — silhouette of a trunk with a pink blossom canopy. Anchored
// to the left or right edge of the screen and gently sways.
// ────────────────────────────────────────────────────────────────────────
function CherryTree({ side }: { side: "left" | "right" }) {
  const isLeft = side === "left";
  return (
    <div
      className="absolute bottom-0 h-full pointer-events-none"
      style={{
        [isLeft ? "left" : "right"]: "-40px",
        width: "260px",
        transformOrigin: isLeft ? "bottom left" : "bottom right",
        animation: "ootd-tree-sway 6s ease-in-out infinite",
      } as any}
    >
      <svg
        viewBox="0 0 260 700"
        className="absolute bottom-0 h-full w-full"
        style={{ transform: isLeft ? "none" : "scaleX(-1)" }}
        preserveAspectRatio="xMinYMax meet"
      >
        {/* Trunk + main branches */}
        <path
          d="M 40 700 C 50 600, 60 520, 80 440 C 95 380, 110 320, 130 270 L 145 270 C 125 320, 115 380, 105 440 C 95 520, 85 600, 75 700 Z"
          fill="#3a2818"
        />
        <path
          d="M 95 380 C 130 350, 170 320, 210 290"
          stroke="#3a2818"
          strokeWidth="9"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M 110 310 C 140 290, 175 260, 200 220"
          stroke="#3a2818"
          strokeWidth="7"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M 120 250 C 150 230, 180 200, 210 170"
          stroke="#3a2818"
          strokeWidth="6"
          fill="none"
          strokeLinecap="round"
        />

        {/* Pink blossom canopy — clusters of soft circles */}
        {[
          { cx: 90, cy: 280, r: 60 },
          { cx: 140, cy: 240, r: 70 },
          { cx: 195, cy: 215, r: 55 },
          { cx: 175, cy: 285, r: 65 },
          { cx: 220, cy: 270, r: 50 },
          { cx: 110, cy: 200, r: 50 },
          { cx: 160, cy: 175, r: 55 },
          { cx: 215, cy: 155, r: 50 },
          { cx: 130, cy: 320, r: 55 },
          { cx: 200, cy: 330, r: 50 },
        ].map((c, i) => (
          <circle key={i} cx={c.cx} cy={c.cy} r={c.r} fill="rgba(255, 183, 210, 0.85)" />
        ))}
        {/* Highlight blooms */}
        {[
          { cx: 130, cy: 220, r: 22 },
          { cx: 180, cy: 250, r: 18 },
          { cx: 105, cy: 260, r: 16 },
          { cx: 200, cy: 195, r: 14 },
          { cx: 150, cy: 290, r: 18 },
        ].map((c, i) => (
          <circle key={`h-${i}`} cx={c.cx} cy={c.cy} r={c.r} fill="rgba(255, 220, 230, 0.95)" />
        ))}
      </svg>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Storm cloud — a soft dark blob that drifts slowly across the upper sky.
// ────────────────────────────────────────────────────────────────────────
function StormCloud({
  top,
  left,
  size,
  delay,
  duration,
  opacity,
}: {
  top: string;
  left: string;
  size: number;
  delay: number;
  duration: number;
  opacity: number;
}) {
  return (
    <div
      className="absolute"
      style={{
        top,
        left,
        width: `${size}px`,
        height: `${size * 0.55}px`,
        opacity,
        filter: "blur(18px)",
        animation: `ootd-cloud-drift ${duration}s linear ${delay}s infinite`,
      }}
    >
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background:
            "radial-gradient(ellipse at 50% 60%, #0c1018 0%, #1a2030 40%, transparent 75%)",
        }}
      />
      <div
        className="absolute"
        style={{
          top: "10%",
          left: "20%",
          width: "60%",
          height: "70%",
          borderRadius: "50%",
          background:
            "radial-gradient(ellipse at 50% 50%, #141a28 0%, transparent 70%)",
        }}
      />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Lightning bolt — jagged white line that flashes briefly.
// ────────────────────────────────────────────────────────────────────────
function Lightning({ left, delay }: { left: string; delay: number }) {
  return (
    <svg
      className="absolute"
      style={{
        top: "8%",
        left,
        width: "60px",
        height: "240px",
        filter: "drop-shadow(0 0 12px rgba(200,220,255,0.95))",
        animation: `ootd-bolt 6s linear ${delay}s infinite`,
        opacity: 0,
      }}
      viewBox="0 0 60 240"
    >
      <path
        d="M 30 0 L 14 90 L 28 95 L 10 200 L 38 110 L 24 105 L 44 0 Z"
        fill="rgba(240, 245, 255, 0.95)"
      />
    </svg>
  );
}
