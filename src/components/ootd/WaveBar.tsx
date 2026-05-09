import { useEffect, useState } from "react";
import { Plus, Waves, Crown, Users } from "lucide-react";
import { useMyWaves, fetchPublicWaves, type Wave } from "@/hooks/useWaves";
import { useAuth } from "@/lib/auth";
import { useNavigate } from "react-router-dom";
import { useI18n } from "@/lib/i18n";

interface WaveBarProps {
  selectedWaveId?: string | null;
  onSelectWave: (waveId: string | null) => void;
  onCreateWave: () => void;
  /** Includes a row of trending public waves below the user's own. */
  showPublic?: boolean;
}

/**
 * Horizontal rail of wave cards. Replaces the old story-style circles.
 * - Each card surfaces the wave's cover photo + name + counts in a polished tile.
 * - Owner gets a small "SURFER" crown badge.
 * - Optionally shows trending public waves so non-members can browse + follow.
 */
export default function WaveBar({ selectedWaveId, onSelectWave, onCreateWave, showPublic }: WaveBarProps) {
  const { user } = useAuth();
  const { waves, loading } = useMyWaves();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [publicWaves, setPublicWaves] = useState<Wave[]>([]);

  useEffect(() => {
    if (!showPublic) return;
    fetchPublicWaves(20).then((rows) => setPublicWaves(rows as any));
  }, [showPublic]);

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

  const mineIds = new Set(waves.map((w) => w.id));
  const trending = publicWaves.filter((w) => !mineIds.has(w.id)).slice(0, 12);

  return (
    <div className="space-y-2">
      <div className="scrollbar-hide -mx-2 flex items-stretch gap-2.5 overflow-x-auto px-3 py-1">
        {/* All */}
        <PillButton
          active={!selectedWaveId}
          onClick={() => onSelectWave(null)}
        >
          <span className="text-[10.5px] font-bold tracking-[0.18em]">ALL</span>
        </PillButton>

        {!loading && waves.map((w) => (
          <WaveCard key={w.id} wave={w} active={selectedWaveId === w.id} onClick={() => onSelectWave(w.id)} />
        ))}

        {/* New */}
        <button
          onClick={onCreateWave}
          aria-label={t("waveBarNew")}
          className="group flex h-[68px] w-[68px] shrink-0 flex-col items-center justify-center gap-0.5 rounded-2xl border border-dashed border-foreground/25 bg-foreground/[0.03] text-foreground/55 transition hover:border-[hsl(330_85%_60%/0.5)] hover:text-[hsl(330_85%_60%)]"
        >
          <Plus className="h-4 w-4" />
          <span className="text-[9px] font-semibold tracking-wide">{t("waveBarNew")}</span>
        </button>
      </div>

      {showPublic && trending.length > 0 && (
        <div>
          <p className="mb-1 px-3 text-[9.5px] font-semibold uppercase tracking-[0.18em] text-foreground/45">
            Trending public waves
          </p>
          <div className="scrollbar-hide -mx-2 flex items-stretch gap-2.5 overflow-x-auto px-3 pb-1">
            {trending.map((w) => (
              <WaveCard key={w.id} wave={w} active={selectedWaveId === w.id} onClick={() => onSelectWave(w.id)} compact />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PillButton({
  active, onClick, children,
}: {
  active: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex h-[68px] w-[58px] shrink-0 items-center justify-center rounded-2xl border transition ${
        active
          ? "border-foreground/70 bg-foreground/10 text-foreground"
          : "border-foreground/10 bg-foreground/[0.04] text-foreground/65 hover:bg-foreground/[0.07]"
      }`}
    >
      {children}
    </button>
  );
}

/** Polished wave tile — cover photo + name + crown/counts overlay. */
function WaveCard({ wave, active, onClick, compact }: { wave: Wave & { follower_count?: number; theme_color?: string | null }; active: boolean; onClick: () => void; compact?: boolean }) {
  const isOwner = wave.role === "owner";
  const themeFallback = isOwner
    ? "linear-gradient(135deg, hsl(330 90% 60%) 0%, hsl(20 95% 60%) 100%)"
    : "linear-gradient(135deg, hsl(195 90% 60%) 0%, hsl(260 70% 55%) 100%)";
  const bg = wave.theme_color ? `linear-gradient(135deg, ${wave.theme_color} 0%, ${wave.theme_color} 100%)` : themeFallback;

  return (
    <button
      onClick={onClick}
      title={wave.name}
      className={`group relative flex shrink-0 flex-col overflow-hidden rounded-2xl text-left transition ${
        compact ? "h-[68px] w-[120px]" : "h-[68px] w-[140px]"
      } ${active ? "ring-2 ring-[hsl(330_85%_60%)] shadow-[0_8px_24px_-10px_hsl(330_85%_60%/0.6)]" : "ring-1 ring-foreground/10 hover:ring-foreground/25"}`}
    >
      {/* Cover / gradient */}
      <div className="absolute inset-0">
        {wave.cover_image_url ? (
          <img src={wave.cover_image_url} alt="" className="h-full w-full object-cover transition group-hover:scale-105" loading="lazy" />
        ) : (
          <div className="h-full w-full" style={{ background: bg }} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
      </div>

      {/* Owner crown */}
      {isOwner && (
        <span className="absolute left-1.5 top-1.5 z-10 inline-flex items-center gap-0.5 rounded-full bg-[hsl(330_85%_60%)] px-1.5 py-[1px] text-[7.5px] font-bold uppercase tracking-wider text-white shadow">
          <Crown className="h-2 w-2" /> SURFER
        </span>
      )}

      {/* Visibility chip */}
      <span className="absolute right-1.5 top-1.5 z-10 rounded-full bg-white/20 px-1.5 py-[1px] text-[7.5px] font-bold uppercase tracking-wider text-white backdrop-blur">
        {(wave as any).visibility ?? (wave.is_private ? "PRIV" : "PUB")}
      </span>

      {/* Footer */}
      <div className="relative z-10 mt-auto p-1.5">
        <p className="truncate text-[11px] font-bold leading-tight text-white drop-shadow">
          {wave.name}
        </p>
        <p className="mt-0.5 inline-flex items-center gap-0.5 text-[9px] font-semibold text-white/85">
          <Users className="h-2 w-2" />
          {wave.member_count}
          {(wave as any).follower_count ? <span className="ml-1 opacity-80">· {(wave as any).follower_count} ✦</span> : null}
        </p>
      </div>
    </button>
  );
}
