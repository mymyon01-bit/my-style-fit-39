import { Plus, Waves } from "lucide-react";
import { useMyWaves, type Wave } from "@/hooks/useWaves";
import { useAuth } from "@/lib/auth";
import { useNavigate } from "react-router-dom";
import { useI18n } from "@/lib/i18n";

interface WaveBarProps {
  selectedWaveId?: string | null;
  onSelectWave: (waveId: string | null) => void;
  onCreateWave: () => void;
}

/**
 * Story-style row of circular wave avatars.
 * - Owner gets a "surfer" badge (🏄) on a hot ring.
 * - Members get an animated wave glyph on a cool ring.
 * - "All" pill at the start, "+ New" at the end.
 */
export default function WaveBar({ selectedWaveId, onSelectWave, onCreateWave }: WaveBarProps) {
  const { user } = useAuth();
  const { waves, loading } = useMyWaves();
  const { t } = useI18n();
  const navigate = useNavigate();

  if (!user) {
    return (
      <button
        onClick={() => navigate("/auth")}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[hsl(330_85%_60%/0.18)] to-[hsl(252_60%_60%/0.18)] px-4 py-3 text-[12px] font-semibold text-foreground/80 backdrop-blur-md transition hover:from-[hsl(330_85%_60%/0.25)] hover:to-[hsl(252_60%_60%/0.25)]"
      >
        <Waves className="h-4 w-4 text-[hsl(330_85%_60%)]" />
        {t("waveBarSignInPrompt")}
      </button>
    );
  }

  return (
    <div className="scrollbar-hide -mx-2 flex items-start gap-3 overflow-x-auto px-3 py-2">
      {/* All */}
      <StoryItem
        active={!selectedWaveId}
        onClick={() => onSelectWave(null)}
        label={t("waveBarAll")}
        ringClass="ring-foreground/30"
        activeRingClass="ring-foreground"
      >
        <div className="flex h-full w-full items-center justify-center text-[10px] font-bold tracking-wider text-foreground/85">
          ALL
        </div>
      </StoryItem>

      {!loading && waves.map((w) => (
        <WaveStory
          key={w.id}
          wave={w}
          active={selectedWaveId === w.id}
          onClick={() => onSelectWave(w.id)}
        />
      ))}

      {/* New */}
      <StoryItem
        active={false}
        onClick={onCreateWave}
        label={t("waveBarNew")}
        ringClass="ring-dashed ring-foreground/25"
        activeRingClass="ring-foreground/50"
      >
        <div className="flex h-full w-full items-center justify-center bg-foreground/[0.06] text-foreground/60">
          <Plus className="h-5 w-5" />
        </div>
      </StoryItem>
    </div>
  );
}

/** Generic story-circle item */
function StoryItem({
  active, onClick, label, children, ringClass, activeRingClass,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
  ringClass: string;
  activeRingClass: string;
}) {
  return (
    <button
      onClick={onClick}
      className="group flex w-[64px] shrink-0 flex-col items-center gap-1.5"
    >
      <span
        className={`relative inline-flex h-[58px] w-[58px] items-center justify-center rounded-full ring-2 ring-offset-2 ring-offset-background transition ${
          active ? activeRingClass : ringClass
        }`}
      >
        <span className="h-[52px] w-[52px] overflow-hidden rounded-full bg-background">
          {children}
        </span>
      </span>
      <span className="max-w-[64px] truncate text-[10px] font-semibold tracking-wide text-foreground/75">
        {label}
      </span>
    </button>
  );
}

/** Wave story circle — owner = surfer, member = wave glyph */
function WaveStory({ wave, active, onClick }: { wave: Wave; active: boolean; onClick: () => void }) {
  const isOwner = wave.role === "owner";
  // Hot pink/orange ring for owner; cool blue/cyan ring for member
  const ringStyle = isOwner
    ? {
        background:
          "conic-gradient(from 200deg, hsl(330 90% 60%), hsl(20 95% 60%), hsl(280 80% 60%), hsl(330 90% 60%))",
      }
    : {
        background:
          "conic-gradient(from 140deg, hsl(195 90% 60%), hsl(220 85% 65%), hsl(260 70% 60%), hsl(195 90% 60%))",
      };

  return (
    <button
      onClick={onClick}
      title={wave.name}
      className="group flex w-[64px] shrink-0 flex-col items-center gap-1.5"
    >
      <span
        aria-hidden
        className={`relative inline-flex h-[60px] w-[60px] items-center justify-center rounded-full p-[2px] transition ${
          active ? "scale-105 shadow-[0_8px_24px_-8px_hsl(330_85%_60%/0.7)]" : "opacity-95 group-hover:scale-[1.02]"
        }`}
        style={ringStyle}
      >
        <span className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-background ring-2 ring-background">
          {wave.cover_image_url ? (
            <img src={wave.cover_image_url} alt="" className="h-full w-full object-cover" />
          ) : isOwner ? (
            // Surfer emblem
            <span className="text-[24px]" role="img" aria-label="surfer">🏄</span>
          ) : (
            // Stylized wave (SVG)
            <WaveGlyph />
          )}
          {/* Member count chip */}
          <span className="absolute -bottom-0.5 right-0.5 rounded-full bg-background px-1 text-[8px] font-bold text-foreground/70 ring-1 ring-foreground/15">
            {wave.member_count}
          </span>
          {/* Owner crown */}
          {isOwner && (
            <span className="absolute -top-1 left-1/2 -translate-x-1/2 rounded-full bg-[hsl(330_85%_60%)] px-1.5 py-[1px] text-[7.5px] font-bold uppercase tracking-wider text-white shadow">
              SURFER
            </span>
          )}
        </span>
      </span>
      <span
        className={`max-w-[68px] truncate text-[10px] font-semibold tracking-wide ${
          active ? "text-foreground" : "text-foreground/75"
        }`}
      >
        {wave.name}
      </span>
    </button>
  );
}

/** Decorative animated wave SVG used when no cover image */
function WaveGlyph() {
  return (
    <svg
      viewBox="0 0 56 56"
      className="h-full w-full"
      aria-hidden
    >
      <defs>
        <linearGradient id="wg-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="hsl(195 90% 60%)" />
          <stop offset="100%" stopColor="hsl(260 70% 55%)" />
        </linearGradient>
      </defs>
      <rect width="56" height="56" fill="url(#wg-bg)" />
      <path
        d="M0 36 Q 14 24 28 36 T 56 36 V56 H0 Z"
        fill="rgba(255,255,255,0.35)"
      />
      <path
        d="M0 42 Q 14 32 28 42 T 56 42 V56 H0 Z"
        fill="rgba(255,255,255,0.55)"
      />
      <path
        d="M0 48 Q 14 40 28 48 T 56 48 V56 H0 Z"
        fill="rgba(255,255,255,0.85)"
      />
    </svg>
  );
}
