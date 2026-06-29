/**
 * WaveSection — Wave hub inside OOTD community shell.
 * Reuses the existing WaveBar + WaveModal pipeline so users can browse
 * their waves, open one in a modal, and create a new one.
 */
import { useState } from "react";
import { Plus, Radio, TrendingUp, Sparkles } from "lucide-react";
import { useMyWaves, type Wave } from "@/hooks/useWaves";
import WaveModal from "@/components/ootd/WaveModal";
import CreateWaveDialog from "@/components/ootd/CreateWaveDialog";
import { useAuth } from "@/lib/auth";

const PILLARS = [
  { icon: TrendingUp, label: "Viral looks" },
  { icon: Sparkles, label: "Challenges" },
  { icon: Radio, label: "Trend discovery" },
];

export default function WaveSection() {
  const { user } = useAuth();
  const { waves, loading, refetch } = useMyWaves();
  const [active, setActive] = useState<Wave | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <div className="mx-auto max-w-3xl px-5 py-6 md:px-10">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-[32px] font-medium leading-none tracking-tight text-foreground md:text-[40px]">
            Wave
          </h1>
          <p className="mt-2 text-[13px] text-foreground/60">
            Where fashion trends ripple. Join a wave, ride the moment.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2.5 text-[12px] font-medium text-background active:scale-95"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2.2} />
          New
        </button>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2">
        {PILLARS.map((p) => (
          <div
            key={p.label}
            className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card/60 px-2 py-4 text-center"
          >
            <p.icon className="h-4 w-4 text-accent" strokeWidth={1.6} />
            <span className="text-[10px] font-medium tracking-tight text-foreground/75">
              {p.label}
            </span>
          </div>
        ))}
      </div>

      <h2 className="mt-8 mb-3 font-display text-[18px] font-medium tracking-tight text-foreground">
        My Waves
      </h2>

      {loading ? (
        <p className="py-10 text-center text-sm text-foreground/55">Loading…</p>
      ) : !user ? (
        <p className="py-10 text-center text-sm text-foreground/55">
          Sign in to join waves.
        </p>
      ) : waves.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/40 px-5 py-10 text-center">
          <p className="text-sm text-foreground/70">No waves yet.</p>
          <p className="mt-1 text-[12px] text-foreground/50">
            Create the first one and invite friends.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {waves.map((w) => (
            <button
              key={w.id}
              type="button"
              onClick={() => setActive(w)}
              className="group relative overflow-hidden rounded-2xl border border-border bg-card text-left transition hover:border-accent/60"
            >
              {w.cover_image_url ? (
                <img
                  src={w.cover_image_url}
                  alt={w.name}
                  className="aspect-square w-full object-cover transition-transform group-hover:scale-[1.02]"
                  loading="lazy"
                />
              ) : (
                <div className="aspect-square w-full bg-secondary" />
              )}
              <div className="p-3">
                <p className="line-clamp-1 text-[13px] font-medium text-foreground">
                  {w.name}
                </p>
                <p className="mt-0.5 text-[11px] text-foreground/55">
                  {w.member_count} members
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {active && (
        <WaveModal wave={active} open={!!active} onClose={() => setActive(null)} />
      )}
      {creating && (
        <CreateWaveDialog
          open={creating}
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            refetch();
          }}
        />
      )}
    </div>
  );
}
