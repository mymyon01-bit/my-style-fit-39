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
      theme === "leaves" ? 48  :
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

        {/* Subtle window beads — viewer is at a window with cherry trees outside */}
        <WindowDroplets density={14} intensity={0.7} />

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

        {/* Heavy window beads — viewer is inside, storm hammering the glass */}
        <WindowDroplets density={36} intensity={1.4} />

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
          @keyframes ootd-cloud-drift {
            from { transform: translateX(0); }
            to   { transform: translateX(calc(110vw + 600px)); }
          }
        `}</style>
      </div>
    );
  }

  // ── Soft rain: calm overcast clouds + steady gentle rain ───────────────
  if (theme === "rain") {
    return (
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        {/* Overcast sky */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, #b9c4d2 0%, #ccd4de 50%, #dde2e9 100%)",
          }}
        />
        {/* Calm drifting clouds */}
        <SoftCloud top="6%"  left="-12%" size={360} delay={0}  duration={180} opacity={0.85} tint="#9aa6b6" />
        <SoftCloud top="14%" left="35%"  size={420} delay={25} duration={200} opacity={0.78} tint="#8d99ab" />
        <SoftCloud top="22%" left="70%"  size={340} delay={10} duration={170} opacity={0.82} tint="#94a0b1" />
        <SoftCloud top="32%" left="10%"  size={300} delay={50} duration={190} opacity={0.7}  tint="#a3afc0" />
        {/* Gentle rain */}
        {particles.map((p) => (
          <span
            key={p.id}
            className="absolute block"
            style={{
              left: `${p.left}%`,
              top: "-10%",
              width: "1px",
              height: `${10 + p.size * 6}px`,
              background: "linear-gradient(to bottom, transparent, rgba(120, 145, 175, 0.65))",
              transform: "rotate(8deg)",
              animation: `ootd-rain-soft ${1 + p.duration / 8}s linear ${p.delay}s infinite`,
            }}
          />
        ))}

        {/* Window beads — soft rain seen from inside */}
        <WindowDroplets density={22} intensity={1} />

        <style>{`
          @keyframes ootd-rain-soft {
            0%   { transform: translate3d(0, 0, 0) rotate(8deg); opacity: 0; }
            15%  { opacity: 0.7; }
            100% { transform: translate3d(-12vh, 110vh, 0) rotate(8deg); opacity: 0; }
          }
          @keyframes ootd-cloud-drift {
            from { transform: translateX(0); }
            to   { transform: translateX(calc(110vw + 600px)); }
          }
        `}</style>
      </div>
    );
  }

  // ── Autumn leaves: amber sky + maple trees on both sides + falling leaves
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(255, 195, 130, 0.40) 0%, rgba(255, 220, 170, 0.20) 50%, rgba(180, 100, 50, 0.12) 100%)",
        }}
      />
      <AutumnTree side="left" />
      <AutumnTree side="right" />
      {particles.map((p) => (
        <span
          key={p.id}
          className="absolute block"
          style={{
            left: `${p.left}%`,
            top: "-10%",
            fontSize: `${p.size * 16}px`,
            color: "rgba(232, 188, 55, 0.95)",
            filter: "drop-shadow(0 1px 2px rgba(120,80,20,0.3))",
            animation: `ootd-leaf-fall ${p.duration}s linear ${p.delay}s infinite`,
            // @ts-ignore
            "--drift": `${p.drift}px`,
            "--rot": `${p.rot}deg`,
          } as any}
        >
          {p.id % 3 === 0 ? "🍁" : "🍂"}
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
// Soft cloud — translucent blob that drifts across the sky. Used by sunny
// + rain themes. `tint` controls the cloud's base color.
// ────────────────────────────────────────────────────────────────────────
function SoftCloud({
  top,
  left,
  size,
  delay,
  duration,
  opacity,
  tint = "#ffffff",
}: {
  top: string;
  left: string;
  size: number;
  delay: number;
  duration: number;
  opacity: number;
  tint?: string;
}) {
  return (
    <div
      className="absolute"
      style={{
        top,
        left,
        width: `${size}px`,
        height: `${size * 0.5}px`,
        opacity,
        filter: "blur(22px)",
        animation: `ootd-cloud-drift ${duration}s linear ${delay}s infinite`,
      }}
    >
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `radial-gradient(ellipse at 50% 55%, ${tint} 0%, ${tint}aa 35%, transparent 75%)`,
        }}
      />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Autumn tree — silhouette with amber/red canopy on left or right edge.
// ────────────────────────────────────────────────────────────────────────
function AutumnTree({ side }: { side: "left" | "right" }) {
  const isLeft = side === "left";
  return (
    <div
      className="absolute bottom-0 h-full pointer-events-none"
      style={{
        [isLeft ? "left" : "right"]: "-60px",
        width: "380px",
        transformOrigin: isLeft ? "bottom left" : "bottom right",
        animation: "ootd-tree-sway 7s ease-in-out infinite",
      } as any}
    >
      <svg
        viewBox="0 0 380 800"
        className="absolute bottom-0 h-full w-full"
        style={{ transform: isLeft ? "none" : "scaleX(-1)" }}
        preserveAspectRatio="xMinYMax meet"
      >
        {/* Trunk — thicker, taller */}
        <path
          d="M 50 800 C 60 680, 75 560, 95 460 C 115 380, 140 300, 170 240 L 200 240 C 165 300, 145 380, 130 460 C 115 560, 105 680, 95 800 Z"
          fill="#2e1d0f"
        />
        {/* Branches — more, wider spread */}
        <path d="M 120 410 C 170 370, 230 330, 295 290" stroke="#2e1d0f" strokeWidth="11" fill="none" strokeLinecap="round" />
        <path d="M 140 330 C 185 305, 235 270, 290 220" stroke="#2e1d0f" strokeWidth="9" fill="none" strokeLinecap="round" />
        <path d="M 160 260 C 200 235, 250 195, 305 150" stroke="#2e1d0f" strokeWidth="7" fill="none" strokeLinecap="round" />
        <path d="M 110 480 C 70 450, 35 410, 10 370" stroke="#2e1d0f" strokeWidth="9" fill="none" strokeLinecap="round" />
        <path d="M 130 380 C 95 355, 55 320, 25 280" stroke="#2e1d0f" strokeWidth="7" fill="none" strokeLinecap="round" />

        {/* Yellow/gold foliage — big lush canopy */}
        {[
          { cx: 100, cy: 320, r: 85, c: "rgba(212, 165, 40, 0.92)" },
          { cx: 175, cy: 260, r: 100, c: "rgba(232, 188, 55, 0.92)" },
          { cx: 250, cy: 230, r: 80, c: "rgba(200, 150, 30, 0.92)" },
          { cx: 220, cy: 320, r: 95, c: "rgba(240, 200, 70, 0.92)" },
          { cx: 295, cy: 290, r: 70, c: "rgba(190, 140, 25, 0.92)" },
          { cx: 130, cy: 200, r: 75, c: "rgba(225, 180, 60, 0.92)" },
          { cx: 200, cy: 165, r: 80, c: "rgba(210, 160, 40, 0.92)" },
          { cx: 280, cy: 140, r: 70, c: "rgba(238, 195, 75, 0.92)" },
          { cx: 165, cy: 380, r: 80, c: "rgba(195, 145, 30, 0.92)" },
          { cx: 260, cy: 380, r: 75, c: "rgba(225, 175, 55, 0.92)" },
          { cx: 60, cy: 380, r: 65, c: "rgba(205, 155, 35, 0.92)" },
          { cx: 35, cy: 320, r: 55, c: "rgba(220, 170, 50, 0.92)" },
        ].map((c, i) => (
          <circle key={i} cx={c.cx} cy={c.cy} r={c.r} fill={c.c} />
        ))}
        {/* Bright golden highlight leaves */}
        {[
          { cx: 175, cy: 240, r: 30, c: "rgba(255, 225, 110, 0.98)" },
          { cx: 240, cy: 280, r: 26, c: "rgba(255, 215, 95, 0.98)" },
          { cx: 130, cy: 290, r: 22, c: "rgba(255, 210, 90, 0.98)" },
          { cx: 270, cy: 200, r: 20, c: "rgba(255, 230, 130, 0.98)" },
          { cx: 200, cy: 360, r: 25, c: "rgba(255, 220, 100, 0.98)" },
          { cx: 90, cy: 350, r: 18, c: "rgba(255, 218, 105, 0.98)" },
          { cx: 220, cy: 180, r: 16, c: "rgba(255, 235, 140, 0.98)" },
        ].map((c, i) => (
          <circle key={`h-${i}`} cx={c.cx} cy={c.cy} r={c.r} fill={c.c} />
        ))}
      </svg>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Window droplets — fixed beads of "water" sitting on an invisible window
// pane. Used by rain, storm, and (lightly) sakura to suggest the viewer
// is looking outside through glass. Each droplet has a tiny highlight to
// fake refraction and a slow downward "trail" so it feels alive.
// ────────────────────────────────────────────────────────────────────────
function WindowDroplets({ density = 22, intensity = 1 }: { density?: number; intensity?: number }) {
  const beads = Array.from({ length: density }).map((_, i) => ({
    id: i,
    left: Math.random() * 100,
    top: Math.random() * 100,
    size: 6 + Math.random() * 18 * intensity,
    delay: Math.random() * 10,
    duration: 8 + Math.random() * 14,
    trail: 30 + Math.random() * 80,
  }));
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {beads.map((b) => (
        <span
          key={b.id}
          className="absolute"
          style={{
            left: `${b.left}%`,
            top: `${b.top}%`,
            width: `${b.size}px`,
            height: `${b.size}px`,
            borderRadius: "50%",
            background:
              "radial-gradient(circle at 35% 30%, rgba(255,255,255,0.85) 0%, rgba(220,235,250,0.55) 25%, rgba(180,200,225,0.30) 60%, transparent 80%)",
            boxShadow:
              "inset -1px -2px 3px rgba(80,100,130,0.35), 0 1px 2px rgba(255,255,255,0.4)",
            animation: `ootd-droplet-slide ${b.duration}s ease-in ${b.delay}s infinite`,
            // @ts-ignore
            "--trail": `${b.trail}px`,
          } as any}
        />
      ))}
      <style>{`
        @keyframes ootd-droplet-slide {
          0%, 60% { transform: translateY(0); opacity: 0.95; }
          80% { transform: translateY(calc(var(--trail) * 0.4)); opacity: 0.85; }
          100% { transform: translateY(var(--trail)); opacity: 0; }
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

  // Dense cluster of blossom puffs — multiple shades layered for depth.
  // Spread wide across the canvas so the canopy reads as a real, full
  // sakura tree in bloom rather than a few floating blobs.
  const canopyBase = [
    // outer hazy halo (palest)
    { cx: 80,  cy: 320, r: 78, fill: "rgba(255, 215, 230, 0.55)" },
    { cx: 150, cy: 250, r: 95, fill: "rgba(255, 215, 230, 0.55)" },
    { cx: 230, cy: 230, r: 82, fill: "rgba(255, 215, 230, 0.55)" },
    { cx: 300, cy: 280, r: 70, fill: "rgba(255, 215, 230, 0.55)" },
    { cx: 200, cy: 350, r: 88, fill: "rgba(255, 215, 230, 0.5)" },
    { cx: 110, cy: 410, r: 65, fill: "rgba(255, 215, 230, 0.5)" },
    // mid pink layer
    { cx: 95,  cy: 310, r: 56, fill: "rgba(255, 183, 210, 0.85)" },
    { cx: 145, cy: 260, r: 70, fill: "rgba(255, 183, 210, 0.88)" },
    { cx: 200, cy: 220, r: 62, fill: "rgba(255, 183, 210, 0.88)" },
    { cx: 250, cy: 250, r: 58, fill: "rgba(255, 183, 210, 0.85)" },
    { cx: 290, cy: 295, r: 50, fill: "rgba(255, 183, 210, 0.82)" },
    { cx: 175, cy: 320, r: 60, fill: "rgba(255, 183, 210, 0.88)" },
    { cx: 225, cy: 335, r: 55, fill: "rgba(255, 183, 210, 0.85)" },
    { cx: 120, cy: 380, r: 50, fill: "rgba(255, 183, 210, 0.82)" },
    { cx: 75,  cy: 380, r: 42, fill: "rgba(255, 183, 210, 0.78)" },
    { cx: 165, cy: 175, r: 45, fill: "rgba(255, 183, 210, 0.82)" },
    { cx: 230, cy: 165, r: 42, fill: "rgba(255, 183, 210, 0.82)" },
    { cx: 270, cy: 200, r: 40, fill: "rgba(255, 183, 210, 0.8)" },
    // brighter top highlights
    { cx: 130, cy: 230, r: 28, fill: "rgba(255, 210, 225, 0.95)" },
    { cx: 185, cy: 270, r: 24, fill: "rgba(255, 210, 225, 0.95)" },
    { cx: 110, cy: 290, r: 22, fill: "rgba(255, 220, 230, 0.95)" },
    { cx: 215, cy: 200, r: 20, fill: "rgba(255, 220, 230, 0.95)" },
    { cx: 250, cy: 285, r: 22, fill: "rgba(255, 220, 230, 0.95)" },
    { cx: 160, cy: 305, r: 20, fill: "rgba(255, 225, 235, 0.95)" },
    { cx: 270, cy: 230, r: 16, fill: "rgba(255, 230, 240, 0.95)" },
    { cx: 195, cy: 175, r: 16, fill: "rgba(255, 230, 240, 0.92)" },
  ];

  // Small individual five-petal blossoms scattered on top for that
  // "흐드러지게 핀" feeling — they read as actual flowers, not just blobs.
  const flowers = [
    { cx: 90,  cy: 270, s: 1.0 },
    { cx: 130, cy: 200, s: 0.9 },
    { cx: 175, cy: 240, s: 1.1 },
    { cx: 220, cy: 195, s: 0.95 },
    { cx: 250, cy: 260, s: 1.0 },
    { cx: 280, cy: 220, s: 0.85 },
    { cx: 105, cy: 360, s: 1.0 },
    { cx: 160, cy: 350, s: 0.9 },
    { cx: 210, cy: 305, s: 1.05 },
    { cx: 270, cy: 320, s: 0.95 },
    { cx: 75,  cy: 340, s: 0.8 },
    { cx: 145, cy: 290, s: 0.9 },
    { cx: 195, cy: 380, s: 0.95 },
    { cx: 240, cy: 175, s: 0.8 },
    { cx: 120, cy: 245, s: 0.85 },
    { cx: 295, cy: 255, s: 0.85 },
  ];

  return (
    <div
      className="absolute bottom-0 h-full pointer-events-none"
      style={{
        [isLeft ? "left" : "right"]: "-60px",
        width: "360px",
        transformOrigin: isLeft ? "bottom left" : "bottom right",
        animation: "ootd-tree-sway 6s ease-in-out infinite",
      } as any}
    >
      <svg
        viewBox="0 0 360 720"
        className="absolute bottom-0 h-full w-full"
        style={{ transform: isLeft ? "none" : "scaleX(-1)" }}
        preserveAspectRatio="xMinYMax meet"
      >
        <defs>
          <radialGradient id={`sakura-glow-${side}`} cx="50%" cy="40%" r="60%">
              <stop offset="0%" stopColor="rgba(255,225,235,0.45)" />
              <stop offset="60%" stopColor="rgba(255,200,220,0.18)" />
              <stop offset="100%" stopColor="rgba(255,200,220,0)" />
          </radialGradient>
          <symbol id={`sakura-flower-${side}`} viewBox="-10 -10 20 20">
            {/* Five soft petals around a tiny golden center. */}
            {[0, 72, 144, 216, 288].map((deg, i) => (
              <ellipse
                key={i}
                cx="0"
                cy="-5"
                rx="3.6"
                ry="5.2"
                fill="rgba(255, 200, 220, 0.95)"
                transform={`rotate(${deg})`}
              />
            ))}
            <circle cx="0" cy="0" r="1.4" fill="rgba(255, 220, 120, 0.9)" />
          </symbol>
        </defs>

        {/* Soft halo behind the canopy for atmospheric depth */}
        <ellipse cx="180" cy="280" rx="220" ry="180" fill={`url(#sakura-glow-${side})`} />

        {/* Trunk — taller, fuller silhouette */}
        <path
          d="M 50 720 C 60 620, 75 530, 95 450 C 110 380, 130 310, 155 260 L 175 260 C 150 310, 135 380, 125 450 C 115 530, 100 620, 90 720 Z"
          fill="#3a2818"
        />

        {/* Main branches reaching wide across the canvas */}
        <path d="M 110 380 C 150 350, 200 320, 260 290" stroke="#3a2818" strokeWidth="11" fill="none" strokeLinecap="round" />
        <path d="M 125 310 C 165 285, 215 250, 270 215" stroke="#3a2818" strokeWidth="9" fill="none" strokeLinecap="round" />
        <path d="M 140 250 C 180 225, 225 195, 280 165" stroke="#3a2818" strokeWidth="7" fill="none" strokeLinecap="round" />
        <path d="M 95 430 C 130 415, 175 395, 215 380" stroke="#3a2818" strokeWidth="9" fill="none" strokeLinecap="round" />
        <path d="M 110 350 C 90 340, 70 335, 40 340"   stroke="#3a2818" strokeWidth="7" fill="none" strokeLinecap="round" />
        <path d="M 165 280 C 200 260, 240 230, 290 240" stroke="#3a2818" strokeWidth="6" fill="none" strokeLinecap="round" />

        {/* Twigs — thinner, weaving through the canopy */}
        <path d="M 200 290 C 220 280, 245 270, 265 270" stroke="#3a2818" strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d="M 175 220 C 195 210, 220 200, 240 195" stroke="#3a2818" strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d="M 150 380 C 175 380, 200 385, 220 395" stroke="#3a2818" strokeWidth="3" fill="none" strokeLinecap="round" />

        {/* Blossom canopy — layered puffs */}
        {canopyBase.map((c, i) => (
          <circle key={`b-${i}`} cx={c.cx} cy={c.cy} r={c.r} fill={c.fill} />
        ))}

        {/* Individual five-petal blossoms — sprinkled across the canopy */}
        {flowers.map((f, i) => (
          <use
            key={`f-${i}`}
            href={`#sakura-flower-${side}`}
            x={f.cx - 10 * f.s}
            y={f.cy - 10 * f.s}
            width={20 * f.s}
            height={20 * f.s}
          />
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
