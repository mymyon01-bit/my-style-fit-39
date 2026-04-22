import { useMemo } from "react";

/**
 * Decorative animated background themes for the OOTD post detail modal.
 * Each theme is a self-contained absolute-positioned overlay that sits
 * behind the modal content but above the dim backdrop.
 *
 * Themes stay subtle — they enhance the post, never compete with it.
 */
export type PostTheme =
  | "clear"
  | "stars"
  | "snow"
  | "neon"
  | "sunburst"
  | "sparkle";

export const POST_THEMES: { id: PostTheme; label: string; emoji: string }[] = [
  { id: "clear", label: "Clear", emoji: "○" },
  { id: "stars", label: "Falling stars", emoji: "✦" },
  { id: "snow", label: "Snow", emoji: "❄" },
  { id: "neon", label: "Neon", emoji: "⚡" },
  { id: "sunburst", label: "Sunburst", emoji: "☀" },
  { id: "sparkle", label: "Sparkle", emoji: "✨" },
];

export default function PostThemeBackground({ theme }: { theme: PostTheme }) {
  // Pre-compute random particle positions once per mount (per theme).
  const particles = useMemo(() => {
    const count =
      theme === "snow" ? 36 :
      theme === "stars" ? 22 :
      theme === "sparkle" ? 28 : 0;
    return Array.from({ length: count }).map((_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 6,
      duration: 4 + Math.random() * 6,
      size: 0.5 + Math.random() * 1.5,
      drift: (Math.random() - 0.5) * 30,
    }));
  }, [theme]);

  if (theme === "clear") return null;

  if (theme === "neon") {
    return (
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
        <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-500/10 via-transparent to-cyan-400/10" />
        <div className="absolute -inset-px rounded-2xl ring-1 ring-fuchsia-400/30 [box-shadow:inset_0_0_60px_-10px_hsl(322_95%_56%/0.45),inset_0_0_120px_-30px_hsl(188_92%_50%/0.35)]" />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-fuchsia-400/80 to-transparent animate-[neon-scan_4s_linear_infinite]" />
        <style>{`
          @keyframes neon-scan {
            0% { transform: translateY(0); opacity: 0.9; }
            50% { opacity: 0.4; }
            100% { transform: translateY(85vh); opacity: 0.9; }
          }
        `}</style>
      </div>
    );
  }

  if (theme === "sunburst") {
    return (
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
        <div
          className="absolute -top-1/3 left-1/2 h-[140%] w-[140%] -translate-x-1/2 opacity-60"
          style={{
            background:
              "conic-gradient(from 0deg, transparent 0deg, hsl(38 95% 70% / 0.18) 6deg, transparent 12deg, transparent 30deg, hsl(38 95% 70% / 0.14) 36deg, transparent 42deg, transparent 60deg, hsl(38 95% 70% / 0.18) 66deg, transparent 72deg, transparent 360deg)",
            animation: "sun-rotate 60s linear infinite",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-amber-200/25 via-transparent to-transparent" />
        <style>{`
          @keyframes sun-rotate { to { transform: translateX(-50%) rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  // Particle-based themes (snow / stars / sparkle)
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
      {particles.map((p) => (
        <span
          key={p.id}
          className="absolute top-[-10%] block"
          style={{
            left: `${p.left}%`,
            fontSize: `${p.size * (theme === "snow" ? 14 : 12)}px`,
            color:
              theme === "snow"
                ? "rgba(255,255,255,0.85)"
                : theme === "stars"
                ? "hsl(var(--star) / 0.85)"
                : "hsl(var(--accent) / 0.7)",
            animation: `particle-fall ${p.duration}s linear ${p.delay}s infinite`,
            // @ts-ignore — custom property
            "--drift": `${p.drift}px`,
          } as any}
        >
          {theme === "snow" ? "❄" : theme === "stars" ? "✦" : "✧"}
        </span>
      ))}
      <style>{`
        @keyframes particle-fall {
          0%   { transform: translate3d(0, 0, 0) rotate(0deg); opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { transform: translate3d(var(--drift), 110vh, 0) rotate(360deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

const STORAGE_KEY = "wardrobe-post-theme";

export function loadSavedPostTheme(): PostTheme {
  if (typeof window === "undefined") return "clear";
  const v = localStorage.getItem(STORAGE_KEY) as PostTheme | null;
  return v || "clear";
}

export function savePostTheme(theme: PostTheme) {
  try { localStorage.setItem(STORAGE_KEY, theme); } catch {}
}
