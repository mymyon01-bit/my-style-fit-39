import { useMemo } from "react";

/**
 * Animated decorative background that lives ONLY behind the OOTD tab content.
 * Themed effects are user-selectable from My Page → "My Background".
 *
 * Rendered as a fixed full-viewport layer with `pointer-events-none` so it
 * never interferes with scrolling, taps, or modals. All effects are subtle
 * and respect the dark/light theme by using semantic HSL tokens with low
 * opacity.
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
  { id: "stars",  label: "Falling stars",        emoji: "✦", description: "Gentle stars drifting down" },
  { id: "sakura", label: "Cherry blossoms",      emoji: "🌸", description: "Petals carried on the breeze" },
  { id: "leaves", label: "Autumn leaves",        emoji: "🍂", description: "Leaves swirling in the wind" },
  { id: "sunny",  label: "Sunny day",            emoji: "☀️", description: "Warm sun rays and sparkles" },
  { id: "rain",   label: "Soft rain",            emoji: "🌧️", description: "A quiet, steady rain" },
  { id: "storm",  label: "Thunderstorm",         emoji: "⛈️", description: "Heavy rain with distant lightning" },
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
      theme === "stars"  ? 26 :
      theme === "sakura" ? 30 :
      theme === "leaves" ? 22 :
      theme === "sunny"  ? 18 :
      theme === "rain"   ? 60 :
      theme === "storm"  ? 90 : 0;
    return Array.from({ length: count }).map((_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 8,
      duration: 4 + Math.random() * 8,
      size: 0.6 + Math.random() * 1.6,
      drift: (Math.random() - 0.5) * 60,
      rot: Math.random() * 360,
    }));
  }, [theme]);

  if (theme === "none") return null;

  // ── Sunny day ──────────────────────────────────────────────────────────
  if (theme === "sunny") {
    return (
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-amber-200/15 via-transparent to-transparent" />
        <div
          className="absolute -top-1/3 left-1/2 h-[160%] w-[160%] -translate-x-1/2 opacity-50"
          style={{
            background:
              "conic-gradient(from 0deg, transparent 0deg, hsl(38 95% 70% / 0.10) 6deg, transparent 12deg, transparent 30deg, hsl(38 95% 70% / 0.08) 36deg, transparent 42deg, transparent 60deg, hsl(38 95% 70% / 0.10) 66deg, transparent 72deg, transparent 360deg)",
            animation: "ootd-sun-rotate 80s linear infinite",
          }}
        />
        {particles.map((p) => (
          <span
            key={p.id}
            className="absolute block text-amber-300/70"
            style={{
              left: `${p.left}%`,
              top: `${(p.delay * 7) % 100}%`,
              fontSize: `${p.size * 10}px`,
              animation: `ootd-twinkle ${3 + p.duration / 3}s ease-in-out ${p.delay}s infinite`,
            }}
          >
            ✦
          </span>
        ))}
        <style>{`
          @keyframes ootd-sun-rotate { to { transform: translateX(-50%) rotate(360deg); } }
          @keyframes ootd-twinkle {
            0%, 100% { opacity: 0.2; transform: scale(0.8); }
            50% { opacity: 0.9; transform: scale(1.1); }
          }
        `}</style>
      </div>
    );
  }

  // ── Storm (rain + lightning flashes) ───────────────────────────────────
  if (theme === "storm") {
    return (
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900/20 via-transparent to-slate-900/30" />
        <div className="absolute inset-0 bg-white/0 animate-[ootd-lightning_7s_linear_infinite]" />
        {particles.map((p) => (
          <span
            key={p.id}
            className="absolute block bg-gradient-to-b from-transparent via-sky-200/70 to-sky-100/90"
            style={{
              left: `${p.left}%`,
              top: "-10%",
              width: "1.5px",
              height: `${14 + p.size * 10}px`,
              transform: "rotate(12deg)",
              animation: `ootd-rain ${0.6 + p.duration / 12}s linear ${p.delay / 2}s infinite`,
            }}
          />
        ))}
        <style>{`
          @keyframes ootd-rain {
            0%   { transform: translate3d(0, 0, 0) rotate(12deg); opacity: 0; }
            10%  { opacity: 0.85; }
            100% { transform: translate3d(-20vh, 110vh, 0) rotate(12deg); opacity: 0; }
          }
          @keyframes ootd-lightning {
            0%, 92%, 100% { background-color: rgba(255,255,255,0); }
            93% { background-color: rgba(255,255,255,0.18); }
            94% { background-color: rgba(255,255,255,0); }
            96% { background-color: rgba(255,255,255,0.12); }
            97% { background-color: rgba(255,255,255,0); }
          }
        `}</style>
      </div>
    );
  }

  // ── Soft rain ──────────────────────────────────────────────────────────
  if (theme === "rain") {
    return (
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-slate-500/5 via-transparent to-slate-500/10" />
        {particles.map((p) => (
          <span
            key={p.id}
            className="absolute block bg-gradient-to-b from-transparent via-sky-300/40 to-sky-200/60"
            style={{
              left: `${p.left}%`,
              top: "-10%",
              width: "1px",
              height: `${10 + p.size * 6}px`,
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

  // ── Particle themes: stars / sakura / leaves ───────────────────────────
  const symbol =
    theme === "stars"  ? "✦" :
    theme === "sakura" ? "🌸" :
    "🍂";

  const tint =
    theme === "stars"  ? "hsl(var(--star) / 0.85)" :
    theme === "sakura" ? "rgba(255, 183, 197, 0.85)" :
    "rgba(214, 138, 73, 0.85)";

  const sizeBase = theme === "stars" ? 11 : 14;

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {particles.map((p) => (
        <span
          key={p.id}
          className="absolute block"
          style={{
            left: `${p.left}%`,
            top: "-10%",
            fontSize: `${p.size * sizeBase}px`,
            color: tint,
            animation: `ootd-fall ${p.duration}s linear ${p.delay}s infinite`,
            // @ts-ignore — custom properties consumed by the keyframes below
            "--drift": `${p.drift}px`,
            "--rot": `${p.rot}deg`,
          } as any}
        >
          {symbol}
        </span>
      ))}
      <style>{`
        @keyframes ootd-fall {
          0%   { transform: translate3d(0, 0, 0) rotate(var(--rot)); opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { transform: translate3d(var(--drift), 110vh, 0) rotate(calc(var(--rot) + 540deg)); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
