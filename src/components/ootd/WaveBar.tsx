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
 * Horizontal pill row: "All" + each wave the user belongs to + "+ New".
 * Hidden for guests (we still show a single "Create Wave" prompt).
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
    <div className="scrollbar-hide -mx-2 flex items-center gap-2 overflow-x-auto px-2 py-1">
      <Pill
        active={!selectedWaveId}
        onClick={() => onSelectWave(null)}
        label={t("waveBarAll")}
      />
      {!loading && waves.map((w) => (
        <WavePill
          key={w.id}
          wave={w}
          active={selectedWaveId === w.id}
          onClick={() => onSelectWave(w.id)}
        />
      ))}
      <button
        onClick={onCreateWave}
        className="flex shrink-0 items-center gap-1.5 rounded-full bg-foreground/10 px-3 py-1.5 text-[11px] font-semibold tracking-wide text-foreground/85 transition hover:bg-foreground/20"
      >
        <Plus className="h-3 w-3" />
        {t("waveBarNew")}
      </button>
    </div>
  );
}

function Pill({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full px-4 py-1.5 text-[11px] font-semibold tracking-wide transition ${
        active
          ? "bg-foreground text-background"
          : "bg-foreground/[0.06] text-foreground/65 hover:bg-foreground/[0.12]"
      }`}
    >
      {label}
    </button>
  );
}

function WavePill({ wave, active, onClick }: { wave: Wave; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`group flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold tracking-wide transition ${
        active
          ? "bg-gradient-to-r from-[hsl(330_85%_60%)] to-[hsl(280_70%_55%)] text-white shadow-[0_4px_18px_-6px_hsl(330_85%_60%/0.6)]"
          : "bg-[hsl(330_85%_60%/0.08)] text-foreground/80 hover:bg-[hsl(330_85%_60%/0.15)]"
      }`}
      title={wave.name}
    >
      {wave.cover_image_url ? (
        <img src={wave.cover_image_url} alt="" className="h-4 w-4 rounded-full object-cover" />
      ) : (
        <Waves className={`h-3 w-3 ${active ? "text-white" : "text-[hsl(330_85%_60%)]"}`} />
      )}
      <span className="max-w-[100px] truncate">{wave.name}</span>
      <span className={`text-[9px] tabular-nums ${active ? "text-white/80" : "text-foreground/40"}`}>
        {wave.member_count}
      </span>
    </button>
  );
}
